import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';
import type { PreviewSpec } from './definePreview.ts';
import { applyFontScale, type ResolvedFontScale } from './fontScale.ts';
import { PreviewProviders, resolveInsets } from './PreviewProviders.tsx';
import { PreviewCellProvider } from './previewCell.tsx';
import { PREVIEW_DEVICE_TEST_ID, PreviewDeviceProvider, resolveDevice } from './previewDevice.tsx';
import { observeYogaAbsoluteWidth } from './yogaAbsoluteWidth.ts';
import { LottieFrameProvider } from './previewLottie.tsx';
import { FIRST_PRESS_DELAY_MS, isCapturing, NEXT_PRESS_DELAY_MS, pressText } from './previewInteractions.ts';

type Openable = { show?: () => void };

type Props<P> = {
    spec: PreviewSpec<P>;
    props: Partial<P>;
    width: number;
    height: number | undefined;
    fontScale: ResolvedFontScale;
    chrome: boolean;
    /** Whether the cell is the whole device screen rather than one component's box. */
    fillsDevice: boolean;
    queryClient: QueryClient;
    /** Texts this cell's state presses in order (`interactions`), for viewing outside a capture. */
    presses?: string[];
};

/** The status bar and home indicator areas. Design frames carry these two regions as nodes as well. */
const CHROME_TINT = 'rgba(120, 130, 160, 0.22)';
const HOME_INDICATOR = { width: 134, height: 5, radius: 2.5, color: 'rgba(0, 0, 0, 0.65)' };

/**
 * Overlays the top and bottom regions the device occupies on top of the screen.
 *
 * Supplying insets through context alone means the screen reads the value while we see nothing.
 * Whether a bottom fixed button collides with the home indicator, or a top element runs under the
 * status bar, never showed up in the render, so it was deferred until the real-device pass. Design
 * frames contain `StatusBar` and `Home Indicator` as nodes, so the same regions are filled here.
 *
 * Marked with `testID` so it drops out of a capture's geometry extraction. The device draws it, so
 * counting it as part of the implementation render would compare a box that does not exist.
 */
const PlatformChrome = ({ insets }: { insets: { top: number; bottom: number } }) => (
    <View
        testID={'preview-chrome'}
        pointerEvents={'none'}
        // Sheets raise their own z-axis. The chrome has to sit above that for a collision between
        // the bottom button and the home indicator to be visible.
        style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 9999,
            justifyContent: 'space-between',
        }}>
        <View style={{ height: insets.top, backgroundColor: CHROME_TINT }} />
        <View
            style={{
                height: insets.bottom,
                backgroundColor: CHROME_TINT,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
            {insets.bottom > 0 ? (
                <View
                    style={{
                        width: HOME_INDICATOR.width,
                        height: HOME_INDICATOR.height,
                        borderRadius: HOME_INDICATOR.radius,
                        backgroundColor: HOME_INDICATOR.color,
                    }}
                />
            ) : null}
        </View>
    </View>
);

/** Sheets open with an animation. Measured the instant they are drawn, they are not yet full size. */
const FIXUP_DELAYS = [80, 300, 700];

const isScrollable = (element: Element): boolean => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY);

/** The first ancestor the scroll area cannot fit inside. The point where the sheet hit its maximum height. */
const findCap = (scroller: Element, root: Element): HTMLElement | undefined => {
    for (let element = scroller.parentElement; element !== null && element !== root; element = element.parentElement) {
        if (element.clientHeight > 0 && element.clientHeight < scroller.clientHeight) return element;
    }
    return undefined;
};

/**
 * Makes the inside of a sheet at maximum height scroll the way it does on a device.
 *
 * A sheet grows only up to the screen height minus the safe area, and content longer than that
 * scrolls within the sheet. On the web, though, **the inner wrapper and the scroll area keep the
 * full content height even with the height constrained.** So it clips instead of scrolling and
 * cannot be reached.
 *
 * Shrinking the inner element to its parent lets the scroll area do its job. Enlarging the cell so
 * everything fits is another option, but that produces a sheet at a size no device has, and what
 * gets folded changes.
 */
const enableSheetScroll = (node: unknown): void => {
    const root = node as HTMLElement | null;
    if (root?.querySelectorAll === undefined) return;

    // Walk up from the scroll area. Hunting top-down for "the clipped element" catches the outer
    // wrapper first, which leaves the inner element that actually needs shrinking alone and changes
    // the wrong thing.
    const pairs = [...root.querySelectorAll('*')]
        .filter(isScrollable)
        .map((scroller) => ({ scroller, cap: findCap(scroller, root) }));

    const found = pairs.find((pair) => pair.cap !== undefined);
    if (found?.cap === undefined) return;

    for (let element = found.scroller as HTMLElement | null; element !== null && element !== found.cap;) {
        element.style.height = '100%';
        element.style.minHeight = '0';
        element.style.flexShrink = '1';
        element = element.parentElement;
    }

    // Before shrinking, the scroll had already moved down by the overflow. A preview shows the state
    // it is in when opened.
    found.scroller.scrollTop = 0;
};

/**
 * Draws one cell.
 *
 * Anything that has to be opened to be seen, such as a bottom sheet, gets `ref.show()` called after
 * mounting. Sheets that take a ref as a prop and are opened from outside show nothing in a preview
 * unless they are opened.
 */
export const PreviewCase = <P,>({
    spec,
    props,
    width,
    height,
    fontScale,
    chrome,
    fillsDevice,
    queryClient,
    presses,
}: Props<P>) => {
    const { component: Component, openOnMount, background } = spec;
    const insets = resolveInsets(spec.insets);
    const openableRef = useRef<Openable>(null);
    const frameRef = useRef<View>(null);
    // Different per cell, so a module override that uses a module-global store can split cells by it.
    const cellId = React.useId();
    const device = useMemo(
        () => resolveDevice({ fillsDevice, width, height, fontScale: fontScale.scale }),
        [fillsDevice, width, height, fontScale],
    );

    useEffect(() => {
        const frame = frameRef.current as unknown as Element | null;
        if (frame === null) return undefined;
        return observeYogaAbsoluteWidth(frame);
    }, []);

    // Grow the text before fitting the sheet height. In the reverse order the sheet clips without
    // accounting for the height the scale added.
    useEffect(() => {
        if (fontScale.scale === 1) return;
        applyFontScale(frameRef.current, fontScale);
    });

    // Deliberately no dependency array. Editing a declaration changes the content height and it has
    // to be refitted; measuring once on mount leaves it as it was and the sheet stays clipped.
    useEffect(() => {
        if (openOnMount !== true) return undefined;

        openableRef.current?.show?.();

        const timers = FIXUP_DELAYS.map((delay) => setTimeout(() => enableSheetScroll(frameRef.current), delay));
        return () => timers.forEach(clearTimeout);
    });

    // A capture presses with real clicks itself; pressing here as well would toggle twice.
    // Keyed by the texts so an edit to the declaration presses again, not every render.
    const [pressFailure, setPressFailure] = useState<string>();
    const pressKey = presses?.join('\n');
    useEffect(() => {
        if (pressKey === undefined || pressKey.length === 0 || isCapturing()) return undefined;
        const texts = pressKey.split('\n');
        const timers: ReturnType<typeof setTimeout>[] = [];
        const pressFrom = (index: number): void => {
            const root = frameRef.current as unknown as Element | null;
            if (root === null || index >= texts.length) return;
            const failure = pressText(root, texts[index]);
            if (failure !== undefined) {
                setPressFailure(failure);
                return;
            }
            timers.push(setTimeout(() => pressFrom(index + 1), NEXT_PRESS_DELAY_MS));
        };
        setPressFailure(undefined);
        timers.push(setTimeout(() => pressFrom(0), FIRST_PRESS_DELAY_MS));
        return () => timers.forEach(clearTimeout);
    }, [pressKey]);

    const openable = openOnMount === true ? { ref: openableRef } : {};

    return (
        <View
            ref={frameRef}
            testID={PREVIEW_DEVICE_TEST_ID}
            style={{
                width,
                height,
                // Absolutely-positioned things like sheets treat this cell as the device screen.
                // Padding here offsets them by that much and pushes their bottom outside the cell.
                // Spacing goes outside the cell.
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: background ?? '#ffffff',
                borderWidth: 1,
                borderColor: '#e0e0e0',
            }}>
            <PreviewCellProvider id={cellId}>
                <PreviewDeviceProvider device={device}>
                    <LottieFrameProvider frame={spec.lottieFrame}>
                        <PreviewProviders spec={spec} width={width} height={height} queryClient={queryClient}>
                            <Component {...(props as P & React.JSX.IntrinsicAttributes)} {...openable} />
                        </PreviewProviders>
                    </LottieFrameProvider>
                </PreviewDeviceProvider>
            </PreviewCellProvider>
            {chrome ? <PlatformChrome insets={insets} /> : null}
            {pressFailure !== undefined ? (
                <Text
                    style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        right: 4,
                        padding: 4,
                        fontSize: 11,
                        color: '#ffffff',
                        backgroundColor: '#d32f2f',
                    }}>
                    {`interactions: ${pressFailure}`}
                </Text>
            ) : null}
        </View>
    );
};
