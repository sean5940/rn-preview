import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';

// The suite targets the fixture project, so it passes in a fresh clone with no RN app beside it and
// gives the same result on every machine. The target is decided when the Vite config is evaluated,
// so this has to be set before that import.
delete process.env.RN_PREVIEW_CONFIG;
process.env.MOBILE_APP_PATH = fileURLToPath(new URL('./test/fixture-app', import.meta.url));
process.env.PREVIEW_DIR = fileURLToPath(new URL('./test/fixture-app/previews', import.meta.url));

const { default: viteConfig } = await import('./vite.config.ts');

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: 'jsdom',
            globals: false,
            setupFiles: ['./test/setup.ts'],
            server: {
                deps: {
                    // Everything is transformed by Vite. Externalized, Node reads the file as is,
                    // and target project sources are TypeScript while some RN packages are Flow,
                    // so parsing blocks. This also keeps the transform path identical to the
                    // browser build, so results do not diverge.
                    inline: true,
                },
            },
        },
    }),
);
