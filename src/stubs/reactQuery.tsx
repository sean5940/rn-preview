import type { PropsWithChildren } from 'react';

class StandInQuery {
    fetch(..._args: unknown[]): Promise<undefined> {
        return Promise.resolve(undefined);
    }

    setState(..._args: unknown[]): void {}
}

/**
 * Stands in for `@tanstack/react-query` when the target project does not install it.
 *
 * The preview always wraps a query provider, so the import has to resolve even in an app that never
 * uses React Query. Nothing in such an app reads from the client, so it only has to accept what
 * `PreviewProviders` does with it. `mockQueries` in a declaration has no effect here.
 */
export class QueryClient {
    constructor(..._args: unknown[]) {}

    getQueryCache() {
        return { build: (..._args: unknown[]) => new StandInQuery() };
    }

    setQueryData(..._args: unknown[]): undefined {
        return undefined;
    }
}

export const QueryClientProvider = ({ children }: PropsWithChildren<{ client: QueryClient }>) => <>{children}</>;
