import { createRequire } from 'node:module';
import { transformAsync } from '@babel/core';
import type { Plugin } from 'vite';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';

/** Selects only files that use worklets. Running babel over the rest slows the dev server down. */
const USES_WORKLETS = /react-native-reanimated|react-native-worklets|['"]worklet['"]/;

/**
 * reanimated 4 hands the plugin to the worklets package. The target project's copy is used as is.
 *
 * An app without reanimated has none, and nothing in it needs the transform.
 */
const findWorkletsPlugin = (): string | undefined => {
    try {
        return createRequire(`${MOBILE_APP_ROOT}/package.json`).resolve('react-native-reanimated/plugin');
    } catch {
        return undefined;
    }
};

const workletsPlugin = findWorkletsPlugin();

/**
 * Transforms reanimated worklets with babel.
 *
 * A call like `useAnimatedStyle(() => ...)` is **not syntax but an API that depends on a build
 * step.** reanimated's babel plugin finds the values referenced in the callback and supplies them
 * as a dependency array, and this project runs on Vite rather than Metro, so that step is absent.
 * reanimated then throws "used without a dependency array" and the screen fails to mount entirely.
 *
 * `@vitejs/plugin-react` 6 moved to oxc and no longer accepts babel plugins, hence this separate
 * step. It has to run before the JSX transform, so it is `pre`, and it parses TypeScript and JSX
 * syntax as is and emits them unchanged.
 */
export const reanimatedWorklets = (): Plugin => ({
    name: 'reanimated-worklets',
    enforce: 'pre',
    async transform(code, id) {
        if (workletsPlugin === undefined) return null;
        if (!id.startsWith(`${MOBILE_APP_ROOT}/`)) return null;
        if (!USES_WORKLETS.test(code)) return null;

        const result = await transformAsync(code, {
            filename: id,
            babelrc: false,
            configFile: false,
            sourceMaps: true,
            parserOpts: { plugins: ['typescript', 'jsx'] },
            plugins: [workletsPlugin],
        });

        return result?.code === undefined || result.code === null ? null : { code: result.code, map: result.map };
    },
});
