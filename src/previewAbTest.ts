/**
 * The A/B test group this user belongs to inside a preview.
 *
 * On a device the app bootstrap fetches assignments from the server and puts them in redux. A
 * preview has no such step, so the assignment list is empty and app selectors treat "unassigned" as
 * fail-closed `'A'`. That makes **a screen behind a flag render as a blank cell**, and since the
 * reason does not surface it is hard to track down.
 *
 * What you want to preview is usually the side being built behind the flag, so the exposed group is
 * the default. To see another group, name the experiment code in the declaration's `abTestGroups`.
 */
const EXPOSED_GROUP = 'B';

let groups: Record<string, string> = {};

export const setPreviewAbGroups = (value: Record<string, string> | undefined): void => {
    groups = value ?? {};
};

export const previewAbGroup = (code: string): string => groups[code] ?? EXPOSED_GROUP;

export const previewAbList = (): { code: string; group: string }[] =>
    Object.entries(groups).map(([code, group]) => ({ code, group }));
