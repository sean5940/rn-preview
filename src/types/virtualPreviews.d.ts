declare module 'virtual:previews' {
    import type { PreviewSpec } from '@preview/definePreview.ts';

    /** Declaration file name -> the function that loads it. Built by the `preview-modules` plugin. */
    export const previewLoaders: Record<string, () => Promise<{ default: PreviewSpec<unknown> }>>;

    /** Declaration file name -> the absolute path of the file holding it. */
    export const previewFiles: Record<string, string>;
}
