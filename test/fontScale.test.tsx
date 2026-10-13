import { render } from '@testing-library/react';
import { Animated, Text, TextInput } from 'react-native';
import { describe, expect, test } from 'vitest';
import { applyFontScale, resolveFontScale, scaleFontSize, scaleLineHeight } from '../src/fontScale.ts';

const ANDROID_14 = resolveFontScale({ scale: 1.3, curve: 'android14' });
const LINEAR = resolveFontScale(1.3);

describe('resolveFontScale', () => {
    test('a number is a linear scale, labelled as before', () => {
        expect(LINEAR).toEqual({ scale: 1.3, curve: 'linear', label: 'text x1.3' });
    });

    test('the Android 14 curve is labelled so the cell says which device it stands for', () => {
        expect(ANDROID_14.label).toBe('text x1.3 android14');
    });

    test('rejects an Android 14 scale the OS has no table for', () => {
        expect(() => resolveFontScale({ scale: 1.25, curve: 'android14' })).toThrow(/1.25/);
    });
});

describe('Android 14 curve (FontScaleConverterFactory, 1.3 table)', () => {
    test.each([
        [20, 23.6],
        [12, 15.6],
        [16, 20.2],
        [4, 5.2],
        [120, 120],
    ])('%ssp becomes %sdp', (sp, dp) => {
        expect(scaleFontSize(sp, ANDROID_14, undefined)).toBeCloseTo(dp, 5);
    });

    test('line height follows the same curve', () => {
        expect(scaleLineHeight(28, ANDROID_14, undefined)).toBeCloseTo(28.8, 5);
    });

    test('maxFontSizeMultiplier caps the font size but not the line height, as RN does on Android', () => {
        expect(scaleFontSize(20, ANDROID_14, 1.1)).toBeCloseTo(22, 5);
        expect(scaleLineHeight(28, ANDROID_14, 1.1)).toBeCloseTo(28.8, 5);
    });
});

describe('linear scale', () => {
    test('multiplies size and line height', () => {
        expect(scaleFontSize(20, LINEAR, undefined)).toBeCloseTo(26, 5);
        expect(scaleLineHeight(28, LINEAR, undefined)).toBeCloseTo(36.4, 5);
    });

    test('maxFontSizeMultiplier caps both, as one multiplier does on iOS', () => {
        expect(scaleFontSize(20, LINEAR, 1.2)).toBeCloseTo(24, 5);
        expect(scaleLineHeight(28, LINEAR, 1.2)).toBeCloseTo(33.6, 5);
    });

    test('a multiplier below 1 means no cap', () => {
        expect(scaleFontSize(20, LINEAR, 0)).toBeCloseTo(26, 5);
    });
});

describe('applyFontScale', () => {
    const textOf = (container: HTMLElement, text: string): HTMLElement =>
        [...container.querySelectorAll<HTMLElement>('*')].find(
            (el) => el.textContent === text && el.children.length === 0,
        )!;

    test('leaves text that opted out of font scaling alone', () => {
        const { container } = render(
            <>
                <Text style={{ fontSize: 20, lineHeight: 28 }}>scales</Text>
                <Text allowFontScaling={false} style={{ fontSize: 20, lineHeight: 28 }}>
                    fixed
                </Text>
            </>,
        );
        applyFontScale(container, LINEAR);
        expect(textOf(container, 'scales').style.fontSize).toBe('26px');
        expect(textOf(container, 'fixed').style.fontSize).toBe('20px');
    });

    test('caps text that sets maxFontSizeMultiplier', () => {
        const { container } = render(
            <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 20, lineHeight: 28 }}>
                capped
            </Text>,
        );
        applyFontScale(container, LINEAR);
        expect(textOf(container, 'capped').style.fontSize).toBe('22px');
    });

    test('a nested text inherits the parent opting out', () => {
        const { container } = render(
            <Text allowFontScaling={false} style={{ fontSize: 20, lineHeight: 28 }}>
                <Text style={{ fontSize: 14, lineHeight: 20 }}>inner</Text>
            </Text>,
        );
        applyFontScale(container, LINEAR);
        expect(textOf(container, 'inner').style.fontSize).toBe('14px');
    });
});

describe('font scaling markers', () => {
    test('Animated.Text leaves the opt-out on the DOM like Text does', () => {
        const { container } = render(<Animated.Text allowFontScaling={false}>animated</Animated.Text>);
        expect(container.querySelector('[data-font-scaling="off"]')?.textContent).toBe('animated');
    });

    test('TextInput leaves its cap on the DOM', () => {
        const { container } = render(<TextInput maxFontSizeMultiplier={1.2} defaultValue={'typed'} />);
        expect(container.querySelector('[data-max-font-scale="1.2"]')).not.toBeNull();
    });
});
