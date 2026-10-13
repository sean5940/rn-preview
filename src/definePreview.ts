import type { ComponentType } from 'react';
import type { FontScale } from './fontScale.ts';
import type { LottieFrame } from './previewLottie.tsx';

/**
 * A fixed server response. `key` is React Query's queryKey verbatim.
 *
 * A screen varies by more than success: loading and error are states too. All three are chosen in
 * the same place.
 *
 * - `{ key, data }`: treat that response as having arrived.
 * - `{ key, pending: true }`: a request that never finishes. The loading view stands in its place.
 * - `{ key, error }`: a failed request. Even `isLoadingError`, which the screen reads, matches the
 *   real flow.
 *
 * Any query not listed here **really does go to the server.** A preview has no authentication, so
 * that usually errors, and since that is also a state worth seeing it is not blocked.
 */
export type PreviewMockQuery =
    | { key: readonly unknown[]; data: unknown }
    | { key: readonly unknown[]; error: unknown }
    | { key: readonly unknown[]; pending: true };

/** One operation performed before a capture. `press` is the exact text drawn inside the cell. */
export type PreviewInteraction = { press: string };

export type PreviewSpec<P> = {
    /** The component to draw. Imported by direct path, not through a design-system barrel. */
    component: ComponentType<P>;
    /**
     * Variant name -> the props for that variant. The **rows** of the grid.
     *
     * This is the axis where props decide appearance. Screens take almost no props, so usually
     * there is a single `default: {}`; components list whatever you want to compare, such as type,
     * size, or state.
     */
    variants: Record<string, Partial<P>>;
    /**
     * States that differ by server response. The **columns** of the grid.
     *
     * A screen varies by data rather than props. Responses listed here are layered over
     * `mockQueries`, and variant × state renders side by side in one row. Repeat a key and the last
     * one wins.
     */
    states?: Record<string, PreviewMockQuery[]>;
    /** Server responses shared by every variant and state. For things you would rather not repeat per state. */
    mockQueries?: PreviewMockQuery[];
    /** Values to pass through route. Used when a screen reads `route.params`. */
    route?: { name: string; params?: Record<string, unknown> };
    /**
     * A/B test assignment. `{ checkout_redesign: 'A' }`
     *
     * A preview treats any experiment not listed as the exposed group (`'B'`). What you usually
     * want to see is the side being built behind the flag, and with the unexposed group the screen
     * becomes a blank cell without the reason surfacing. Name the other side here to see it.
     */
    abTestGroups?: Record<string, string>;
    /** Device widths to draw side by side. Omitted, the default device width (375) is used. For checking narrow devices. */
    widths?: number[];
    /**
     * Safe-area insets. Omitted, notched-device values (top 44 · bottom 34) are used.
     *
     * A home-button device is `{ top: 20, bottom: 0 }`. Set this to check whether a bottom fixed
     * button is hidden behind the home indicator, or whether padding falls short on a device whose
     * inset is 0. Only the keys you give are overridden.
     */
    insets?: Partial<{ top: number; bottom: number; left: number; right: number }>;
    /**
     * Overlays the status bar and home indicator on the screen. On by default for `*Screen`
     * declarations and sheets.
     *
     * Whether a bottom fixed button collides with the home indicator, or a top element runs under
     * the status bar, shows up in the render. It is excluded from a capture's geometry comparison.
     *
     * Off by default for screen body components. On a device they sit below the navigation header,
     * which a preview does not have, so drawing the band leaves an overlap in the capture that does
     * not exist on a device. Turn it on when you are sure that component occupies the whole screen.
     */
    platformChrome?: boolean;
    /**
     * OS text scales to draw side by side. Omitted, a single cell is drawn unscaled (1).
     *
     * Write `[1, 1.3]` and a cell enlarged by that scale is placed alongside. Font size and line
     * height grow together, so elements nested inside cards scale too. A number scales linearly,
     * as iOS and Android 13 and below do (iOS steps are 1.118, 1.235, 1.353). Android 14 and later
     * scale along a curve that grows large text less; write `{ scale: 1.3, curve: 'android14' }` for
     * that device. Text with `allowFontScaling={false}` or `maxFontSizeMultiplier` is honoured.
     */
    fontScales?: FontScale[];
    /**
     * Cell height. Omitted, the default device height (795) is used.
     *
     * A bottom sheet is anchored to the bottom of the cell and grows upward, so the device height
     * clips its content. A preview exists to show layout and copy, so clipping is unacceptable;
     * turning on `openOnMount` therefore substitutes a roomier default. Either way, a value given
     * here wins.
     */
    height?: number;
    /** Cell background colour. For seeing what a white background hides, such as white cards and shadows. */
    background?: string;
    /**
     * Open it after mounting so it is visible.
     *
     * A bottom sheet opens via `ref.show()`. Without opening it, a preview shows nothing. What you
     * have to press to open it is the screen's business; here only the open geometry is shown.
     */
    openOnMount?: boolean;
    /**
     * Which frame Lottie animations show. Omitted, the last frame.
     *
     * Stopping on a frame makes every capture show the same picture; the last frame is the end
     * state a design frame usually draws, while the first is often empty because the artwork
     * animates in. `'play'` plays on the page clock; pair it with `timeline` to see a given moment.
     */
    lottieFrame?: LottieFrame;
    /**
     * Moments to capture, in milliseconds after the declaration finished loading. `[0, 2400]`
     *
     * A screen that changes on a timer (an intro that hides itself, a toast, a delayed tooltip)
     * otherwise races the capture: whichever side of the timer the shot lands on depends on how long
     * the page took to load. With a timeline the capture runs the page on a stopped clock and only
     * advances it to each moment, so every run shows the same frame. Each moment is saved as its own
     * `{name}@{ms}ms.png`. Viewing in a browser or editor is unaffected.
     */
    timeline?: number[];
    /**
     * Evenly spaced moments for watching a transition: a frame every `stepMs` up to `durationMs`.
     * Merged with `timeline`. Keep it short; every frame is a separate shot.
     */
    filmstrip?: { durationMs: number; stepMs: number };
    /**
     * State name -> operations to perform in every cell of that column right before the capture.
     * `{ expanded: [{ press: 'More' }] }`
     *
     * For a branch the component decides by its own `useState` (a tab, an expansion, a selection),
     * which no prop or response can reach. The key is a name from `states`; to see the picture
     * before pressing as well, give the same `mockQueries` to one more state. `press` is the exact
     * text drawn in the cell and only that cell is searched. The capture really clicks it, waits
     * for animations to settle, then moves on to the next operation. When the text is absent or
     * appears more than once, the capture fails and names the state, cell and text instead of
     * shooting something that was never pressed. Geometry is taken after the operations.
     * Viewing in a browser or editor presses the same texts with dispatched pointer events and
     * marks the cell when a text is missing or not unique. It cannot be combined with `timeline` or
     * `filmstrip`.
     */
    interactions?: Record<string, PreviewInteraction[]>;
    /**
     * The date the page's clock starts from during a capture. `'2026-10-06T10:00:00+09:00'`
     *
     * For screens that read today's date (calendars, "N days left"). Without it a capture taken
     * tomorrow differs from today's. Viewing in a browser or editor is unaffected.
     */
    now?: string;
};

/**
 * Creates a preview declaration.
 *
 * **Read it as a grid.** `variants` are the rows (the props axis) and `states` the columns (the
 * data axis), and every combination renders side by side on one screen. Which of the two something
 * belongs in follows from what you want to compare.
 *
 * query, navigation, and safe area are always wrapped. They are always present at an app's root on
 * a device, and a declaration cannot know in advance which hooks are called several levels down.
 *
 * ```tsx
 * export default definePreview({
 *     component: SubscriptionScreen,
 *     variants: { default: {} },
 *     states: {
 *         active: [{ key: subscriptionQueries.getStatus().queryKey, data: 'active' }],
 *         loading: [{ key: subscriptionQueries.getStatus().queryKey, pending: true }],
 *     },
 * });
 * ```
 *
 * **JSX is not accepted.** Even `wrappers` takes only provider names. Put JSX in a declaration and
 * the renderer is decided right there, which means rewriting every declaration when a native
 * renderer is added for pixel-exact work.
 *
 * There is no way to swap hooks directly. Data goes through `mockQueries` and `states`, flags
 * through `abTestGroups`. Any name not listed here is caught by type checking.
 */
export const definePreview = <P>(spec: PreviewSpec<P>): PreviewSpec<P> => spec;
