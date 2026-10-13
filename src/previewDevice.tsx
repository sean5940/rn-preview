import React from 'react';

/**
 * The device a cell stands for: what the screen would read as its window on a real device.
 *
 * In a browser `useWindowDimensions` and `measureInWindow` answer about the browser window (1440
 * wide, cells offset from its corner). Code that places things against the screen edge then lands
 * far outside the cell: a tooltip computing `right = screenWidth - pageX - width` was drawn at
 * x = -704 with one character per line. The shim in `stubs/reactNative.tsx` answers from here
 * instead, so those calculations come out as they do on a device.
 */
export type PreviewDevice = { width: number; height: number; fontScale: number };

/** Marks the element whose top-left corner is the device screen's origin. */
export const PREVIEW_DEVICE_TEST_ID = 'preview-device';

/** The device a component cell sits on. */
export const DEVICE_WIDTH = 375;
export const DEVICE_HEIGHT = 795;

/**
 * The device a cell stands for.
 *
 * A screen cell is the device: its width is the device width being compared. A component cell is
 * only the component's box (a 343-wide card, a 295-wide dialog) and the component still sits on a
 * full device. A dialog that sizes itself as `window width - 80` comes out 295 on a 375 device; fed
 * the cell width it came out 280, and fed the browser window it overflowed the cell at 320.
 */
export const resolveDevice = (cell: {
    fillsDevice: boolean;
    width: number;
    height: number | undefined;
    fontScale: number;
}): PreviewDevice =>
    cell.fillsDevice
        ? { width: cell.width, height: cell.height ?? DEVICE_HEIGHT, fontScale: cell.fontScale }
        : { width: DEVICE_WIDTH, height: DEVICE_HEIGHT, fontScale: cell.fontScale };

const PreviewDeviceContext = React.createContext<PreviewDevice | undefined>(undefined);

type Props = { device: PreviewDevice; children: React.ReactNode };

export const PreviewDeviceProvider = ({ device, children }: Props) => (
    <PreviewDeviceContext.Provider value={device}>{children}</PreviewDeviceContext.Provider>
);

/** The current cell's device, or undefined outside a grid. */
export const usePreviewDevice = (): PreviewDevice | undefined => React.useContext(PreviewDeviceContext);

type Fiber = { type: unknown; memoizedProps: { value?: unknown } | null; return: Fiber | null };
type ReactInternals = { A?: { getOwner?: () => Fiber | null } | null };
const reactInternals = (
    React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: ReactInternals }
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

/**
 * The device of the cell being rendered right now, for calls that are not hooks (`Dimensions.get`).
 *
 * While React renders, its development build reports the component being rendered (`getOwner`).
 * Walking up from it to this context's provider finds the cell. Hooks are deliberately not used:
 * `Dimensions.get` is commonly called inside `useMemo` or a `useState` initializer, where calling
 * `use` logs a nested-hook warning. Outside a render (module scope, effects, handlers) there is no
 * owner and the caller falls back to the grid's device.
 */
export const renderingCellDevice = (): PreviewDevice | undefined => {
    for (let fiber = reactInternals?.A?.getOwner?.() ?? null; fiber !== null; fiber = fiber.return) {
        if (fiber.type === PreviewDeviceContext || fiber.type === PreviewDeviceContext.Provider) {
            return fiber.memoizedProps?.value as PreviewDevice | undefined;
        }
    }
    return undefined;
};

let deviceSize: { width: number; height: number } | undefined;

/**
 * The size `Dimensions.get` reports. A static call cannot tell which cell asked, so the grid sets
 * the first width it draws; declarations almost always draw one width.
 */
export const setPreviewDeviceSize = (size: { width: number; height: number } | undefined): void => {
    deviceSize = size;
};

export const previewDeviceSize = (): { width: number; height: number } | undefined => deviceSize;

/**
 * The offset of the device screen that contains `node`, in viewport coordinates. Zero when the
 * node is not inside a cell.
 */
export const deviceOrigin = (node: unknown): { x: number; y: number } => {
    const element = node as HTMLElement | null;
    const screen = element?.closest?.(`[data-testid="${PREVIEW_DEVICE_TEST_ID}"]`) as HTMLElement | null | undefined;
    if (screen == null) return { x: 0, y: 0 };
    const rect = screen.getBoundingClientRect();
    return { x: rect.left + screen.clientLeft, y: rect.top + screen.clientTop };
};
