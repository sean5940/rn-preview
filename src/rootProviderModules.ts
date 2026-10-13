import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { previewConfig } from './previewConfig.ts';
import { PREVIEW_ROOT } from './previewRoot.ts';

const MODULE_ID = 'virtual:preview-root-providers';
const RESOLVED_ID = `\0${MODULE_ID}`;

const buildModuleSource = (): string => {
    const files = previewConfig.rootProviders.map((path) => resolve(PREVIEW_ROOT, path));

    return [
        ...files.map((file, index) => `import provider${index} from ${JSON.stringify(file)};`),
        '',
        `export const rootProviders = [${files.map((_, index) => `provider${index}`).join(', ')}];`,
        '',
    ].join('\n');
};

/**
 * Turns the root providers named in config into a `virtual:preview-root-providers` module.
 *
 * If the tool imported the app's providers directly, that project's paths would be baked into the
 * tool. Reading them from the declaration directory keeps project circumstances beside that
 * project. An empty config yields an empty array, so nothing is dragged in.
 */
export const rootProviderModules = (): Plugin => ({
    name: 'preview-root-providers',
    resolveId: (source) => (source === MODULE_ID ? RESOLVED_ID : null),
    load: (id) => (id === RESOLVED_ID ? buildModuleSource() : null),
});
