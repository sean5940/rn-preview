import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LottieFrameProvider, resolveLottieFrame } from '../src/previewLottie.tsx';

const TOTAL_FRAMES = 72;

type Listener = () => void;
const created: { options: Record<string, unknown>; goToAndStop: ReturnType<typeof vi.fn> }[] = [];

vi.mock('lottie-web/build/player/lottie_svg', () => ({
    default: {
        loadAnimation: (options: Record<string, unknown>) => {
            const listeners: Record<string, Listener[]> = {};
            const item = {
                totalFrames: TOTAL_FRAMES,
                goToAndStop: vi.fn(),
                setSpeed: vi.fn(),
                play: vi.fn(),
                pause: vi.fn(),
                destroy: vi.fn(),
                addEventListener: (name: string, listener: Listener) => {
                    (listeners[name] ??= []).push(listener);
                    // The real player fires these asynchronously; firing them on registration is
                    // enough to exercise what the stand-in does in response.
                    if (name === 'DOMLoaded' || name === 'data_failed') listener();
                },
            };
            created.push({ options, goToAndStop: item.goToAndStop });
            return item;
        },
    },
}));

const { default: LottieView } = await import('../src/stubs/lottieView.tsx');

const SOURCE = { v: '5.7.4', fr: 30, ip: 0, op: TOTAL_FRAMES, w: 110, h: 110, layers: [] };

describe('resolveLottieFrame', () => {
    test.each([
        ['first', 0],
        ['middle', 36],
        ['last', 71],
        [12, 12],
        ['play', undefined],
    ] as const)('%s of 72 frames is %s', (mode, frame) => {
        expect(resolveLottieFrame(mode, TOTAL_FRAMES)).toBe(frame);
    });
});

describe('LottieView stand-in', () => {
    beforeEach(() => {
        created.length = 0;
    });

    test('keeps the React Native style so the block is the size it is on a device', () => {
        const { getByTestId } = render(<LottieView source={SOURCE} style={{ width: 110, height: 110 }} />);
        const block = getByTestId('preview-lottie');
        expect(block.style.width).toBe('110px');
        expect(block.style.height).toBe('110px');
    });

    test('stops on the last frame by default so every capture shows the same picture', () => {
        render(<LottieView source={SOURCE} autoPlay loop={false} style={{ width: 110, height: 110 }} />);
        expect(created[0]?.options.autoplay).toBe(false);
        expect(created[0]?.goToAndStop).toHaveBeenCalledWith(TOTAL_FRAMES - 1, true);
    });

    test('plays when the declaration asks for it', () => {
        render(
            <LottieFrameProvider frame={'play'}>
                <LottieView source={SOURCE} autoPlay loop={false} />
            </LottieFrameProvider>,
        );
        expect(created[0]?.options.autoplay).toBe(true);
        expect(created[0]?.goToAndStop).not.toHaveBeenCalled();
    });

    test('hands the player a copy of the animation, because the player mutates what it is given', () => {
        render(<LottieView source={SOURCE} />);
        expect(created[0]?.options.animationData).toEqual(SOURCE);
        expect(created[0]?.options.animationData).not.toBe(SOURCE);
    });

    test('does not report a load failure to the screen', () => {
        const onAnimationFailure = vi.fn();
        render(<LottieView source={SOURCE} onAnimationFailure={onAnimationFailure} />);
        expect(onAnimationFailure).not.toHaveBeenCalled();
    });
});
