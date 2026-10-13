import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { PREVIEW_ROOT } from './previewRoot.ts';
import { previewConfig } from './previewConfig.ts';

/**
 * Project files that use a different implementation in a preview only.
 *
 * `webReplacements` swaps package names; this swaps specific files inside the project. Matching is
 * done on resolved paths so it catches the file regardless of how the import is written (alias or
 * relative path).
 *
 * The target project is read-only. Its files are left alone and only resolution is redirected. A
 * replacement is code that knows the project's circumstances, so it lives in the declaration
 * directory rather than inside the tool.
 */
const OVERRIDES = Object.entries(previewConfig.moduleOverrides).map(([from, to]) => ({
    from: resolve(previewConfig.projectRoot, from),
    to: resolve(PREVIEW_ROOT, to),
}));

const REPLACEMENTS = new Set(OVERRIDES.map((override) => override.to));

export const mobileAppOverrides = (): Plugin => ({
    name: 'mobile-app-overrides',
    enforce: 'pre',
    async resolveId(source, importer, options) {
        if (importer === undefined) return null;
        // A replacement importing the original is left alone. Otherwise it resolves to itself and loops.
        if (REPLACEMENTS.has(importer)) return null;

        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (resolved === null) return null;

        return OVERRIDES.find((override) => override.from === resolved.id)?.to ?? null;
    },
});
