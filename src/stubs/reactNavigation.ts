import { createContext } from 'react';

/**
 * Stands in for `@react-navigation/native` when the target project does not install it.
 *
 * The preview always supplies a fake navigation object, so the import has to resolve even in an app
 * that navigates some other way. Nothing in such an app reads these contexts.
 */
export const NavigationContext = createContext<unknown>(undefined);

export const NavigationRouteContext = createContext<unknown>(undefined);
