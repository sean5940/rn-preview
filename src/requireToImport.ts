import type { Plugin } from 'vite';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';

const REQUIRE_CALL = /\brequire\((['"])([^'"]+)\1\)/g;

/**
 * Rewrites `require('...')` in the target project's sources into an import statement.
 *
 * React Native brings images in with `require('./x.png')` and also calls development-only modules
 * late through `require`. Metro handles both, but a web bundler has no `require` at all, so it dies
 * the moment it touches such a file.
 *
 * After the rewrite, even a `require` inside a conditional always loads. That difference does not
 * matter in a preview. Vite returns assets as URLs, and react-native-web's `Image` takes a URL
 * string as its `source`.
 *
 * Only the target project's sources are touched. A `require` inside node_modules is the bundler's
 * business.
 */
export const requireToImport = (): Plugin => ({
    name: 'require-to-import',
    enforce: 'pre',
    transform(code, id) {
        if (!id.startsWith(`${MOBILE_APP_ROOT}/`)) return null;

        const matches = [...code.matchAll(REQUIRE_CALL)];
        if (matches.length === 0) return null;

        const imports: string[] = [];
        const names = new Map<string, string>();

        const replaced = matches.reduce((accumulated, match) => {
            const specifier = match[2] as string;
            if (!names.has(specifier)) {
                const name = `__required${names.size}`;
                names.set(specifier, name);
                imports.push(`import ${name} from ${JSON.stringify(specifier)};`);
            }

            return accumulated.replaceAll(match[0], names.get(specifier) as string);
        }, code);

        return { code: [...imports, replaced].join('\n'), map: null };
    },
});
