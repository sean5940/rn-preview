import React from 'react';

/**
 * Which frame a Lottie animation shows in a preview.
 *
 * `'first' | 'middle' | 'last'` or a frame number stops the animation there, so every capture
 * shows the same picture. `'play'` plays it on the page clock; pair it with `timeline` to see it at
 * a given moment.
 */
export type LottieFrame = 'first' | 'middle' | 'last' | 'play' | number;

/**
 * The last frame by default. An intro's first frame is often empty because the artwork animates
 * in, and the end state is what the design frame shows.
 */
const DEFAULT_FRAME: LottieFrame = 'last';

const LottieFrameContext = React.createContext<LottieFrame>(DEFAULT_FRAME);

type Props = { frame: LottieFrame | undefined; children: React.ReactNode };

export const LottieFrameProvider = ({ frame, children }: Props) => (
    <LottieFrameContext.Provider value={frame ?? DEFAULT_FRAME}>{children}</LottieFrameContext.Provider>
);

export const useLottieFrame = (): LottieFrame => React.useContext(LottieFrameContext);

/** The frame to stop on, or undefined to let it play. */
export const resolveLottieFrame = (frame: LottieFrame, totalFrames: number): number | undefined => {
    if (frame === 'play') return undefined;
    if (frame === 'first') return 0;
    if (frame === 'middle') return Math.floor(totalFrames / 2);
    if (frame === 'last') return Math.max(0, totalFrames - 1);
    return frame;
};
