import { previewFiles, previewLoaders } from 'virtual:previews';
import type { PreviewSpec } from './definePreview.ts';

type Loader = () => Promise<{ default: PreviewSpec<unknown> }>;

/** Declaration name -> the function that loads it. Only the selected one is loaded. */
export const loadPreviewLoaders = (): Record<string, Loader> => previewLoaders;

/** Declaration name -> the absolute path of the file holding it. */
export const loadPreviewFiles = (): Record<string, string> => previewFiles;
