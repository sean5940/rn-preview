import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { definePreview, PreviewGrid } from '@preview';
import { CAPTURING_FLAG } from '../src/captureMeta.ts';
import { FIRST_PRESS_DELAY_MS, findTextElements, isCapturing, pressText } from '../src/previewInteractions.ts';

const Toggle = () => {
    const [on, setOn] = useState(false);
    return (
        <Pressable onPress={() => setOn((value) => !value)}>
            <Text>{on ? '켜짐' : '꺼짐'}</Text>
        </Pressable>
    );
};

const spec = definePreview({
    component: Toggle,
    variants: { default: {} },
    states: { before: [], after: [] },
    interactions: { after: [{ press: '꺼짐' }] },
});

afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as Record<string, unknown>)[CAPTURING_FLAG];
});

describe('pressText', () => {
    test('presses a react-native-web Pressable by its drawn text', () => {
        const onPress = vi.fn();
        const { container } = render(
            <Pressable onPress={onPress}>
                <Text>{'바로\u2060시작'}</Text>
            </Pressable>,
        );
        expect(pressText(container, '바로시작')).toBeUndefined();
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    test('counts only the innermost element, not wrappers of the same text', () => {
        const { container } = render(
            <View>
                <Text>{'하나'}</Text>
            </View>,
        );
        expect(findTextElements(container, '하나')).toHaveLength(1);
    });

    test('reports a text that is missing or drawn twice instead of pressing', () => {
        const { container } = render(
            <View>
                <Text>{'둘'}</Text>
                <Text>{'둘'}</Text>
            </View>,
        );
        expect(pressText(container, '없음')).toContain('not drawn');
        expect(pressText(container, '둘')).toContain('drawn 2 times');
    });
});

describe('interactions in the grid', () => {
    test('presses only the cells of the named state', () => {
        vi.useFakeTimers();
        render(<PreviewGrid spec={spec} name={'ui/Toggle'} />);
        act(() => vi.advanceTimersByTime(FIRST_PRESS_DELAY_MS));
        expect(screen.getAllByText('켜짐')).toHaveLength(1);
        expect(screen.getAllByText('꺼짐')).toHaveLength(1);
    });

    test('marks the cell when the text cannot be pressed', () => {
        vi.useFakeTimers();
        const missing = definePreview({ ...spec, interactions: { after: [{ press: '없는 문구' }] } });
        render(<PreviewGrid spec={missing} name={'ui/Toggle'} />);
        act(() => vi.advanceTimersByTime(FIRST_PRESS_DELAY_MS));
        expect(screen.getByText(/interactions: press "없는 문구": not drawn/)).toBeTruthy();
    });

    test('leaves pressing to the capture script while capturing', () => {
        vi.useFakeTimers();
        (window as unknown as Record<string, unknown>)[CAPTURING_FLAG] = true;
        expect(isCapturing()).toBe(true);
        render(<PreviewGrid spec={spec} name={'ui/Toggle'} />);
        act(() => vi.advanceTimersByTime(FIRST_PRESS_DELAY_MS));
        expect(screen.queryByText('켜짐')).toBeNull();
    });
});
