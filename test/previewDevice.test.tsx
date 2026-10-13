import { useMemo } from 'react';
import { render, screen } from '@testing-library/react';
import { Dimensions, Text, useWindowDimensions, View } from 'react-native';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
    PREVIEW_DEVICE_TEST_ID,
    PreviewDeviceProvider,
    resolveDevice,
    setPreviewDeviceSize,
} from '../src/previewDevice.tsx';

const WindowProbe = () => {
    const { width, height, fontScale } = useWindowDimensions();
    return <Text>{`${width}x${height}@${fontScale}`}</Text>;
};

describe('window size inside a cell', () => {
    test('useWindowDimensions reports the cell, not the browser window', () => {
        render(
            <PreviewDeviceProvider device={{ width: 320, height: 640, fontScale: 1.3 }}>
                <WindowProbe />
            </PreviewDeviceProvider>,
        );
        expect(screen.getByText('320x640@1.3')).toBeTruthy();
    });

    test('outside a cell it falls back to the browser window', () => {
        render(<WindowProbe />);
        expect(screen.queryByText(/^320x640/)).toBeNull();
    });

    test('Dimensions.get called while a cell renders reports that cell, even with several widths in one grid', () => {
        const StaticProbe = () => <Text>{`static ${Dimensions.get('window').width}`}</Text>;
        render(
            <>
                <PreviewDeviceProvider device={{ width: 320, height: 640, fontScale: 1 }}>
                    <StaticProbe />
                </PreviewDeviceProvider>
                <PreviewDeviceProvider device={{ width: 414, height: 896, fontScale: 1 }}>
                    <StaticProbe />
                </PreviewDeviceProvider>
            </>,
        );
        expect(screen.getByText('static 320')).toBeTruthy();
        expect(screen.getByText('static 414')).toBeTruthy();
    });

    test('a read inside useMemo still learns its cell, without a nested-hook warning', () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const MemoProbe = () => {
            const width = useMemo(() => Dimensions.get('window').width, []);
            return <Text>{`memo ${width}`}</Text>;
        };
        render(
            <PreviewDeviceProvider device={{ width: 360, height: 780, fontScale: 1 }}>
                <MemoProbe />
            </PreviewDeviceProvider>,
        );
        expect(screen.getByText('memo 360')).toBeTruthy();
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });

    test('Dimensions.get reports the device size the grid set', () => {
        setPreviewDeviceSize({ width: 375, height: 812 });
        expect(Dimensions.get('window')).toMatchObject({ width: 375, height: 812 });
        expect(Dimensions.get('screen')).toMatchObject({ width: 375, height: 812 });
        setPreviewDeviceSize(undefined);
    });
});

describe('resolveDevice', () => {
    test('a screen cell is the device', () => {
        expect(resolveDevice({ fillsDevice: true, width: 320, height: 640, fontScale: 1 })).toEqual({
            width: 320,
            height: 640,
            fontScale: 1,
        });
    });

    test('a component cell sits on a full device, so a 295-wide dialog still sees a 375-wide window', () => {
        expect(resolveDevice({ fillsDevice: false, width: 295, height: undefined, fontScale: 1.3 })).toEqual({
            width: 375,
            height: 795,
            fontScale: 1.3,
        });
    });
});

describe('measuring inside a cell', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('measureInWindow is relative to the cell, the way it is relative to the screen on a device', async () => {
        const rects: Record<string, { left: number; top: number }> = {
            [PREVIEW_DEVICE_TEST_ID]: { left: 100, top: 50 },
            target: { left: 430, top: 63 },
        };
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            const rect = rects[this.dataset.testid ?? ''] ?? { left: 0, top: 0 };
            return { ...rect, x: rect.left, y: rect.top, width: 28, height: 19, right: 0, bottom: 0 } as DOMRect;
        });

        const ref: { current: View | null } = { current: null };
        render(
            <View testID={PREVIEW_DEVICE_TEST_ID}>
                <View ref={ref} testID={'target'} />
            </View>,
        );
        const measured = await new Promise<number[]>((resolve) => {
            ref.current?.measureInWindow((...values) => resolve(values));
        });

        expect(measured.slice(0, 2)).toEqual([330, 13]);
    });
});
