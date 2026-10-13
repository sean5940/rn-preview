import { Text } from 'react-native';
import { describe, expect, test } from 'vitest';
import { definePreview } from '@preview';

describe('definePreview', () => {
    test('returns the declaration it was given, unchanged', () => {
        const spec = definePreview({
            component: Text,
            variants: { default: {}, bold: { style: { fontWeight: 'bold' } } },
            widths: [360, 390],
        });

        expect(spec.component).toBe(Text);
        expect(Object.keys(spec.variants)).toEqual(['default', 'bold']);
        expect(spec.widths).toEqual([360, 390]);
    });

    test('allows widths to be omitted', () => {
        const spec = definePreview({ component: Text, variants: { default: {} } });
        expect(spec.widths).toBeUndefined();
    });
});
