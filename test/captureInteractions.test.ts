import { describe, expect, test } from 'vitest';
import {
    describePressMismatch,
    isCellOfState,
    normalizePressText,
    resolveInteractions,
} from '../src/captureInteractions.ts';
import { resolveCaptureMeta } from '../src/captureMeta.ts';

describe('resolveInteractions', () => {
    test('is undefined for a declaration without interactions', () => {
        expect(resolveInteractions({ states: { a: [] } })).toBeUndefined();
    });

    test('reduces each state to the texts to press, in order', () => {
        expect(
            resolveInteractions({
                states: { before: [], after: [] },
                interactions: { after: [{ press: '더보기' }, { press: '접기' }] },
            }),
        ).toEqual({ after: ['더보기', '접기'] });
    });

    test('rejects a key that is not a state, naming the states that exist', () => {
        expect(() =>
            resolveInteractions({ states: { before: [] }, interactions: { after: [{ press: 'x' }] } }),
        ).toThrow(/"after" is not a state.*before/);
    });

    test('rejects interactions when the declaration has no states at all', () => {
        expect(() => resolveInteractions({ interactions: { after: [{ press: 'x' }] } })).toThrow(/\(none\)/);
    });

    test('rejects an empty press text', () => {
        expect(() => resolveInteractions({ states: { a: [] }, interactions: { a: [{ press: '' }] } })).toThrow(
            /non-empty/,
        );
    });

    test.each([
        { label: 'timeline', extra: { timeline: [0] } },
        { label: 'filmstrip', extra: { filmstrip: { durationMs: 100, stepMs: 50 } } },
    ])('rejects use together with $label', ({ extra }) => {
        expect(() =>
            resolveInteractions({ states: { a: [] }, interactions: { a: [{ press: 'x' }] }, ...extra }),
        ).toThrow(/timeline or filmstrip/);
    });

    test('is carried to the capture script through the capture meta', () => {
        expect(resolveCaptureMeta({ states: { a: [] }, interactions: { a: [{ press: 'x' }] } }).interactions).toEqual({
            a: ['x'],
        });
    });
});

describe('normalizePressText', () => {
    test('removes the word joiners that unbreakable-word text is drawn with', () => {
        expect(normalizePressText('지\u2060금 바\u2060로 시\u2060작')).toBe('지금 바로 시작');
    });

    test('collapses whitespace and trims', () => {
        expect(normalizePressText('  더보기 \n ')).toBe('더보기');
    });
});

describe('isCellOfState', () => {
    test.each([
        { label: 'default · after · 375', state: 'after', expected: true },
        { label: 'default · after · text x1.3 · 375', state: 'after', expected: true },
        { label: 'default · before · 375', state: 'after', expected: false },
        { label: 'after · before · 375', state: 'after', expected: false },
    ])('$label vs $state', ({ label, state, expected }) => {
        expect(isCellOfState(label, state)).toBe(expected);
    });
});

describe('describePressMismatch', () => {
    const base = { stateName: 'after', cellLabel: 'default · after · 375', text: '더보기' };

    test('accepts exactly one match', () => {
        expect(describePressMismatch({ ...base, count: 1 })).toBeUndefined();
    });

    test('names the state, cell and text when nothing matches', () => {
        const message = describePressMismatch({ ...base, count: 0 });
        expect(message).toContain('"after"');
        expect(message).toContain('default · after · 375');
        expect(message).toContain('더보기');
        expect(message).toMatch(/no element/);
    });

    test('reports the count when several match', () => {
        expect(describePressMismatch({ ...base, count: 2 })).toMatch(/2 elements/);
    });
});
