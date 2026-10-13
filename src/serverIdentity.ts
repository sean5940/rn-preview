import type { Plugin } from 'vite';
import { previewConfig } from './previewConfig.ts';
import { PREVIEW_ROOT } from './previewRoot.ts';

export const IDENTITY_PATH = '/__rn-preview/target';

/**
 * Reports which checkout this server is looking at.
 *
 * People open a separate window per worktree and per branch. Deciding "a server is already up" from
 * the port alone means **using a server that is drawing a different checkout.** The screen comes up
 * fine while the content is from another branch, which is hard to notice. The editor extension uses
 * this value to confirm the target matches first.
 */
export const serverIdentity = (): Plugin => ({
    name: 'server-identity',
    configureServer(server) {
        server.middlewares.use(IDENTITY_PATH, (_request, response) => {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ projectRoot: previewConfig.projectRoot, previewRoot: PREVIEW_ROOT }));
        });
    },
});
