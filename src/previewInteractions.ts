import { CAPTURING_FLAG } from './captureMeta.ts';
import { normalizePressText } from './captureInteractions.ts';

/** Waits for a sheet opened on mount to finish opening, after the last sheet scroll fixup. */
export const FIRST_PRESS_DELAY_MS = 800;
/** Lets the state a press set settle before the next press looks for its text. */
export const NEXT_PRESS_DELAY_MS = 300;

/** Whether the capture script is driving this page. */
export const isCapturing = (): boolean =>
    typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)[CAPTURING_FLAG] === true;

/**
 * The innermost elements under `root` whose drawn text is exactly `wanted`. An outer wrapper of the
 * same text does not count as a second match.
 */
export const findTextElements = (root: Element, wanted: string): Element[] => {
    const target = normalizePressText(wanted);
    return [...root.querySelectorAll('*')].filter(
        (element) =>
            normalizePressText(element.textContent ?? '') === target &&
            ![...element.children].some((child) => normalizePressText(child.textContent ?? '') === target),
    );
};

/** react-native-web gives a pressable a tab index of zero or more. */
const closestPressable = (element: Element, root: Element): HTMLElement | undefined => {
    for (
        let current: Element | null = element;
        current !== null && root.contains(current);
        current = current.parentElement
    ) {
        if (current instanceof HTMLElement && current.tabIndex >= 0) return current;
    }
    return undefined;
};

/** The sequence react-native-web's press handling responds to. */
const PRESS_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];

/**
 * Presses the one pressable in `root` drawn with `text`, for viewing in a browser or editor.
 *
 * The capture uses real clicks instead; this dispatches the events a pointer would. Returns why
 * nothing was pressed, or `undefined` after pressing.
 */
export const pressText = (root: Element, text: string): string | undefined => {
    const matches = findTextElements(root, text);
    if (matches.length !== 1) {
        return matches.length === 0
            ? `press "${text}": not drawn in this cell`
            : `press "${text}": drawn ${matches.length} times in this cell; it must be unique`;
    }
    const target = closestPressable(matches[0], root);
    if (target === undefined) return `press "${text}": nothing pressable around this text`;
    PRESS_EVENTS.forEach((type) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })));
    return undefined;
};
