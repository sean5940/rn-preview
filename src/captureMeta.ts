import { resolveInteractions, type CaptureInteractions } from './captureInteractions.ts';
import type { PreviewSpec } from './definePreview.ts';

/**
 * What the capture script needs to know about the loaded declaration's time axis.
 *
 * `timeline` lists the moments, in milliseconds after the declaration finished loading, at which
 * to shoot. `now` is the epoch the page's clock starts from. Both undefined means the declaration
 * did not ask for a controlled clock and the capture keeps its usual flow. `interactions` are the
 * texts to press in each state's cells before shooting.
 */
export type CaptureMeta = {
    timeline: number[] | undefined;
    now: number | undefined;
    interactions: CaptureInteractions | undefined;
};

type TimeOptions = Pick<PreviewSpec<unknown>, 'timeline' | 'filmstrip' | 'now' | 'interactions' | 'states'>;

/** The name the capture script reads the meta under. */
export const CAPTURE_META_KEY = '__rnPreviewCaptureMeta';

/**
 * Set on `window` by the capture script before any page script runs. The capture presses
 * `interactions` with real clicks itself, so cells must not press them a second time.
 */
export const CAPTURING_FLAG = '__rnPreviewCapturing';

const expandFilmstrip = ({ durationMs, stepMs }: NonNullable<TimeOptions['filmstrip']>): number[] => {
    if (!(stepMs > 0)) throw new Error(`filmstrip.stepMs must be greater than 0 (got ${stepMs})`);
    const moments = Array.from({ length: Math.floor(durationMs / stepMs) + 1 }, (_, index) => index * stepMs);
    return [...moments, durationMs];
};

export const resolveCaptureMeta = (spec: TimeOptions): CaptureMeta => {
    const moments = [
        ...(spec.timeline ?? []),
        ...(spec.filmstrip === undefined ? [] : expandFilmstrip(spec.filmstrip)),
    ];
    const interactions = resolveInteractions(spec);
    const timeline =
        moments.length === 0 ? undefined : [...new Set(moments.filter((ms) => ms >= 0))].sort((a, b) => a - b);

    if (spec.now === undefined) return { timeline, now: undefined, interactions };
    const now = Date.parse(spec.now);
    if (Number.isNaN(now)) throw new Error(`now must be a date string Date.parse understands (got "${spec.now}")`);
    return { timeline, now, interactions };
};

/** Exposes the loaded declaration's time axis to the capture script. Cleared when a declaration fails to load. */
export const publishCaptureMeta = (meta: CaptureMeta | undefined): void => {
    (window as unknown as Record<string, unknown>)[CAPTURE_META_KEY] = meta;
};
