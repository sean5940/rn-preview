import React, { useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { rootProviders } from 'virtual:preview-root-providers';
import type { PreviewSpec } from './definePreview.ts';
import { DEVICE_HEIGHT } from './previewDevice.tsx';

const NOOP = () => undefined;

/** Based on a notched 375-wide device. A preview has no device to measure, so representative values are used. */
const INSETS = { top: 44, bottom: 34, left: 0, right: 0 };

/** Only the keys a declaration gives are layered over the default insets. Whoever draws the cell and the context must see the same values. */
export const resolveInsets = (override: PreviewSpec<unknown>['insets']) => ({ ...INSETS, ...override });

/** A request that never finishes. Leaves the loading state standing in its place. */
const NEVER = () => new Promise<never>(() => undefined);

/**
 * Puts loading through a real request. Since the request never finishes, it is indistinguishable
 * from real loading from the screen's point of view.
 */
const startFetch = (client: QueryClient, key: readonly unknown[], queryFn: () => Promise<never>): void => {
    const query = client.getQueryCache().build(client, { queryKey: key });
    void query.fetch({ queryKey: key, queryFn }).catch(() => undefined);
};

/**
 * Puts a failed response in place.
 *
 * Running a rejecting queryFn did not get the screen to its error branch. While the rejection is
 * deferred to a microtask the screen mounts first and gets captured standing in the loading branch.
 * A spinner creates no DOM, so it looked like a blank cell and read as a broken tool. The state is
 * written directly, the same way a successful response goes in through `setQueryData`.
 */
const setQueryError = (client: QueryClient, key: readonly unknown[], error: unknown): void => {
    const query = client.getQueryCache().build(client, { queryKey: key });
    query.setState({
        status: 'error',
        error: error as Error,
        errorUpdateCount: 1,
        errorUpdatedAt: Date.now(),
        fetchStatus: 'idle',
        fetchFailureCount: 1,
        fetchFailureReason: error as Error,
    });
};

/**
 * Builds the React Query client the screen calls.
 *
 * Responses given through `mockQueries` are seeded in advance and refetching is turned off. A query
 * not seeded really does go to the server, and since a preview has no authentication that usually
 * produces the error view. That is also a state worth seeing, so it is not blocked.
 */
export const createPreviewQueryClient = (mocks: PreviewSpec<unknown>['mockQueries']): QueryClient => {
    const client = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                staleTime: Infinity,
                gcTime: Infinity,
                refetchOnWindowFocus: false,
                // Retrying a failed query on mount is the default. That flips the error state
                // straight to loading and you can no longer tell what you are looking at.
                retryOnMount: false,
            },
            mutations: { retry: false },
        },
    });

    // Repeat a key and the last one wins. That is how a state overrides the base response. Leaving
    // successful data in place would hide loading and error behind that data.
    const byKey = new Map((mocks ?? []).map((mock) => [JSON.stringify(mock.key), mock]));

    byKey.forEach((mock) => {
        if ('data' in mock) client.setQueryData(mock.key, mock.data);
        else if ('error' in mock) setQueryError(client, mock.key, mock.error);
        else startFetch(client, mock.key, NEVER);
    });

    return client;
};

/**
 * Fills in what a screen reads through `useNavigation`, `useRoute`, and `useIsFocused`.
 *
 * No real navigator is stood up. `@react-navigation/native-stack` leans on react-native-screens,
 * whose web support is not dependable, and a preview draws one screen so there is nowhere to go.
 * Instead an object filled in with only what a screen actually reads goes into context.
 *
 * Attempt to navigate and nothing happens. A preview is a tool for looking at one screen.
 */
const useFakeNavigation = () =>
    useMemo(
        () => ({
            navigate: NOOP,
            push: NOOP,
            goBack: NOOP,
            replace: NOOP,
            reset: NOOP,
            setParams: NOOP,
            setOptions: NOOP,
            dispatch: NOOP,
            canGoBack: () => false,
            isFocused: () => true,
            addListener: () => NOOP,
            removeListener: NOOP,
            getParent: () => undefined,
            getState: () => ({
                index: 0,
                key: 'preview',
                routeNames: [],
                routes: [],
                stale: false as const,
                type: 'stack',
            }),
        }),
        [],
    );

type Props<P> = PropsWithChildren<{
    spec: PreviewSpec<P>;
    width: number;
    height: number | undefined;
    queryClient: QueryClient;
}>;

/**
 * Wraps whatever is always present at an app's root on a device.
 *
 * These used to be chosen by a declaration through `wrappers`. But **`useNavigation` and
 * `useSafeAreaInsets` are called several levels down inside children.** When the screen does not
 * call them itself and a component inside it does, whoever writes the declaration cannot know in
 * advance, and omitting one fails the whole screen with "Couldn't find a navigation object".
 *
 * All three only supply context. They pull in no app code and change no layout, so wrapping them
 * always costs nothing.
 */
export const PreviewProviders = <P,>({ spec, width, height, queryClient, children }: Props<P>) => {
    const navigation = useFakeNavigation();

    const route = useMemo(
        () => ({ key: 'preview', name: spec.route?.name ?? 'Preview', params: spec.route?.params }),
        [spec.route],
    );

    // A declaration overrides this to look at devices with different insets, such as a home-button
    // device (top 20 · bottom 0).
    const insets = useMemo(() => resolveInsets(spec.insets), [spec.insets]);

    const tree = (
        <QueryClientProvider client={queryClient}>
            <NavigationContext.Provider value={navigation as never}>
                <NavigationRouteContext.Provider value={route}>{children}</NavigationRouteContext.Provider>
            </NavigationContext.Provider>
        </QueryClientProvider>
    );

    // `SafeAreaProvider` is not used. On the web it measures the real element and overwrites the
    // values we supplied, which makes a preview depend on the browser window size. Because a bottom
    // sheet takes its maximum height from this frame, a small window clips the content. The context
    // is supplied directly so it is pinned to the cell size.
    const framed = (
        <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width, height: height ?? DEVICE_HEIGHT }}>
            <SafeAreaInsetsContext.Provider value={insets}>{tree}</SafeAreaInsetsContext.Provider>
        </SafeAreaFrameContext.Provider>
    );

    // Root providers are not chosen by a declaration. Earlier in the list is further outside.
    return rootProviders.reduceRight((inner, Provider) => <Provider>{inner}</Provider>, framed);
};
