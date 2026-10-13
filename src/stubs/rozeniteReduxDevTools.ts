type StoreEnhancer = <CreateStore>(createStore: CreateStore) => CreateStore;

/**
 * Stands in for `@rozenite/redux-devtools-plugin`.
 *
 * It is the bridge between the app and the editor devtools, so it has nothing to do in a preview,
 * and it warns about the lack of web support itself. Emptying it wholesale, though, breaks store
 * creation: the store setup passes this package's enhancer to `composeWithDevTools`, and compose
 * treats it as a function and hands it `createStore`.
 *
 * On top of that, packages in this family point their `exports` `development` condition at a `src/`
 * that is not published, so on a dev server or in tests, where Vite turns that condition on,
 * resolution fails from the transitive dependency (`@rozenite/agent-shared`) up.
 *
 * Returns an enhancer that does nothing and passes through.
 */
export const rozeniteDevToolsEnhancer = (): StoreEnhancer => (createStore) => createStore;

export default { rozeniteDevToolsEnhancer };
