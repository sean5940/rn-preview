/**
 * OS text scale for a cell.
 *
 * A number is a linear scale: font size and line height are multiplied by it. That is how iOS and
 * Android 13 and below scale text. iOS has no 1.3 step; its steps are 1.118, 1.235 and 1.353.
 *
 * `{ scale, curve: 'android14' }` follows Android 14 and later, which scale text along a curve
 * so large text grows less: at 1.3, 20sp becomes 23.6dp rather than 26. A linear 1.3 cell wraps
 * lines that an Android 14 device at 1.3 keeps on one.
 */
export type FontScale = number | { scale: number; curve: 'android14' };

export type ResolvedFontScale = { scale: number; curve: 'linear' | 'android14'; label: string };

/** `FontScaleConverterFactory` (Android SDK 37): the sp values each table maps. */
const ANDROID_FROM_SP = [8, 10, 12, 14, 18, 20, 24, 30, 100];

/** `FontScaleConverterFactory` (Android SDK 37): the dp each sp becomes, per scale. */
const ANDROID_TO_DP: Record<string, number[]> = {
    '1.05': [8.4, 10.5, 12.6, 14.8, 18.6, 20.6, 24.4, 30, 100],
    '1.1': [8.8, 11, 13.2, 15.6, 19.2, 21.2, 24.8, 30, 100],
    '1.15': [9.2, 11.5, 13.8, 16.4, 19.8, 21.8, 25.2, 30, 100],
    '1.2': [9.6, 12, 14.4, 17.2, 20.4, 22.4, 25.6, 30, 100],
    '1.3': [10.4, 13, 15.6, 18.8, 21.6, 23.6, 26.4, 30, 100],
    '1.5': [12, 15, 18, 22, 24, 26, 28, 30, 100],
    '1.8': [14.4, 18, 21.6, 24.4, 27.6, 30.8, 32.8, 34.8, 100],
    '2': [16, 20, 24, 26, 30, 34, 36, 38, 100],
};

export const resolveFontScale = (value: FontScale): ResolvedFontScale => {
    if (typeof value === 'number') return { scale: value, curve: 'linear', label: `text x${value}` };
    if (ANDROID_TO_DP[String(value.scale)] === undefined) {
        const supported = Object.keys(ANDROID_TO_DP).join(', ');
        throw new Error(`Android 14 has no text-scale table for ${value.scale}. Use one of ${supported}.`);
    }
    return { scale: value.scale, curve: 'android14', label: `text x${value.scale} android14` };
};

/** `FontScaleConverterImpl.lookupAndInterpolate`: linear between table entries, from 0 below the first. */
const androidCurve = (sp: number, scale: number): number => {
    const toDp = ANDROID_TO_DP[String(scale)] as number[];
    const last = ANDROID_FROM_SP.length - 1;
    if (sp >= (ANDROID_FROM_SP[last] as number))
        return sp * ((toDp[last] as number) / (ANDROID_FROM_SP[last] as number));
    const upper = ANDROID_FROM_SP.findIndex((from) => from >= sp);
    const [fromLow, toLow] = upper === 0 ? [0, 0] : [ANDROID_FROM_SP[upper - 1] as number, toDp[upper - 1] as number];
    const [fromHigh, toHigh] = [ANDROID_FROM_SP[upper] as number, toDp[upper] as number];
    return toLow + ((sp - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow);
};

/** A `maxFontSizeMultiplier` below 1 (including RN's 0) means no cap. */
const capOf = (maxMultiplier: number | undefined): number =>
    maxMultiplier !== undefined && maxMultiplier >= 1 ? maxMultiplier : Infinity;

export const scaleFontSize = (
    size: number,
    fontScale: ResolvedFontScale,
    maxMultiplier: number | undefined,
): number => {
    const cap = size * capOf(maxMultiplier);
    const scaled = fontScale.curve === 'android14' ? androidCurve(size, fontScale.scale) : size * fontScale.scale;
    return Math.min(scaled, cap);
};

/**
 * Android converts line height along the curve without the cap (`TextAttributeProps`); iOS applies
 * one multiplier, cap included, to both. The linear scale follows iOS.
 */
export const scaleLineHeight = (
    lineHeight: number,
    fontScale: ResolvedFontScale,
    maxMultiplier: number | undefined,
): number =>
    fontScale.curve === 'android14'
        ? androidCurve(lineHeight, fontScale.scale)
        : lineHeight * Math.min(fontScale.scale, capOf(maxMultiplier));

/**
 * Mimics the OS text scale on the elements of a cell.
 *
 * rn-web emits font sizes baked in as px, so raising the root font-size grows nothing. Instead each
 * element's own size is rescaled. Text that opted out (`allowFontScaling={false}`) or set
 * `maxFontSizeMultiplier` is honoured through the markers the `Text` shim leaves on the DOM; a
 * nested text inherits them from its parent, as on a device.
 *
 * The original value is recorded on the element and every calculation starts from there. Computing
 * from an already-scaled value compounds the scale from the second call on.
 */
export const applyFontScale = (node: unknown, fontScale: ResolvedFontScale): void => {
    const root = node as HTMLElement | null;
    if (root?.querySelectorAll === undefined) return;

    for (const element of [root, ...root.querySelectorAll('*')] as HTMLElement[]) {
        if (element.style === undefined) continue;

        const computed = getComputedStyle(element);
        const baseFont = Number(element.dataset.baseFontSize ?? parseFloat(computed.fontSize));
        const baseLine = Number(element.dataset.baseLineHeight ?? parseFloat(computed.lineHeight));
        element.dataset.baseFontSize = String(baseFont);
        element.dataset.baseLineHeight = String(baseLine);

        const optedOut = element.closest('[data-font-scaling]')?.getAttribute('data-font-scaling') === 'off';
        const effective = optedOut ? resolveFontScale(1) : fontScale;
        const maxAttribute = element.closest('[data-max-font-scale]')?.getAttribute('data-max-font-scale');
        const maxMultiplier = maxAttribute == null ? undefined : Number(maxAttribute);

        if (Number.isFinite(baseFont))
            element.style.fontSize = `${scaleFontSize(baseFont, effective, maxMultiplier)}px`;
        // An unspecified line height is `normal`, which is not a number. Then only the font size grows.
        if (Number.isFinite(baseLine)) {
            element.style.lineHeight = `${scaleLineHeight(baseLine, effective, maxMultiplier)}px`;
        }
    }
};
