import type { Plugin } from 'vite';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';

const POSITION_UNSET = /\b(top|bottom|left|right|start|end)\s*:\s*undefined\b/g;

/**
 * Makes the React Native idiom of clearing a position property with `undefined` work on the web too.
 *
 * `[StyleSheet.absoluteFill, { top: undefined }]` means "release the top anchor and pin to the
 * bottom", and it turns up all over RN codebases. Native reads `undefined` as "no value" and clears
 * it, but **react-native-web skips `undefined`, so the preceding style's `top: 0` survives.** What
 * should sit at the bottom ends up at the top, and the content shifts down and overflows.
 *
 * The CSS equivalent is `auto`. Applied to position properties only, so no other style is touched.
 * Only the target project's sources are read.
 */
export const rnStyleCompat = (): Plugin => ({
    name: 'rn-style-compat',
    enforce: 'pre',
    transform(code, id) {
        if (!id.startsWith(`${MOBILE_APP_ROOT}/`)) return null;
        if (!POSITION_UNSET.test(code)) return null;

        POSITION_UNSET.lastIndex = 0;
        return { code: code.replace(POSITION_UNSET, "$1: 'auto'"), map: null };
    },
});
