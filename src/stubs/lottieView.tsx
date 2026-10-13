import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import lottie from 'lottie-web/build/player/lottie_svg';
import { resolveLottieFrame, useLottieFrame } from '../previewLottie.tsx';

/**
 * Stands in for `lottie-react-native`, drawing the animation with lottie-web's SVG renderer.
 *
 * The package's own web implementation does not fit a preview for two reasons. It never reads the
 * React Native `style` (only `webStyle`), so the block loses the size it has on a device: a spinner
 * cell measured 162 against 192 on a device. And it draws through an optional peer that is not
 * installed. Here the block takes the given `style` and the artwork fills it, so the geometry
 * matches a device (spinner cell 194 = 192 + the 2px cell border, intro 110 × 110).
 *
 * Load failures are not forwarded. A screen that hides an intro when its animation fails to load
 * would otherwise switch state because of the tool, not the code under review.
 */

type AnimationItem = ReturnType<typeof lottie.loadAnimation>;

type ResizeMode = 'contain' | 'cover' | 'center';

const ASPECT: Record<ResizeMode, string> = {
    contain: 'xMidYMid meet',
    cover: 'xMidYMid slice',
    center: 'xMidYMid meet',
};

type RemoteSource = string | { uri: string };
type Source = RemoteSource | Record<string, unknown>;

type Props = {
    source: Source;
    style?: unknown;
    autoPlay?: boolean;
    loop?: boolean;
    speed?: number;
    resizeMode?: ResizeMode;
    onAnimationLoaded?: () => void;
    onAnimationFinish?: (isCancelled: boolean) => void;
    onAnimationFailure?: (error: string) => void;
};

const isAnimationData = (source: Source): source is Record<string, unknown> =>
    typeof source === 'object' && !('uri' in source);

const toPath = (source: RemoteSource): string => (typeof source === 'string' ? source : source.uri);

const LottieView = forwardRef<unknown, Props>(
    (
        { source, style, autoPlay, loop = true, speed, resizeMode = 'contain', onAnimationLoaded, onAnimationFinish },
        ref,
    ) => {
        const frame = useLottieFrame();
        const hostRef = useRef<HTMLElement | null>(null);
        const itemRef = useRef<AnimationItem | null>(null);

        useImperativeHandle(ref, () => ({
            play: () => itemRef.current?.play(),
            pause: () => itemRef.current?.pause(),
            resume: () => itemRef.current?.play(),
            reset: () => itemRef.current?.goToAndStop(0, true),
        }));

        useEffect(() => {
            const container = hostRef.current;
            if (container === null) return undefined;

            const playing = frame === 'play';
            const item = lottie.loadAnimation({
                container,
                renderer: 'svg',
                loop: playing ? loop : false,
                autoplay: playing ? autoPlay === true : false,
                // The player mutates animationData, and several cells share the same imported JSON.
                ...(isAnimationData(source) ? { animationData: structuredClone(source) } : { path: toPath(source) }),
                rendererSettings: { preserveAspectRatio: ASPECT[resizeMode] },
            });
            itemRef.current = item;
            if (speed !== undefined) item.setSpeed(speed);

            item.addEventListener('DOMLoaded', () => {
                const stopAt = resolveLottieFrame(frame, item.totalFrames);
                if (stopAt !== undefined) item.goToAndStop(stopAt, true);
                container.setAttribute('data-lottie-frame', String(stopAt ?? 'play'));
                onAnimationLoaded?.();
            });
            item.addEventListener('complete', () => onAnimationFinish?.(false));
            item.addEventListener('data_failed', () => container.setAttribute('data-lottie-error', 'data_failed'));

            return () => item.destroy();
            // Reloading on every callback identity change would restart the animation on each render.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [source, frame]);

        return (
            <View style={style as never} testID={'preview-lottie'}>
                <View ref={hostRef as never} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
            </View>
        );
    },
);

export default LottieView;
export { LottieView };
