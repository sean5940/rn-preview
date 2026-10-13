import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

type Files = Record<string, unknown>;

/**
 * Lays out a throwaway RN project and loads the tool's path modules against it.
 *
 * Those modules read the target project once, when they are evaluated, so each layout gets a fresh
 * module registry.
 */
const loadAgainst = async (files: Files) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'rn-preview-')));
    const all: Files = { 'package.json': { dependencies: { 'react-native': '*' } }, ...files };
    for (const [path, content] of Object.entries(all)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), typeof content === 'string' ? content : JSON.stringify(content));
    }

    vi.stubEnv('MOBILE_APP_PATH', root);
    vi.stubEnv('PREVIEW_DIR', join(root, 'previews'));
    vi.resetModules();

    return {
        root,
        paths: await import('../src/previewPath.ts'),
        tsconfig: await import('../src/projectTsconfig.ts'),
    };
};

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('declaration paths', () => {
    test('mirror the whole project by default', async () => {
        const { root, paths } = await loadAgainst({ 'src/components/Button.tsx': '' });

        const declaration = join(root, 'previews/src/components/Button.preview.tsx');
        expect(paths.toPreviewPath(join(root, 'src/components/Button.tsx'))).toBe(declaration);
        expect(paths.toSourcePath(declaration)).toBe(join(root, 'src/components/Button.tsx'));
    });

    test('mirror the layout below sourceRoot', async () => {
        const { root, paths } = await loadAgainst({
            'previews/rn-preview.config.json': { sourceRoot: 'src' },
            'src/components/Button.tsx': '',
            'App.tsx': '',
        });

        expect(paths.toPreviewPath(join(root, 'src/components/Button.tsx'))).toBe(
            join(root, 'previews/components/Button.preview.tsx'),
        );
        expect(paths.toPreviewPath(join(root, 'App.tsx'))).toBeUndefined();
    });

    test('skip files in the declaration directory and in node_modules', async () => {
        const { root, paths } = await loadAgainst({});

        expect(paths.toPreviewPath(join(root, 'previews/_overrides/store.tsx'))).toBeUndefined();
        expect(paths.toPreviewPath(join(root, 'node_modules/some-ui/Button.tsx'))).toBeUndefined();
    });

    test('refuse a sourceRoot that does not exist', async () => {
        await expect(loadAgainst({ 'previews/rn-preview.config.json': { sourceRoot: 'lib' } })).rejects.toThrow(
            /Could not find sourceRoot/,
        );
    });
});

describe('target project tsconfig', () => {
    test('rewrites alias targets relative to the project when baseUrl is set', async () => {
        const { root, tsconfig } = await loadAgainst({
            'tsconfig.json': { compilerOptions: { baseUrl: 'src', paths: { '@components/*': ['components/*'] } } },
            'src/components/Button.tsx': '',
        });

        expect(tsconfig.readMobileAppPaths()).toEqual({ '@components/*': ['src/components/*'] });
        expect(tsconfig.readBaseUrlDirectories()).toEqual([join(root, 'src/components')]);
    });

    test('follows extends', async () => {
        const { tsconfig } = await loadAgainst({
            'tsconfig.json': { extends: './tsconfig.base.json' },
            'tsconfig.base.json': { compilerOptions: { paths: { '@/*': ['./src/*'] } } },
        });

        expect(tsconfig.readMobileAppPaths()).toEqual({ '@/*': ['src/*'] });
        expect(tsconfig.readBaseUrlDirectories()).toEqual([]);
    });

    test('has no aliases without a tsconfig', async () => {
        const { tsconfig } = await loadAgainst({});

        expect(tsconfig.readMobileAppPaths()).toEqual({});
    });
});

describe('draft imports', () => {
    test('go through an alias that covers the project root', async () => {
        const { root } = await loadAgainst({ 'tsconfig.json': { compilerOptions: { paths: { '@/*': ['./*'] } } } });
        const { toAliasSpecifier } = await import('../src/analyzeComponent.ts');

        expect(toAliasSpecifier(join(root, 'components/Button.tsx'))).toBe('@/components/Button');
    });

    test('go through baseUrl when no alias covers the file', async () => {
        const { root } = await loadAgainst({
            'tsconfig.json': { compilerOptions: { baseUrl: '.' } },
            'app/components/Button.tsx': '',
        });
        const { toAliasSpecifier } = await import('../src/analyzeComponent.ts');

        expect(toAliasSpecifier(join(root, 'app/components/Button.tsx'))).toBe('app/components/Button');
    });

    test('are relative to the declaration without an alias or baseUrl', async () => {
        const { root } = await loadAgainst({ 'components/Button.tsx': '' });
        const { toAliasSpecifier } = await import('../src/analyzeComponent.ts');

        expect(toAliasSpecifier(join(root, 'components/Button.tsx'))).toBe('../../components/Button');
    });
});
