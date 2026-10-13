import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Testing Library cleans up on its own only when there is a global afterEach.
// This project runs with globals off, so it is wired up by hand. Without it, DOM drawn by an
// earlier test sticks around.
afterEach(cleanup);

// Root providers are read from config and come from the target project. These tests examine the
// behaviour of the grid and the cells, so there is no reason to pull in that graph, and running the
// app store blocks on the devtools packages Vite resolves under the development condition. Whether
// they are actually wrapped is checked in the browser.
vi.mock('virtual:preview-root-providers', () => ({ rootProviders: [] }));

// jsdom has no matchMedia. reanimated uses it to read the "reduce motion" setting on the web.
// Browsers have it, so this is not a problem the preview itself has.
if (typeof window !== 'undefined' && window.matchMedia === undefined) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
        }),
    });
}
