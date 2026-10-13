import { relative, resolve, sep } from 'node:path';
import { previewConfig } from './previewConfig.ts';
import { PREVIEW_ROOT } from './previewRoot.ts';

const SOURCE_ROOT = previewConfig.sourceRoot;

const isInside = (directory: string, path: string): boolean => {
    const fromDirectory = relative(directory, path);
    return fromDirectory !== '' && !fromDirectory.startsWith('..');
};

/**
 * The declaration file path corresponding to a source file.
 *
 * Recording "what this declaration draws" inside the declaration puts the same fact in two places,
 * where it drifts. They are linked by path instead. The editor extension can find a declaration's
 * location from the open file's path alone, with no registry needed.
 *
 * With `sourceRoot` set to `src`:
 * `src/screens/account/SubscriptionScreen.tsx`
 *   -> `<declaration directory>/screens/account/SubscriptionScreen.preview.tsx`
 */
export const toPreviewPath = (sourcePath: string): string | undefined => {
    const absolute = resolve(sourcePath);
    if (!isInside(SOURCE_ROOT, absolute)) return undefined;
    // With the default source root the declaration directory sits inside it. Its own files, such as
    // module overrides, are not sources to preview.
    if (isInside(PREVIEW_ROOT, absolute) || absolute.split(sep).includes('node_modules')) return undefined;

    return resolve(PREVIEW_ROOT, relative(SOURCE_ROOT, absolute).replace(/\.tsx?$/, '.preview.tsx'));
};

/** The source file path corresponding to a declaration file. */
export const toSourcePath = (previewPath: string): string | undefined => {
    const fromPreview = relative(PREVIEW_ROOT, resolve(previewPath));
    if (fromPreview.startsWith('..') || !fromPreview.endsWith('.preview.tsx')) return undefined;

    return resolve(SOURCE_ROOT, fromPreview.replace(/\.preview\.tsx$/, '.tsx'));
};
