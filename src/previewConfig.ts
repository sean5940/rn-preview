import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Default list of native packages that draw nothing.
 *
 * Analytics, push, permissions, storage, login, sharing, and deep links all do work outside the
 * screen. The web has no counterpart, and several of them throw "this platform is not supported" at
 * module top level, so merely brushing against one kills the preview.
 *
 * **Left empty.** Which ones a project uses differs per project, and the list itself reveals which
 * analytics, attribution, and crash vendors that app runs on. Baking one app's vendor mix into the
 * tool ships it in the published artifact. Projects declare their own via `nonRenderingPackages`.
 *
 * What to put there is in the README under "Per-project settings" and in
 * `docs/rn-preview.config.example.json`. Leave it out and any screen that touches such a package
 * fails to mount entirely; find the blocked module with `node scripts/whyNotBundled.mjs <module>`.
 */
const DEFAULT_NON_RENDERING: string[] = [];

/**
 * Packages the preview tool and the app code must share one instance of.
 *
 * If the provider the preview wraps and the hook the app code calls come from different instances,
 * context does not connect. `useQuery` throws "outside a provider", for example. Pinned to the
 * app's own copy.
 */
const DEFAULT_SHARED = ['@tanstack/react-query', '@react-navigation/native', 'react-native-safe-area-context'];

/**
 * Where the fonts the app links live.
 *
 * iOS only. Android keeps the same fonts under lowercase filenames (`pretendard_semibold.ttf`),
 * which do not match the names app code passes to `fontFamily`, so no rule can be built from them.
 */
const DEFAULT_FONT_DIRS = ['ios/fonts'];

/** Declaration directory used when there is neither config nor environment variable. Relative to the project. */
const DEFAULT_PREVIEW_ROOT = 'previews';

/**
 * Name of the path-override file used by this clone alone. Kept at the repository root and excluded
 * from version control.
 *
 * Some layouts do not keep the target project as a sibling, or keep declarations outside the
 * conventional location. Rather than passing that through an environment variable on every command,
 * it is written down once per clone. It is a per-machine value rather than shared project config, so
 * it is not committed.
 */
const LOCAL_OVERRIDE = 'rn-preview.local.json';

/** For cases like a barrel cycle, where resolution must be redirected only inside one directory. */
export type ImportRedirect = {
    /** Applied only when a file under this directory imports. Relative to the project. */
    importerUnder: string;
    /** The module that would normally resolve. Relative to the project. */
    from: string;
    /** The module to use instead. Relative to the project. */
    to: string;
};

export type PreviewConfig = {
    /** RN project root. */
    projectRoot: string;
    /**
     * Directory whose files can be previewed. Declaration paths mirror the layout below it.
     *
     * Defaults to the project root. Layouts differ: the RN template keeps `App.tsx` at the root, the
     * Expo template keeps code under `src/`, and some apps keep everything under `app/`. It is not
     * guessed from the folders present, because guessing wrong moves every declaration path at once
     * and the existing declarations stop matching their sources without any error.
     */
    sourceRoot: string;
    /** Declaration file directory. */
    previewRoot: string;
    /** Packages that draw nothing, added to the default list. `*` is allowed. */
    nonRenderingPackages: string[];
    /** Packages to share an instance with the app, added to the default list. */
    sharedPackages: string[];
    /** Font directories the app links, added to the default list. Relative to the project; missing paths are skipped. */
    fontDirs: string[];
    /**
     * Project files to swap for a preview-only implementation.
     *
     * Keys are relative to the project, values relative to the declaration directory. A replacement
     * is code that knows the project's circumstances, so it lives beside the declarations rather
     * than inside the tool.
     */
    moduleOverrides: Record<string, string>;
    /**
     * Providers the app always wraps at its root.
     *
     * Relative to the declaration directory; each module default-exports a component that takes
     * children. Different from `wrappers`: that is chosen by a declaration, this goes into every
     * cell. Things like a redux store belong here, because they are **always present in the app and
     * read several levels below.** Whoever writes a declaration cannot know in advance how many
     * levels down that screen calls `useSelector`, and if it is missing the screen fails to mount
     * entirely.
     *
     * What to wrap is a project matter, so it lives beside the declarations rather than in the tool.
     */
    rootProviders: string[];
    /** Resolution detours, such as cutting a barrel cycle. */
    importRedirects: ImportRedirect[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = (path: string): Record<string, unknown> => {
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'));
        return isRecord(parsed) ? parsed : {};
    } catch (error) {
        throw new Error(`Could not read the preview config: ${path}\n${(error as Error).message}`);
    }
};

const stringList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const stringMap = (value: unknown): Record<string, string> =>
    isRecord(value)
        ? Object.fromEntries(
              Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
          )
        : {};

const redirects = (value: unknown): ImportRedirect[] =>
    Array.isArray(value)
        ? value.flatMap((item) =>
              isRecord(item) &&
              typeof item.importerUnder === 'string' &&
              typeof item.from === 'string' &&
              typeof item.to === 'string'
                  ? [{ importerUnder: item.importerUnder, from: item.from, to: item.to }]
                  : [],
          )
        : [];

/**
 * Resolves a path to its real location.
 *
 * Without resolving symlinks, the path Vite resolves (`/private/tmp/...`) and the path the config
 * builds (`/tmp/...`) differ, so **rules that compare paths silently fail to match.** Module
 * overrides are the case that bites. macOS `/tmp` behaves this way, and so does keeping worktrees
 * under a symlink.
 */
const fromHere = (path: string): string => {
    const absolute = isAbsolute(path) ? path : resolve(here, '..', path);
    return existsSync(absolute) ? realpathSync(absolute) : absolute;
};

/**
 * Looks for the target RN project in sibling directories.
 *
 * Used only when there is neither config nor environment variable. Keeping the tool and the target
 * project side by side is a common layout, and with that layout this works without any config. With
 * more than one candidate it does not choose, it prints the names. Choosing wrong renders the wrong
 * project and that fact surfaces much later.
 */
const findSiblingProject = (): string | undefined => {
    const parent = resolve(here, '..', '..');

    const isReactNativeProject = (dir: string): boolean => {
        try {
            const pkg: unknown = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));
            return isRecord(pkg) && isRecord(pkg.dependencies) && 'react-native' in pkg.dependencies;
        } catch {
            return false;
        }
    };

    const found = readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => resolve(parent, entry.name))
        .filter(isReactNativeProject);

    if (found.length > 1) {
        throw new Error(
            `Found several RN projects in sibling directories:\n${found.join('\n')}\n` +
                `Name one with the MOBILE_APP_PATH environment variable or projectRoot in RN_PREVIEW_CONFIG.`,
        );
    }
    return found[0];
};

/**
 * Reads the preview config.
 *
 * Given a JSON path in `RN_PREVIEW_CONFIG`, **that file alone** is used. The
 * `rn-preview.config.json` beside the declaration directory is not merged in, so module overrides
 * and root providers have to be in that file too. Leave them out and app code loads unstubbed and
 * the screen fails to mount entirely.
 *
 * Otherwise paths are decided in this order.
 *
 * 1. Environment variables (`MOBILE_APP_PATH` and `PREVIEW_DIR`). The route the editor extension
 *    and automation use.
 * 2. `rn-preview.local.json`. This clone's usual target.
 * 3. Sibling lookup and the default declaration directory.
 *
 * **Environment variables beat `rn-preview.local.json`.** That file records the usual target and an
 * environment variable picks the target for one run, so whatever is passed each time has to win.
 * Reversed, naming a worktree still renders the usual target, and since the screen comes up fine,
 * the fact that you are looking at a different branch never surfaces.
 *
 * The remaining settings are read from `rn-preview.config.json` beside the declaration directory.
 * Project circumstances belong next to that project.
 */
const load = (): PreviewConfig => {
    const explicit = process.env.RN_PREVIEW_CONFIG;
    const localPath = resolve(here, '..', LOCAL_OVERRIDE);

    const raw = explicit === undefined ? {} : readJson(explicit);
    const local = explicit === undefined && existsSync(localPath) ? readJson(localPath) : {};

    const configuredProject =
        typeof raw.projectRoot === 'string'
            ? raw.projectRoot
            : (process.env.MOBILE_APP_PATH ??
              (typeof local.projectRoot === 'string' ? local.projectRoot : findSiblingProject()));

    if (configuredProject === undefined) {
        throw new Error(
            'Could not find an RN project.\n' +
                'Name the path with the MOBILE_APP_PATH environment variable or projectRoot in RN_PREVIEW_CONFIG.',
        );
    }

    const projectRoot = fromHere(configuredProject);

    const previewRoot = fromHere(
        typeof raw.previewRoot === 'string'
            ? raw.previewRoot
            : (process.env.PREVIEW_DIR ??
                  (typeof local.previewRoot === 'string'
                      ? local.previewRoot
                      : resolve(projectRoot, DEFAULT_PREVIEW_ROOT))),
    );

    const beside = resolve(previewRoot, 'rn-preview.config.json');
    const merged = explicit === undefined && existsSync(beside) ? { ...readJson(beside), ...raw } : raw;

    const sourceRoot = resolve(projectRoot, typeof merged.sourceRoot === 'string' ? merged.sourceRoot : '.');
    if (!existsSync(sourceRoot)) {
        throw new Error(`Could not find sourceRoot: ${sourceRoot}\nIt is relative to the project root.`);
    }

    return {
        projectRoot,
        sourceRoot: realpathSync(sourceRoot),
        previewRoot,
        nonRenderingPackages: [...DEFAULT_NON_RENDERING, ...stringList(merged.nonRenderingPackages)],
        sharedPackages: [...DEFAULT_SHARED, ...stringList(merged.sharedPackages)],
        fontDirs: [...DEFAULT_FONT_DIRS, ...stringList(merged.fontDirs)],
        moduleOverrides: stringMap(merged.moduleOverrides),
        rootProviders: stringList(merged.rootProviders),
        importRedirects: redirects(merged.importRedirects),
    };
};

export const previewConfig = load();

if (!existsSync(resolve(previewConfig.projectRoot, 'package.json'))) {
    throw new Error(
        `Could not find an RN project: ${previewConfig.projectRoot}\n` +
            `Name the path with projectRoot in RN_PREVIEW_CONFIG or the MOBILE_APP_PATH environment variable.`,
    );
}

/** Turns a starred pattern like `@react-native-firebase/*` into a regular expression. */
export const toPackagePattern = (name: string): RegExp =>
    new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.+')}$`);
