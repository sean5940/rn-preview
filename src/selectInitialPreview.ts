/**
 * Chooses the declaration to show first.
 *
 * The editor extension passes the absolute path of the currently open declaration file through
 * `?file=`. Paths are exchanged rather than names so the naming rule is not copied into the
 * extension.
 */
export const selectInitialPreview = (names: string[], files: Record<string, string>, search: string): string => {
    const sorted = [...names].sort();
    const requested = new URLSearchParams(search).get('file');
    if (requested === null) return sorted[0] ?? '';

    return sorted.find((name) => files[name] === requested) ?? sorted[0] ?? '';
};
