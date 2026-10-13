import React from 'react';

/**
 * Identifier that tells cells within one grid apart.
 *
 * The grid mounts the same screen as many times as there are variants. If the target project holds
 * a "render everything registered" structure (a portal host, say) in a module-global store,
 * registrations pile up per cell and the host in each cell draws other cells' registrations too.
 * With N cells, N copies are drawn in every cell.
 *
 * The tool does not know that structure, so it hands out **only a value that distinguishes a
 * cell**; splitting the store by that value is done by the project's module override
 * (`moduleOverrides`).
 *
 * Measured: on a screen with 7 variants, a bottom sheet was registered 7 times per cell and
 * polluted the geometry comparison. It sits outside the viewport (y=1030 / height 812) so it is
 * invisible in a PNG, but in a declaration that leaves the sheet open it stacks N deep on screen too.
 */
const PreviewCellContext = React.createContext<string>('preview-cell-root');

type Props = {
    id: string;
    children: React.ReactNode;
};

export const PreviewCellProvider = ({ id, children }: Props) => (
    <PreviewCellContext.Provider value={id}>{children}</PreviewCellContext.Provider>
);

/**
 * The current cell's identifier. Outside a grid (a single render) it is the fixed
 * `preview-cell-root`.
 *
 * Used from a module override, for instance by prefixing a portal host name with it.
 */
export const usePreviewCellId = (): string => React.useContext(PreviewCellContext);
