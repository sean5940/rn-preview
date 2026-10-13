import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, test, vi } from 'vitest';
import { definePreview } from '@preview';

const badge = definePreview({ component: Text, variants: { default: { children: 'Badge' } } });
const button = definePreview({ component: Text, variants: { default: { children: 'Button' } } });

vi.mock('../src/loadPreviews.ts', () => ({
    loadPreviewLoaders: () => ({
        'ui/Badge': () => Promise.resolve({ default: badge }),
        'ui/Button': () => Promise.resolve({ default: button }),
        // A declaration referencing a module absent on that branch. One breaking must not take down the rest.
        'ui/Broken': () => Promise.reject(new Error('Failed to resolve import "@data/gone"')),
    }),
    loadPreviewFiles: () => ({
        'ui/Badge': '/repo/previews/ui/Badge.preview.tsx',
        'ui/Button': '/repo/previews/ui/Button.preview.tsx',
        'ui/Broken': '/repo/previews/ui/Broken.preview.tsx',
    }),
}));

const { App } = await import('../src/App.tsx');

describe('App', () => {
    test('shows declaration names in the list', () => {
        render(<App />);
        expect(screen.getByText('ui/Badge')).toBeTruthy();
        expect(screen.getByText('ui/Button')).toBeTruthy();
    });

    test('draws the first declaration', async () => {
        render(<App />);
        expect(await screen.findByText('Badge')).toBeTruthy();
    });

    test('says so while loading', () => {
        render(<App />);
        expect(screen.getByText('Loading…')).toBeTruthy();
    });
});
