import React, { forwardRef } from 'react';
import * as ReactNativeWeb from 'react-native-web';
import { View } from 'react-native-web';
import { deviceOrigin, previewDeviceSize, renderingCellDevice, usePreviewDevice } from '../previewDevice.tsx';
import nativeStub from './nativeStub.ts';

/**
 * Stands in for `react-native`, filling in the native APIs `react-native-web` lacks.
 *
 * `react-native-web` ported only the drawing APIs. The native-module bridges
 * (`TurboModuleRegistry`, `requireNativeComponent`, `PermissionsAndroid`) are absent. Yet a good
 * share of the RN packages an app uses import them at module top level, so without those filled in,
 * merely brushing against such a package fails the whole bundle.
 *
 * Stubbing packages one at a time never converged. Emptying one shifted the tree-shaking path and a
 * different package came along. Filling in the module surface holds regardless of the shape of the
 * graph.
 */

export * from 'react-native-web';

type NativeComponentProps = Record<string, unknown>;

/**
 * Puts an empty `View` where a native view goes.
 *
 * Size and placement follow the parent's style, so layout holds and only the content looks empty.
 * An empty slot in a preview means that component cannot be approximated on the web.
 */
export const requireNativeComponent = (_name: string) =>
    forwardRef<unknown, NativeComponentProps>((props, ref) => <View ref={ref as never} {...props} />);

export const codegenNativeComponent = requireNativeComponent;

export const TurboModuleRegistry = {
    get: () => nativeStub,
    getEnforcing: () => nativeStub,
};

/**
 * react-native-web leaves an empty object here. That kills any package which reads a constant at
 * module top level, such as `NativeModules.SomeModule.STANDARD_EVENT`, the moment it loads. This
 * hands back a stub for whatever name is asked for.
 */
export const NativeModules = new Proxy(
    {},
    {
        get: () => nativeStub,
    },
);

export const codegenNativeCommands = () => nativeStub;

type ImageSource = { uri?: string } | string | number | undefined;

/**
 * Fills in `Image.resolveAssetSource`, which react-native-web's `Image` does not have.
 *
 * Metro turns `require('./x.png')` into an asset number and this function turns that number back
 * into a URI. On the web `requireToImport` has already rewritten it to an import, so the bundler
 * hands over a URL string and it only has to be wrapped. Dimensions are unknowable, hence 0.
 */
const resolveAssetSource = (source: ImageSource) => {
    const uri = typeof source === 'string' ? source : typeof source === 'object' ? (source?.uri ?? '') : '';
    return { uri, width: 0, height: 0, scale: 1 };
};

// Some places inside react-native-web take `Image` directly, so it is attached to the object itself.
export const Image = Object.assign(ReactNativeWeb.Image, { resolveAssetSource });

type MeasureInWindowCallback = (x: number, y: number, width: number, height: number) => void;
type MeasureCallback = (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void;
type MeasuringUIManager = {
    measure: (node: unknown, callback: MeasureCallback) => void;
    measureInWindow: (node: unknown, callback: MeasureInWindowCallback) => void;
};

/**
 * Makes window coordinates relative to the cell, the way they are relative to the screen on a
 * device. react-native-web's host nodes call these through the UIManager object at call time, so
 * replacing the methods on that object reaches every `ref.measureInWindow` and `ref.measure`.
 */
const measuring = ReactNativeWeb.UIManager as unknown as MeasuringUIManager;
const measureInWindowInBrowser = measuring.measureInWindow;
const measureInBrowser = measuring.measure;
measuring.measureInWindow = (node, callback) =>
    measureInWindowInBrowser(node, (x, y, width, height) => {
        const origin = deviceOrigin(node);
        callback(x - origin.x, y - origin.y, width, height);
    });
measuring.measure = (node, callback) =>
    measureInBrowser(node, (x, y, width, height, pageX, pageY) => {
        const origin = deviceOrigin(node);
        callback(x, y, width, height, pageX - origin.x, pageY - origin.y);
    });

/** The cell's size instead of the browser window's. Outside a grid it is the browser window. */
export const useWindowDimensions = () => {
    const device = usePreviewDevice();
    const browser = ReactNativeWeb.useWindowDimensions();
    return device === undefined ? browser : { ...browser, ...device };
};

type DimensionName = 'window' | 'screen';

/**
 * A read made while a cell renders gets that cell's device. Reads outside a render (module scope,
 * effects, handlers) cannot tell which cell is asking and get the device the grid set.
 */
export const Dimensions = {
    get: (name: DimensionName) => ({
        ...ReactNativeWeb.Dimensions.get(name),
        ...(renderingCellDevice() ?? previewDeviceSize()),
    }),
    set: ReactNativeWeb.Dimensions.set.bind(ReactNativeWeb.Dimensions),
    addEventListener: ReactNativeWeb.Dimensions.addEventListener.bind(ReactNativeWeb.Dimensions),
    removeEventListener: (
        ReactNativeWeb.Dimensions as unknown as { removeEventListener: (...args: unknown[]) => void }
    ).removeEventListener.bind(ReactNativeWeb.Dimensions),
};

type FontScalingProps = {
    allowFontScaling?: boolean | null;
    maxFontSizeMultiplier?: number | null;
    dataSet?: Record<string, string>;
};

/**
 * Leaves `allowFontScaling` and `maxFontSizeMultiplier` on the DOM, which react-native-web drops.
 * The cell's text scale reads them so text that opts out of scaling stays the size it is on a device.
 */
const withFontScalingMarkers = <P extends FontScalingProps>(
    props: P,
): P | (P & { dataSet: Record<string, string> }) => {
    const { allowFontScaling, maxFontSizeMultiplier } = props;
    const markers = {
        ...(allowFontScaling == null ? {} : { fontScaling: allowFontScaling ? 'on' : 'off' }),
        ...(maxFontSizeMultiplier == null ? {} : { maxFontScale: String(maxFontSizeMultiplier) }),
    };
    return Object.keys(markers).length === 0 ? props : { ...props, dataSet: { ...props.dataSet, ...markers } };
};

type TextProps = React.ComponentProps<typeof ReactNativeWeb.Text> & FontScalingProps;
type TextInputProps = React.ComponentProps<typeof ReactNativeWeb.TextInput> & FontScalingProps;

export const Text = forwardRef<unknown, TextProps>((props, ref) => (
    <ReactNativeWeb.Text ref={ref as never} {...withFontScalingMarkers(props)} />
));

export const TextInput = forwardRef<unknown, TextInputProps>((props, ref) => (
    <ReactNativeWeb.TextInput ref={ref as never} {...withFontScalingMarkers(props)} />
));

/**
 * react-native-web builds `Animated.Text` from its own `Text`, which skips the markers above. The
 * animated version is rebuilt from the marking `Text`; everything else is react-native-web's.
 */
export const Animated = {
    ...ReactNativeWeb.Animated,
    Text: ReactNativeWeb.Animated.createAnimatedComponent(Text),
};

export const PermissionsAndroid = nativeStub;
export const ToastAndroid = nativeStub;
export const DevSettings = nativeStub;
export const Settings = nativeStub;
export const PushNotificationIOS = nativeStub;
export const NativeAppEventEmitter = nativeStub;
export const requireNativeModule = () => nativeStub;

/**
 * Some code takes the whole module as `import ReactNative from 'react-native'`. The same values as
 * the named exports are collected here.
 */
export default {
    ...ReactNativeWeb,
    Image,
    Text,
    TextInput,
    Animated,
    useWindowDimensions,
    Dimensions,
    requireNativeComponent,
    codegenNativeComponent,
    codegenNativeCommands,
    TurboModuleRegistry,
    NativeModules,
    PermissionsAndroid,
    ToastAndroid,
    DevSettings,
    Settings,
    PushNotificationIOS,
    NativeAppEventEmitter,
    requireNativeModule,
};
