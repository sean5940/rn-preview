import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { readBaseUrlDirectories, readMobileAppPaths } from './projectTsconfig.ts';
import { resolveSharedPackages } from './webReplacements.ts';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';
import { PREVIEW_ROOT } from './previewRoot.ts';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS_FILE = resolve(PROJECT_ROOT, 'tsconfig.paths.json');
const PREVIEW_TSCONFIG_FILE = resolve(PREVIEW_ROOT, 'tsconfig.json');

/** Relative path from rn-preview to the target project. tsconfig cannot read environment variables, so it is resolved here. */
const toMobileApp = relative(PROJECT_ROOT, MOBILE_APP_ROOT);

const stripTrailingSlash = (value: string): string => (value.endsWith('/') ? value.slice(0, -1) : value);

const buildPaths = (): Record<string, string[]> => {
    const mobileAppPaths = readMobileAppPaths();

    const mapped = Object.entries(mobileAppPaths).flatMap(([key, targets]) => {
        const target = targets[0];
        if (target === undefined) return [];

        const entry: [string, string[]] = [key, [`${toMobileApp}/${stripTrailingSlash(target)}`]];

        // Vite opens up subpaths of a directory alias, so the editor is opened up to match.
        if (key.endsWith('/*') || !target.endsWith('/')) return [entry];
        return [entry, [`${key}/*`, [`${toMobileApp}/${target}*`]] as [string, string[]]];
    });

    return {
        ...Object.fromEntries(mapped),
        // Types come from the target project's react-native. react-native-web carries no types, and
        // what the preview draws is react-native components. Only the implementation is swapped by
        // the bundler.
        'react-native': [`${toMobileApp}/node_modules/react-native`],
        // The preview tool uses the app's copy of these packages too. Point the editor at the same place.
        ...Object.fromEntries(resolveSharedPackages().map(({ name, path }) => [name, [relative(PROJECT_ROOT, path)]])),
        // Imports that go through `baseUrl`, such as `app/lib/Utils`.
        ...Object.fromEntries(
            readBaseUrlDirectories().map((directory) => [
                `${basename(directory)}/*`,
                [`${relative(PROJECT_ROOT, directory)}/*`],
            ]),
        ),
        '@preview': ['./src/index.ts'],
        '@preview/*': ['./src/*'],
    };
};

/**
 * The tsconfig to place in the declaration file directory.
 *
 * Declaration files are opened in the target project's window, and that project's tsconfig does not
 * include the directory, so no alias resolves at all. Editors walk up from a file looking for a
 * tsconfig, so placing one beside the declarations makes `@preview` and the project aliases resolve
 * in that window too.
 */
const buildPreviewTsconfig = () => ({
    extends: relative(PREVIEW_ROOT, PATHS_FILE),
    compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        allowImportingTsExtensions: true,
        noEmit: true,
        // There is no node_modules beside the declaration files. Emptied so it does not go hunting
        // for global type packages.
        types: [],
    },
    include: ['**/*.preview.tsx'],
});

const writeIfChanged = (path: string, content: string): void => {
    if (existsSync(path) && readFileSync(path, 'utf-8') === content) return;

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
};

const toJson = (value: unknown): string => `${JSON.stringify(value, null, 4)}\n`;

/**
 * Decides whether this is an ephemeral target. Capture runs, type-check automation, and worktree
 * targets used for one run only fall under this.
 *
 * In that case the shared editor file is not rewritten. `tsconfig.paths.json` belongs to a
 * single-slot consumer, the editor, so letting an ephemeral run overwrite it would let the last run
 * decide the editor's resolution, and deleting a worktree would leave a dead path behind.
 *
 * A run made for the editor identifies itself with `RN_PREVIEW_EDITOR_TARGET`. While that signal did
 * not exist, every run launched from the extension was classified as ephemeral, so the alias file
 * the extension reads stayed as it was at build time. Rendering runs on bundler aliases, so the
 * screen looks fine and only the editor's type resolution dies quietly.
 */
const isEphemeralTarget = (): boolean =>
    process.env.MOBILE_APP_PATH !== undefined &&
    process.env.RN_PREVIEW_CONFIG === undefined &&
    process.env.RN_PREVIEW_EDITOR_TARGET === undefined;

/**
 * Derives the tsconfig the editor uses from the target project's tsconfig and writes it.
 *
 * The bundler reads aliases directly through `buildMobileAppAliases`, but tsconfig cannot. Copying
 * them by hand drifts whenever the target project changes an alias, so it is rewritten every time
 * the dev server starts. Unchanged content is left alone so the editor does not reread needlessly.
 */
export const writeEditorPathFiles = (): void => {
    // The declaration directory is not created if absent. Leaving only editor files in a spot that
    // holds no declarations creates a useless directory in the target repository, which that
    // repository then picks up as a commit candidate. The directory appears when the first
    // declaration is made, so this file follows from the run after that.
    if (existsSync(PREVIEW_ROOT)) {
        // The tsconfig beside the declarations has target-independent content (a relative extends),
        // so writing it always is safe.
        writeIfChanged(PREVIEW_TSCONFIG_FILE, toJson(buildPreviewTsconfig()));
    }
    if (isEphemeralTarget()) return;
    writeIfChanged(PATHS_FILE, toJson({ compilerOptions: { baseUrl: '.', paths: buildPaths() } }));
};

/**
 * Builds a standalone tsconfig that touches no shared file. For type checking only.
 *
 * baseUrl is pinned to the rn-preview absolute path and include is given the declaration
 * directory's absolute path, so resolution is identical wherever it is dropped in a temporary
 * directory. Checking several worktrees side by side shares no state between them, or with the
 * editor.
 */
export const buildStandaloneTsconfig = (): Record<string, unknown> => {
    const preview = buildPreviewTsconfig();
    return {
        compilerOptions: {
            ...preview.compilerOptions,
            baseUrl: PROJECT_ROOT,
            paths: buildPaths(),
        },
        include: [`${PREVIEW_ROOT}/**/*.preview.tsx`],
    };
};

export const writeEditorPaths = (): Plugin => ({
    name: 'editor-paths',
    configResolved() {
        writeEditorPathFiles();
    },
});
