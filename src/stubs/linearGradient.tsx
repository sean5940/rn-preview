import React from 'react';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native-web';
import type { StyleProp, ViewStyle } from 'react-native-web';

type Point = { x: number; y: number };

type Props = PropsWithChildren<{
    colors: readonly string[];
    locations?: readonly number[];
    start?: Point;
    end?: Point;
    style?: StyleProp<ViewStyle>;
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}>;

const DEFAULT_START: Point = { x: 0.5, y: 0 };
const DEFAULT_END: Point = { x: 0.5, y: 1 };

/**
 * Stands in for `react-native-linear-gradient` with a CSS gradient.
 *
 * The community package (`react-native-web-linear-gradient`) is a 2017 CJS build, so Node reads it
 * directly without going through the bundler, and the `require('react-native')` inside it bypasses
 * the alias and pulls in Flow sources. Only four props are used, so it is drawn here directly.
 *
 * In CSS, 0deg points up and angles run clockwise. The vector from the start point to the end point
 * is converted to that basis. Native also factors in the view's actual aspect ratio, so the angle
 * of a diagonal gradient can differ slightly.
 */
const LinearGradient = ({
    colors,
    locations,
    start = DEFAULT_START,
    end = DEFAULT_END,
    style,
    children,
    ...rest
}: Props) => {
    const angle = Math.atan2(end.y - start.y, end.x - start.x) + Math.PI / 2;
    const stops = colors.map((color, index) => {
        const location = locations?.[index];
        return location === undefined ? color : `${color} ${location * 100}%`;
    });

    return (
        <View
            {...rest}
            style={[style, { backgroundImage: `linear-gradient(${angle}rad, ${stops.join(', ')})` } as ViewStyle]}>
            {children}
        </View>
    );
};

export default LinearGradient;
