import { describe, expect, test } from 'vitest';
import { isCellLabel } from '../src/cellLabel.ts';

describe('isCellLabel', () => {
    test.each([
        { text: '기본 · 375', expected: true, label: 'a label ending in a whole width is a cell' },
        {
            text: '기본 · 로딩 · text x1.3 · 375',
            expected: true,
            label: 'state and scale parts before the width still make a cell',
        },
        { text: 'quote-selected · 161.5', expected: true, label: 'a fractional width is a cell too' },
        { text: '기본 · text x1.3', expected: false, label: 'a label without a trailing width is not a cell' },
        { text: '주문 취소 · 환불 예정', expected: false, label: 'screen copy with a middle dot is not a cell' },
    ])('$label', ({ text, expected }) => {
        expect(isCellLabel(text)).toBe(expected);
    });
});
