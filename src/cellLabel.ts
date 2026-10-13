/**
 * A grid cell's label ends in `· {width}`. The capture script finds cells by this, so a width that
 * is not a whole number (a 161.5-wide card, half of a two-column row) has to match too; otherwise
 * that declaration's geometry comes out with no cells at all.
 */
export const CELL_LABEL_PATTERN = /·\s*\d+(?:\.\d+)?\s*$/;

export const isCellLabel = (text: string): boolean => CELL_LABEL_PATTERN.test(text.trim());
