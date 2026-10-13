import { describe, expect, test } from 'vitest';
import { toFontFaceCss } from '@preview/appFonts.ts';

describe('toFontFaceCss', () => {
    test('takes the filename as the family name', () => {
        const css = toFontFaceCss(['/repo/ios/fonts/Pretendard-SemiBold.ttf']);

        expect(css).toContain("font-family: 'Pretendard-SemiBold'");
    });

    test('points at the route by which the dev server serves files outside the project', () => {
        const css = toFontFaceCss(['/repo/ios/fonts/Pretendard-Bold.ttf']);

        expect(css).toContain("url('/@fs/repo/ios/fonts/Pretendard-Bold.ttf')");
    });

    test('keeps the fallback from being drawn before the font arrives', () => {
        const css = toFontFaceCss(['/repo/ios/fonts/Pretendard-Regular.ttf']);

        expect(css).toContain('font-display: block');
    });

    test('URL-encodes a path containing a space', () => {
        const css = toFontFaceCss(['/My Repo/ios/fonts/Pretendard-Medium.ttf']);

        expect(css).toContain("url('/@fs/My%20Repo/ios/fonts/Pretendard-Medium.ttf')");
    });

    test('emits one line per font', () => {
        const css = toFontFaceCss(['/repo/ios/fonts/Pretendard-Regular.ttf', '/repo/ios/fonts/Pretendard-Bold.ttf']);

        expect(css.split('\n')).toHaveLength(2);
    });

    test('returns an empty string when there are no fonts', () => {
        expect(toFontFaceCss([])).toBe('');
    });
});
