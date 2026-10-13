import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { init as initCjs, parse as parseCjs } from 'cjs-module-lexer';
import { init, parse } from 'es-module-lexer';
import type { Plugin } from 'vite';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';

const readyLexers = async (): Promise<void> => {
    await Promise.all([init, initCjs()]);
};

const PREFIX = '\0stub:';

const requireFromMobileApp = createRequire(resolve(MOBILE_APP_ROOT, 'package.json'));

const CANDIDATE_SUFFIXES = ['', '.js', '.mjs', '/index.js', '/index.mjs'];

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile();

const firstExisting = (base: string): string | undefined =>
    CANDIDATE_SUFFIXES.map((suffix) => `${base}${suffix}`).find(isFile);

/** A package's ESM entry file. Only names are read from it, so it is never executed. */
const findEntry = (packageName: string): string | undefined => {
    try {
        const manifestPath = requireFromMobileApp.resolve(`${packageName}/package.json`);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, string>;
        const entry = manifest.module ?? manifest.main;
        if (entry === undefined) return undefined;

        return firstExisting(resolve(dirname(manifestPath), entry));
    } catch {
        return undefined;
    }
};

const followReExport = (entry: string, specifier: string, seen: Set<string>): string[] => {
    const nested = firstExisting(resolve(dirname(entry), specifier));
    return nested === undefined ? [] : readExportNames(nested, seen);
};

const readExportNames = (entry: string, seen: Set<string>): string[] => {
    if (seen.has(entry)) return [];
    seen.add(entry);

    const code = readFileSync(entry, 'utf-8');

    try {
        const [imports, exports] = parse(code);

        // `export * from './x'` does not reveal names, so that file is followed too.
        const reExported = imports
            .filter((item) => item.n !== undefined && code.slice(item.ss, item.s).startsWith('export'))
            .flatMap((item) => followReExport(entry, item.n as string, seen));

        if (exports.length + reExported.length > 0) return [...exports.map((item) => item.n), ...reExported];
    } catch {
        // The lexer throws when it is not ESM. It is re-read as CommonJS below.
    }

    // CommonJS compiled from TypeScript is not picked up by the ESM lexer.
    try {
        const cjs = parseCjs(code);
        return [...cjs.exports, ...cjs.reexports.flatMap((specifier) => followReExport(entry, specifier, seen))];
    } catch {
        return [];
    }
};

const buildStubSource = (packageName: string, stubPath: string): string => {
    const entry = findEntry(packageName);
    const names = entry === undefined ? [] : readExportNames(entry, new Set());

    const named = [...new Set(names)]
        .filter((name) => name !== 'default' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name))
        .map((name) => `export const ${name} = stub;`);

    return [`import stub from ${JSON.stringify(stubPath)};`, '', 'export default stub;', ...named, ''].join('\n');
};

/**
 * Replaces native packages that draw nothing with an empty stub.
 *
 * Aliasing a single stub blocks a named import such as `import { SomePlugin } from 'some-package'`,
 * because ESM checks named exports statically and the stub does not have that name. Writing the
 * names by hand never converged: every package emptied surfaced new names.
 *
 * So a module is generated that reads only the export names from the real package's entry file and
 * exports exactly those. Names are read without executing anything, so it is unaffected by the
 * package throwing at module top level.
 */
export const stubModules = (patterns: RegExp[], stubPath: string): Plugin => ({
    name: 'stub-modules',
    enforce: 'pre',
    buildStart: readyLexers,
    resolveId: (source) => (patterns.some((pattern) => pattern.test(source)) ? `${PREFIX}${source}` : null),
    load: (id) => (id.startsWith(PREFIX) ? buildStubSource(id.slice(PREFIX.length), stubPath) : null),
});
