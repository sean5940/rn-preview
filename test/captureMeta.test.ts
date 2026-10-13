import { describe, expect, test } from 'vitest';
import { resolveCaptureMeta } from '../src/captureMeta.ts';

describe('resolveCaptureMeta', () => {
    test('is empty for a declaration without time options, so the capture keeps its current flow', () => {
        expect(resolveCaptureMeta({})).toEqual({ timeline: undefined, now: undefined });
    });

    test('sorts the timeline and drops duplicates and negative moments', () => {
        expect(resolveCaptureMeta({ timeline: [2400, 0, 2400, -10] }).timeline).toEqual([0, 2400]);
    });

    test('expands a filmstrip into evenly spaced moments that include both ends', () => {
        expect(resolveCaptureMeta({ filmstrip: { durationMs: 500, stepMs: 200 } }).timeline).toEqual([
            0, 200, 400, 500,
        ]);
    });

    test('merges a filmstrip with an explicit timeline', () => {
        expect(resolveCaptureMeta({ timeline: [2400], filmstrip: { durationMs: 200, stepMs: 100 } }).timeline).toEqual([
            0, 100, 200, 2400,
        ]);
    });

    test('passes a fixed clock through as epoch milliseconds', () => {
        expect(resolveCaptureMeta({ now: '2026-10-06T10:00:00+09:00' }).now).toBe(Date.parse('2026-10-06T01:00:00Z'));
    });

    test('rejects a clock it cannot parse instead of capturing at an unknown time', () => {
        expect(() => resolveCaptureMeta({ now: 'tomorrow' })).toThrow(/now/);
    });

    test('rejects a filmstrip whose step would never finish', () => {
        expect(() => resolveCaptureMeta({ filmstrip: { durationMs: 1000, stepMs: 0 } })).toThrow(/stepMs/);
    });
});
