import { afterEach, describe, expect, test } from 'vitest';
import { matchYogaAbsoluteWidth } from '../src/yogaAbsoluteWidth.ts';

const build = (parentStyle: string, childStyle: string, childClass = ''): { root: HTMLElement; child: HTMLElement } => {
    const root = document.createElement('div');
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.setAttribute('style', `display: flex; ${parentStyle}`);
    child.setAttribute('style', childStyle);
    child.className = childClass;
    parent.append(child);
    root.append(parent);
    document.body.append(root);
    return { root, child };
};

describe('matchYogaAbsoluteWidth', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('an absolute box without a width in a row parent takes its content width, as Yoga measures it', () => {
        const { root, child } = build('flex-direction: row;', 'position: absolute; right: 6px; top: 35px;');
        matchYogaAbsoluteWidth(root);
        expect(child.style.width).toBe('max-content');
    });

    test('in a column parent the box keeps the browser sizing, which matches Yoga there', () => {
        const { root, child } = build('flex-direction: column;', 'position: absolute; right: 6px;');
        matchYogaAbsoluteWidth(root);
        expect(child.style.width).toBe('');
    });

    test('a box with its own width is left alone', () => {
        const inline = build('flex-direction: row;', 'position: absolute; right: 0; width: 24px;');
        const byClass = build('flex-direction: row;', 'position: absolute; right: 0;', 'css-view r-width-1gymjhz');
        matchYogaAbsoluteWidth(inline.root);
        matchYogaAbsoluteWidth(byClass.root);
        expect(inline.child.style.width).toBe('24px');
        expect(byClass.child.style.width).toBe('');
    });

    test('a box pinned to both sides stretches between them and is left alone', () => {
        const { root, child } = build('flex-direction: row;', 'position: absolute; left: 0; right: 0;');
        matchYogaAbsoluteWidth(root);
        expect(child.style.width).toBe('');
    });

    test('a side released with auto does not count as pinned', () => {
        const { root, child } = build('flex-direction: row;', 'position: absolute; left: auto; right: 0;');
        matchYogaAbsoluteWidth(root);
        expect(child.style.width).toBe('max-content');
    });

    test('a box in normal flow is left alone', () => {
        const { root, child } = build('flex-direction: row;', 'position: relative;');
        matchYogaAbsoluteWidth(root);
        expect(child.style.width).toBe('');
    });
});
