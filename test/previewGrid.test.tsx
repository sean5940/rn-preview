import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, test } from 'vitest';
import { definePreview, PreviewGrid } from '@preview';

const spec = definePreview({
    component: Text,
    variants: { default: { children: 'A' }, emphasis: { children: 'B' } },
    widths: [360, 390],
});

describe('PreviewGrid', () => {
    test('shows the variant name together with the width', () => {
        render(<PreviewGrid spec={spec} name={'ui/Text'} />);
        expect(screen.getByText('default · 360')).toBeTruthy();
        expect(screen.getByText('emphasis · 390')).toBeTruthy();
    });

    test('draws as many cells as variants × widths', () => {
        render(<PreviewGrid spec={spec} name={'ui/Text'} />);
        expect(screen.getAllByText('A')).toHaveLength(2);
        expect(screen.getAllByText('B')).toHaveLength(2);
    });

    test('draws a single default width when widths is absent', () => {
        const noWidth = definePreview({ component: Text, variants: { default: { children: 'C' } } });
        render(<PreviewGrid spec={noWidth} name={'ui/Text'} />);
        expect(screen.getAllByText('C')).toHaveLength(1);
    });
});
