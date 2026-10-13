import { basename, resolve } from 'node:path';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';
import { readBaseUrlDirectories, readMobileAppPaths } from './projectTsconfig.ts';

type ViteAlias = { find: RegExp; replacement: string };

/**
 * Turns the target project's tsconfig `paths` into Vite aliases.
 *
 * vite-tsconfig-paths does not work for this. That plugin applies the mapping only to files covered
 * by the tsconfig's include, and this project's files are not part of the target project's
 * tsconfig, so it skips all of them.
 */
export const buildMobileAppAliases = (): ViteAlias[] => {
    const paths = readMobileAppPaths();

    // Files reached through `baseUrl` (`app/lib/Utils`) have no alias, so `paths` alone cannot point
    // at them. `tsconfig.paths.json` declares the same directories, so resolution is aligned with it.
    const baseUrlRelative = readBaseUrlDirectories().map((directory) => ({
        find: new RegExp(`^${escapeRegExp(basename(directory))}/`),
        replacement: `${directory}/`,
    }));

    // Longer aliases have to match first. If `@data` matches before `@data/*`, subpaths break.
    const keys = Object.keys(paths).sort((a, b) => b.length - a.length);

    return keys
        .flatMap<ViteAlias>((key) => {
            const target = paths[key]?.[0];
            if (target === undefined) return [];

            const isWildcard = key.endsWith('/*');
            if (isWildcard) {
                const prefix = key.slice(0, -1); // '@lib/*' -> '@lib/'
                const targetPrefix = target.slice(0, -1); // 'app/lib/*' -> 'app/lib/'
                return [
                    {
                        find: new RegExp(`^${escapeRegExp(prefix)}`),
                        replacement: `${resolve(MOBILE_APP_ROOT, targetPrefix)}/`,
                    },
                ];
            }

            const exact = {
                find: new RegExp(`^${escapeRegExp(key)}$`),
                replacement: resolve(MOBILE_APP_ROOT, target),
            };

            // An alias that points at a directory, such as `@ui`, opens up its subpaths too.
            // Going through the barrel (`@ui`) drags in the app's whole dependency graph, so a
            // preview declaration uses a direct path like `@ui/components/badge/Badge`.
            if (!target.endsWith('/')) return [exact];

            return [
                exact,
                {
                    find: new RegExp(`^${escapeRegExp(key)}/`),
                    replacement: `${resolve(MOBILE_APP_ROOT, target)}/`,
                },
            ];
        })
        .concat(baseUrlRelative);
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
