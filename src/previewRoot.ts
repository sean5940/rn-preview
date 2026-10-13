import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { previewConfig } from './previewConfig.ts';

/**
 * The directory holding the preview declaration files.
 *
 * Symlinks are resolved. Vite permits file access and watches based on real paths.
 */
export const PREVIEW_ROOT = existsSync(previewConfig.previewRoot)
    ? realpathSync(previewConfig.previewRoot)
    : previewConfig.previewRoot;

/** Collects the absolute paths of the declaration files. */
export const findPreviewFiles = (directory: string = PREVIEW_ROOT): string[] => {
    if (!existsSync(directory)) return [];

    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return findPreviewFiles(path);
        return entry.name.endsWith('.preview.tsx') ? [path] : [];
    });
};

/** Turns a declaration file path into the name used in the list. `ui/Badge.preview.tsx` -> `ui/Badge` */
export const toPreviewName = (path: string): string =>
    path.slice(PREVIEW_ROOT.length + 1).replace(/\.preview\.tsx$/, '');
