import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { previewConfig } from './previewConfig.ts';

/**
 * Redirects to a different module only inside one directory.
 *
 * Used to cut a barrel cycle. Say `ui/foundation/DropShadow.tsx` takes a single colour from the
 * top-level `@ui` barrel: that barrel also re-exports the components, so even importing one
 * component by direct path drags in the app's global dependencies. The symbol it needs lives in
 * `foundation`, so the preview redirects to that barrel instead.
 *
 * Narrowing the scope to the importer directory matters. Redirect everywhere and the symbol
 * disappears from files that were taking component symbols from the barrel as well.
 *
 * The target project is read-only, so its import statements are left alone and only resolution
 * changes.
 */
const RULES = previewConfig.importRedirects.map((rule) => ({
    under: `${resolve(previewConfig.projectRoot, rule.importerUnder)}/`,
    from: resolve(previewConfig.projectRoot, rule.from),
    to: resolve(previewConfig.projectRoot, rule.to),
}));

export const importRedirects = (): Plugin => ({
    name: 'import-redirects',
    enforce: 'pre',
    async resolveId(source, importer, options) {
        if (importer === undefined) return null;

        const candidates = RULES.filter((rule) => importer.startsWith(rule.under));
        if (candidates.length === 0) return null;

        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (resolved === null) return null;

        return candidates.find((rule) => rule.from === resolved.id)?.to ?? null;
    },
});
