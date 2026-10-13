import { existsSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';

type ProjectTsconfig = {
    /** tsconfig `paths`, with every target rewritten relative to the project root. */
    paths: Record<string, string[]>;
    /** Absolute `baseUrl`, when the project sets one. */
    baseUrl: string | undefined;
};

const NO_TSCONFIG: ProjectTsconfig = { paths: {}, baseUrl: undefined };

/**
 * Rewrites a `paths` target relative to the project root.
 *
 * Targets are relative to `baseUrl` (or, without one, to the tsconfig). Everything downstream joins
 * them onto the project root, so a project with `baseUrl: "src"` would otherwise point every alias
 * one directory too high.
 */
const toProjectRelative = (base: string, target: string): string => {
    const fromRoot = relative(MOBILE_APP_ROOT, resolve(base, target)) || '.';
    return target.endsWith('/') ? `${fromRoot}/` : fromRoot;
};

let cached: ProjectTsconfig | undefined;

/**
 * Reads the module resolution settings of the target project's tsconfig, following `extends`.
 *
 * The alias list is not copied over here. Copying it drifts silently whenever the target project
 * adds or changes an alias.
 */
export const readProjectTsconfig = (): ProjectTsconfig => {
    if (cached !== undefined) return cached;

    const tsconfigPath = resolve(MOBILE_APP_ROOT, 'tsconfig.json');
    if (!existsSync(tsconfigPath)) {
        cached = NO_TSCONFIG;
        return cached;
    }

    const { config, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (error !== undefined) {
        throw new Error(`Could not read the target project's tsconfig: ${tsconfigPath}`);
    }

    // Only compiler options are needed. Listing the files a large app includes takes seconds.
    const host: ts.ParseConfigHost = { ...ts.sys, readDirectory: () => [] };
    const { options } = ts.parseJsonConfigFileContent(config, host, MOBILE_APP_ROOT, undefined, tsconfigPath);

    const base = options.baseUrl ?? dirname(tsconfigPath);
    const paths = Object.fromEntries(
        Object.entries(options.paths ?? {}).map(([key, targets]) => [
            key,
            targets.map((target) => toProjectRelative(base, target)),
        ]),
    );

    cached = { paths, baseUrl: options.baseUrl };
    return cached;
};

/** The target project's tsconfig `paths`, with targets relative to the project root. */
export const readMobileAppPaths = (): Record<string, string[]> => readProjectTsconfig().paths;

/**
 * Directories the project imports by bare name through `baseUrl`, such as `app/lib/Utils`.
 *
 * Only top-level directories under `baseUrl`. `node_modules` and hidden directories are skipped,
 * since nothing imports through them by that name.
 */
export const readBaseUrlDirectories = (): string[] => {
    const { baseUrl } = readProjectTsconfig();
    if (baseUrl === undefined || !existsSync(baseUrl)) return [];

    return readdirSync(baseUrl, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.'))
        .map((entry) => resolve(baseUrl, entry.name));
};
