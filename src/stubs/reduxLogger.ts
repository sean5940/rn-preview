type Middleware = () => (next: (action: unknown) => unknown) => (action: unknown) => unknown;

/**
 * Stands in for `redux-logger`.
 *
 * It is middleware that logs actions to the console during development. It has nothing to do in a
 * preview, but the store setup calls `createLogger()` and installs it as middleware, so an empty
 * stub breaks store creation. Returns middleware that does nothing and passes through.
 */
export const createLogger = (): Middleware => () => (next) => (action) => next(action);

// It is used as `const { createLogger } = require('redux-logger')`, so default has to be an object.
export default { createLogger };
