import { readFileSync } from 'node:fs';
import { transform as svgrTransform } from '@svgr/core';
import jsxPlugin from '@svgr/plugin-jsx';
import type { Plugin } from 'vite';
import { transformWithOxc } from 'vite';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';

const isMobileAppSvg = (id: string): boolean => id.startsWith(`${MOBILE_APP_ROOT}/`) && id.endsWith('.svg');

/**
 * Turns `.svg` into a react-native-svg component.
 *
 * App code imports it as `import Graphic from './x.svg'` and uses it as `<Graphic />`. Under Metro,
 * react-native-svg-transformer does that conversion, but Vite returns a URL string by default, so
 * that string lands in the tag-name position and it dies.
 *
 * What svgr emits is JSX, so it is transformed once more here. `@vitejs/plugin-react` picks its
 * targets by extension, so it skips `.svg`.
 */
export const svgComponents = (): Plugin => ({
    name: 'svg-components',
    enforce: 'pre',
    load: (id) => (isMobileAppSvg(id) ? readFileSync(id, 'utf-8') : null),
    async transform(code, id) {
        if (!isMobileAppSvg(id)) return null;

        const component = await svgrTransform(
            code,
            { native: true, plugins: [jsxPlugin], jsxRuntime: 'automatic' },
            { componentName: 'SvgAsset' },
        );

        return transformWithOxc(component, `${id}.tsx`, { jsx: { runtime: 'automatic' } });
    },
});
