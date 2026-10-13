import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { definePreview, PreviewGrid } from '@preview';
import { Greeting } from './fixture-app/src/components/Greeting';
import { StarIcon } from './fixture-app/src/components/StarIcon';

/**
 * Imports through the fixture's own tsconfig alias.
 *
 * Passed as a runtime string so only the bundler resolves it. The tool's tsconfig carries the aliases
 * of whichever project the developer usually targets, not the fixture's.
 */
const importThroughAlias = (specifier: string): Promise<Record<string, unknown>> =>
    import(/* @vite-ignore */ specifier);

// Runs against test/fixture-app: an Expo-style layout with code under `src/` and a `@/*` alias, with
// none of React Query, React Navigation, or safe-area-context installed.
describe('target project source resolution', () => {
    test('resolves through a tsconfig alias', async () => {
        const module = await importThroughAlias('@/components/Greeting');
        expect(module.Greeting).toBe(Greeting);
    });

    test('draws an icon as svg', () => {
        // Checks only that react-native-svg's web implementation resolves through the .web.* extension.
        const { container } = render(<StarIcon size={24} />);
        expect(container.querySelector('svg')).toBeTruthy();
    });

    test('draws a cell in an app that lacks the packages the preview providers import', () => {
        const spec = definePreview({ component: Greeting, variants: { default: { name: 'Grace' } } });
        render(<PreviewGrid spec={spec} name={'components/Greeting'} />);
        expect(screen.getByText('Hello, Grace')).toBeTruthy();
    });
});
