import { existsSync, watch } from 'node:fs';
import type { Plugin } from 'vite';
import { findPreviewFiles, PREVIEW_ROOT, toPreviewName } from './previewRoot.ts';

const MODULE_ID = 'virtual:previews';
const RESOLVED_ID = `\0${MODULE_ID}`;

const buildModuleSource = (): string => {
    const files = findPreviewFiles();

    // Collected as static imports, **one declaration failing to load takes down every one of them.**
    // Branches differ per worktree, so a module a declaration references sometimes does not exist on
    // that branch. Only the selected one is loaded.
    const loaders = files.map(
        (file) => `    ${JSON.stringify(toPreviewName(file))}: () => import(${JSON.stringify(file)}),`,
    );
    // The editor extension names a preview by the open file's path. This keeps the naming rule from
    // being copied over there.
    const paths = files.map((file) => `    ${JSON.stringify(toPreviewName(file))}: ${JSON.stringify(file)},`);

    return [
        'export const previewLoaders = {',
        ...loaders,
        '};',
        '',
        'export const previewFiles = {',
        ...paths,
        '};',
        '',
    ].join('\n');
};

/**
 * Turns the declaration file list into a `virtual:previews` module.
 *
 * `import.meta.glob` is not used. It takes a path only as a static literal, so the location cannot
 * be changed with `PREVIEW_DIR`, and it does not walk past a symlink either.
 *
 * When the list changes (a file is added or removed) this module is invalidated. Content changes are
 * Vite's business. Watching goes through `fs.watch` rather than Vite's watcher: the declaration
 * directory sits past a symlink outside the project root, and `watcher.add` produced no add events
 * for it.
 */
export const previewModules = (): Plugin => ({
    name: 'preview-modules',
    resolveId: (source) => (source === MODULE_ID ? RESOLVED_ID : null),
    load: (id) => (id === RESOLVED_ID ? buildModuleSource() : null),
    configureServer(server) {
        if (!existsSync(PREVIEW_ROOT)) return;

        let known = findPreviewFiles().join('\n');

        const watcher = watch(PREVIEW_ROOT, { recursive: true }, () => {
            const next = findPreviewFiles().join('\n');
            if (next === known) return;
            known = next;

            const virtual = server.moduleGraph.getModuleById(RESOLVED_ID);
            if (virtual !== undefined) server.moduleGraph.invalidateModule(virtual);
            server.ws.send({ type: 'full-reload' });
        });

        // If this watcher holds the event loop, the process does not exit after a test run finishes.
        // The dev server keeps running without it, because its http server is alive.
        watcher.unref();
        server.httpServer?.on('close', () => watcher.close());
    },
});
