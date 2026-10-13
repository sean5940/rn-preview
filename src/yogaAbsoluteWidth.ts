/**
 * Sizes absolutely positioned boxes the way Yoga does, where the browser sizes them differently.
 *
 * A box with `position: absolute`, no width, and not pinned to both sides is measured by Yoga at
 * its content width when its parent lays out in a row; only a column parent constrains it to the
 * parent's width (`AbsoluteLayout.cpp`, `layoutAbsoluteChild`). The browser always shrinks it to
 * the containing block. Inside a narrow row (a header button) that wraps text one character per
 * line: a tooltip anchored to a 28px button was drawn as a 12px column, while on a device it is a
 * single line up to its `maxWidth`.
 *
 * Only boxes that specify no width are touched. react-native-web emits a specified width either as
 * an `r-width-*` class or an inline `width`, so both are checked.
 */

const ROW = /^row/;

const specifiesByClass = (element: Element, property: string): boolean =>
    new RegExp(`(^|\\s)r-${property}-`).test(element.getAttribute('class') ?? '');

const specifiesInline = (element: HTMLElement, property: string): boolean => {
    const value = element.style.getPropertyValue(property);
    return value !== '' && value !== 'auto';
};

const specifies = (element: HTMLElement, property: string): boolean =>
    specifiesByClass(element, property) || specifiesInline(element, property);

const takesContentWidth = (element: HTMLElement): boolean => {
    const parent = element.parentElement;
    if (parent === null) return false;
    if (getComputedStyle(element).position !== 'absolute') return false;
    if (!ROW.test(getComputedStyle(parent).flexDirection)) return false;
    if (specifies(element, 'width')) return false;
    return !(specifies(element, 'left') && specifies(element, 'right'));
};

export const matchYogaAbsoluteWidth = (root: Element): void => {
    for (const element of [root, ...root.querySelectorAll('*')]) {
        if (!(element instanceof HTMLElement)) continue;
        if (takesContentWidth(element)) element.style.width = 'max-content';
    }
};

/**
 * Applies the sizing to what is in the cell now and to everything mounted later. A tooltip appears
 * only after it has measured its anchor, well after the first render. Only added nodes are
 * visited, so animations that rewrite style attributes every frame cost nothing.
 */
export const observeYogaAbsoluteWidth = (root: Element): (() => void) => {
    matchYogaAbsoluteWidth(root);
    const observer = new MutationObserver((records) => {
        for (const record of records) {
            record.addedNodes.forEach((node) => {
                if (node instanceof Element) matchYogaAbsoluteWidth(node);
            });
        }
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
};
