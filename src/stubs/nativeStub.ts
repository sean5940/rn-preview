/**
 * Stands in for native packages that do not need to work in a preview.
 *
 * The targets are packages that take no part in drawing the screen, such as analytics or an
 * advertising identifier. Left alone they pull in `react-native/Libraries/...`, and those files are
 * Flow, so parsing blocks on them.
 *
 * Whatever you take from it, the same callable proxy comes back. Calling it returns `null` so it can
 * sit in a component slot. If a preview actually tries to use the value it shows up on screen, and
 * an individual stub is written then.
 */
// An arrow function as the target would block `new`: an arrow cannot be a constructor, so the
// construct trap never fires. App code does contain `new SomeNativeThing()`.
function stubTarget(): null {
    return null;
}

const handler: ProxyHandler<typeof stubTarget> = {
    get: (_target, prop) => {
        if (prop === '__esModule') return true;
        // Mistaken for a thenable when awaited, the preview would hang forever.
        if (prop === 'then') return undefined;
        if (prop === Symbol.toPrimitive) return () => '';
        return stub;
    },
    apply: () => null,
    // An empty object would kill code that uses an instance the moment it is built, such as
    // `new MMKV().getString(...)`. Returning itself lets any chained call through.
    construct: () => stub,
};

const stub = new Proxy(stubTarget, handler);

export default stub;

// ESM checks named exports statically. Names the app pulls out by name are listed here.
// `node scripts/whyNotBundled.mjs <import path>` reports what is missing.
export const IDFA = stub;
export const showMessage = stub;
export const hideMessage = stub;
export const DotLottieReact = stub;
export const AccessToken = stub;
export const LoginManager = stub;
export const getApplicationName = stub;
export const createMMKV = stub;
export const MMKV = stub;
