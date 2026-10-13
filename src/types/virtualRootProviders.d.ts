declare module 'virtual:preview-root-providers' {
    import type { ComponentType, PropsWithChildren } from 'react';

    /** Providers the app always wraps at its root. Built from config by the `preview-root-providers` plugin. */
    export const rootProviders: ComponentType<PropsWithChildren>[];
}
