import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { appFonts } from './src/appFonts.ts';
import { requireToImport } from './src/requireToImport.ts';
import { rnStyleCompat } from './src/rnStyleCompat.ts';
import { svgComponents } from './src/svgComponents.ts';
import { writeEditorPaths } from './src/editorPaths.ts';
import { buildMobileAppAliases } from './src/mobileAppAliases.ts';
import { mobileAppOverrides } from './src/mobileAppOverrides.ts';
import { MOBILE_APP_ROOT } from './src/mobileAppPath.ts';
import { previewModules } from './src/previewModules.ts';
import { PREVIEW_ROOT } from './src/previewRoot.ts';
import { rootProviderModules } from './src/rootProviderModules.ts';
import { importRedirects } from './src/importRedirects.ts';
import { reanimatedWorklets } from './src/reanimatedWorklets.ts';
import { serverIdentity } from './src/serverIdentity.ts';
import { stubModules } from './src/stubModules.ts';
import { buildWebReplacements, NATIVE_STUB, NON_RENDERING_PACKAGES, REACT_NATIVE_SHIM } from './src/webReplacements.ts';

const SRC_DIR = fileURLToPath(new URL('./src', import.meta.url));

// The react-native ecosystem keeps web-only implementations in .web.* files (react-native-svg does).
// Vite does not look at these extensions by default, so they go first.
const WEB_FIRST_EXTENSIONS = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'];

export default defineConfig({
    plugins: [
        react(),
        requireToImport(),
        reanimatedWorklets(),
        rnStyleCompat(),
        svgComponents(),
        stubModules(NON_RENDERING_PACKAGES, NATIVE_STUB),
        importRedirects(),
        mobileAppOverrides(),
        writeEditorPaths(),
        appFonts(),
        previewModules(),
        rootProviderModules(),
        serverIdentity(),
    ],
    resolve: {
        // Matched in array order. react-native has to come first so it is not caught by the react alias.
        alias: [
            { find: /^react-native$/, replacement: REACT_NATIVE_SHIM },
            // Keeps declaration files from needing to know where the preview tool actually lives.
            // Move it later and the declarations stay as they are.
            { find: /^@preview$/, replacement: `${SRC_DIR}/index.ts` },
            { find: /^@preview\//, replacement: `${SRC_DIR}/` },
            ...buildWebReplacements(),
            ...buildMobileAppAliases(),
        ],
        extensions: WEB_FIRST_EXTENSIONS,
        // The react-native field is ignored. RN packages point it at TypeScript sources
        // (src/index.ts), which sit inside node_modules and load untransformed, failing to parse.
        mainFields: ['browser', 'module', 'main'],
        // Two react instances break every hook. Pinned to one.
        dedupe: ['react', 'react-dom', 'react-native-web'],
    },
    optimizeDeps: {
        // Pre-bundling is a separate esbuild path, so it does not inherit resolve.extensions.
        // Left alone, react-native-svg gets bundled to the native side rather than the web
        // implementation (elements.web.js) and icons become empty elements.
        esbuildOptions: { resolveExtensions: WEB_FIRST_EXTENSIONS },
    },
    server: {
        fs: {
            // Target project sources and declaration files can sit outside this project root, and
            // without listing them they cannot be read.
            allow: [MOBILE_APP_ROOT, PREVIEW_ROOT, '.'],
        },
    },
    define: {
        __DEV__: JSON.stringify(true),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
});
