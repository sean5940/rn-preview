import { render, screen } from '@testing-library/react';
import { View, Text } from 'react-native';
import { describe, expect, test } from 'vitest';

describe('react-native-web pipeline', () => {
    test("react-native's View and Text render to DOM", () => {
        render(
            <View>
                <Text>Hello</Text>
            </View>,
        );
        expect(screen.getByText('Hello')).toBeTruthy();
    });

    test('StyleSheet.create works', async () => {
        const { StyleSheet } = await import('react-native');
        const styles = StyleSheet.create({ box: { width: 10 } });
        expect(styles.box).toBeTruthy();
    });
});
