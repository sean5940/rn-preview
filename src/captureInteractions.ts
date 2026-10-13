import type { PreviewSpec } from './definePreview.ts';

type InteractionOptions = Pick<PreviewSpec<unknown>, 'interactions' | 'states' | 'timeline' | 'filmstrip'>;

/** What the capture script presses in each state's cells, as the texts to click, in order. */
export type CaptureInteractions = Record<string, string[]>;

/**
 * Checks a declaration's `interactions` and reduces it to the texts to press.
 *
 * Every mistake is thrown while the declaration loads, so the capture stops before shooting rather
 * than writing a picture of something it never pressed.
 */
export const resolveInteractions = (spec: InteractionOptions): CaptureInteractions | undefined => {
    if (spec.interactions === undefined) return undefined;

    if (spec.timeline !== undefined || spec.filmstrip !== undefined) {
        throw new Error(
            'interactions cannot be combined with timeline or filmstrip: pressing and advancing the clock would interleave in an unspecified order.',
        );
    }

    const stateNames = Object.keys(spec.states ?? {});
    return Object.fromEntries(
        Object.entries(spec.interactions).map(([stateName, steps]) => {
            if (!stateNames.includes(stateName)) {
                throw new Error(
                    `interactions."${stateName}" is not a state. states: ${stateNames.length === 0 ? '(none)' : stateNames.join(', ')}`,
                );
            }
            const texts = steps.map((step) => {
                if (typeof step.press !== 'string' || step.press.length === 0) {
                    throw new Error(`interactions."${stateName}" has a press that is not a non-empty text.`);
                }
                return step.press;
            });
            return [stateName, texts];
        }),
    );
};

/**
 * Invisible characters that the app inserts into drawn text without changing what it says.
 * Apps that keep words from breaking across lines join every character with U+2060, so a label is
 * drawn with joiners between its characters; a declaration author types the text without them.
 */
export const INVISIBLE_TEXT_PATTERN = /[\u2060\u200B]/g;

/** Text as the author would type it: invisible joiners removed, whitespace collapsed and trimmed. */
export const normalizePressText = (text: string): string =>
    text.replace(INVISIBLE_TEXT_PATTERN, '').replace(/\s+/g, ' ').trim();

/**
 * Whether a grid cell label belongs to the given state column.
 *
 * A label is `{variant} · {state} · {scale?} · {width}` (see `PreviewGrid`), so with states
 * declared the state is always the second part.
 */
export const isCellOfState = (label: string, stateName: string): boolean => label.split(' · ')[1] === stateName;

/**
 * The failure message for a `press` that did not find exactly one text in its cell, or `undefined`
 * when it found one. Zero or several matches must stop the capture: carrying on would present a
 * picture of something that was never pressed as if it had been.
 */
export const describePressMismatch = (found: {
    stateName: string;
    cellLabel: string;
    text: string;
    count: number;
}): string | undefined => {
    if (found.count === 1) return undefined;
    const where = `interactions."${found.stateName}" press "${found.text}" in cell "${found.cellLabel}"`;
    return found.count === 0
        ? `${where}: no element with exactly this text was drawn in the cell (only the cell itself is searched).`
        : `${where}: ${found.count} elements have exactly this text in the cell; it must be unique.`;
};
