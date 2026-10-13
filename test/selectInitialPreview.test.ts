import { describe, expect, test } from 'vitest';
import { selectInitialPreview } from '@preview/selectInitialPreview.ts';

const files = {
    'ui/Badge': '/repo/previews/ui/Badge.preview.tsx',
    'ui/Button': '/repo/previews/ui/Button.preview.tsx',
};
const names = Object.keys(files);

describe('selectInitialPreview', () => {
    test('picks the alphabetically first declaration when there is no query', () => {
        expect(selectInitialPreview(names, files, '')).toBe('ui/Badge');
    });

    test('picks the declaration whose path matches the file query', () => {
        const search = `?file=${encodeURIComponent(files['ui/Button'])}`;
        expect(selectInitialPreview(names, files, search)).toBe('ui/Button');
    });

    test('falls back to the first declaration when the path is not in the list', () => {
        expect(selectInitialPreview(names, files, '?file=/repo/previews/missing.preview.tsx')).toBe('ui/Badge');
    });

    test('returns an empty string when there are no declarations', () => {
        expect(selectInitialPreview([], {}, '')).toBe('');
    });
});
