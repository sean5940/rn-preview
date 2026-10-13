import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';
import { previewConfig, toPackagePattern } from './previewConfig.ts';

type ViteAlias = { find: RegExp; replacement: string };

const requireFrom = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** A value that does nothing whatever you take from it. The modules `stubModules` builds export this. */
export const NATIVE_STUB = resolve(here, 'stubs/nativeStub.ts');

/** The module to put in `react-native`'s place. It fills in the native APIs react-native-web lacks. */
export const REACT_NATIVE_SHIM = resolve(here, 'stubs/reactNative.tsx');

/** Packages to empty out because they draw nothing. The default list and the config combined. */
export const NON_RENDERING_PACKAGES = previewConfig.nonRenderingPackages.map(toPackagePattern);

/** Packages that must share an instance with the app. The default list and the config combined. */
export const SHARED_WITH_MOBILE_APP = previewConfig.sharedPackages;

/**
 * What to load for a default shared package the target project does not install.
 *
 * The preview's own providers import these, so in an app without one of them the import fails and
 * no cell renders at all, even though the app never reads that context.
 */
const STAND_INS: Record<string, string> = {
    '@tanstack/react-query': resolve(here, 'stubs/reactQuery.tsx'),
    '@react-navigation/native': resolve(here, 'stubs/reactNavigation.ts'),
    'react-native-safe-area-context': resolve(here, 'stubs/safeAreaContext.ts'),
};

/**
 * Where each shared package is loaded from: the app's copy, or a stand-in when the app has none.
 *
 * A package the app lacks that has no stand-in is left out, so it resolves as usual.
 */
export const resolveSharedPackages = (): { name: string; path: string }[] =>
    SHARED_WITH_MOBILE_APP.flatMap((name) => {
        const installed = resolve(MOBILE_APP_ROOT, 'node_modules', name);
        if (existsSync(installed)) return [{ name, path: installed }];

        const standIn = STAND_INS[name];
        return standIn === undefined ? [] : [{ name, path: standIn }];
    });

/**
 * Replaces native-only packages with web implementations.
 *
 * The replacement is an absolute path. Left as a bare specifier, an import coming from the target
 * project's sources gets re-resolved against that project's node_modules and lands back on the
 * original package.
 *
 * A replaced package can render differently from the real native one. Those are recorded in
 * COMPATIBILITY.md.
 */
export const buildWebReplacements = (): ViteAlias[] => [
    ...resolveSharedPackages().map(({ name, path }) => ({
        find: new RegExp(`^${name.replace('/', '\\/')}$`),
        replacement: path,
    })),
    // It has no index.js, only index.ios.js and index.android.js, and they are written in Flow.
    { find: /^react-native-linear-gradient$/, replacement: resolve(here, 'stubs/linearGradient.tsx') },
    // Native code only. An empty stub swallows the pages, so the showing one is drawn by hand.
    { find: /^react-native-pager-view$/, replacement: resolve(here, 'stubs/pagerView.tsx') },
    // Left as an empty stub, the store receives nothing for its middleware slot and creation breaks.
    { find: /^redux-logger$/, replacement: resolve(here, 'stubs/reduxLogger.ts') },
    // An empty stub is unusable for the same reason as above. This package goes in the enhancer slot.
    {
        find: /^@rozenite\/redux-devtools-plugin$/,
        replacement: resolve(here, 'stubs/rozeniteReduxDevTools.ts'),
    },
    // The package ships a separate web implementation, but its main field points at the native one.
    {
        find: /^react-native-svg$/,
        replacement: requireFrom.resolve('react-native-svg/lib/module/ReactNativeSVG.web.js'),
    },
    // RN internals that native packages commonly pull in. All Flow, so parsing blocks on them.
    // These are paths rather than packages, so there is no entry point to read export names from.
    // A hand-written stub is used.
    { find: /^react-native\/Libraries\/.*/, replacement: NATIVE_STUB },
    // Its web implementation drops the React Native style and draws through the optional peer below.
    // The stand-in keeps the style and draws with lottie-web, so the block is the size it is on a device.
    { find: /^lottie-react-native$/, replacement: resolve(here, 'stubs/lottieView.tsx') },
    // An optional peer that is not installed, so there is no entry point to read.
    { find: /^@lottiefiles\/dotlottie-react$/, replacement: NATIVE_STUB },
];
