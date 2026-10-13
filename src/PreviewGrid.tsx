import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { PreviewSpec } from './definePreview.ts';
import { PreviewCase } from './PreviewCase.tsx';
import { setPreviewAbGroups } from './previewAbTest.ts';
import { resolveFontScale } from './fontScale.ts';
import { resolveDevice, setPreviewDeviceSize } from './previewDevice.tsx';
import { createPreviewQueryClient } from './PreviewProviders.tsx';

// Some app code reads assignments straight from the redux store rather than through a hook, so
// context cannot supply them. Only one declaration is drawn at a time, so this is a module value.
const applyAbGroups = <P,>(spec: PreviewSpec<P>): void => setPreviewAbGroups(spec.abTestGroups);

/** The device size taken as the baseline. */
const DEFAULT_WIDTH = 375;
const DEFAULT_HEIGHT = 795;
const NO_STATE = '';
/** A cell drawn without scaling. Not written in the label. */
const NO_SCALE = 1;

type Props<P> = { spec: PreviewSpec<P>; name: string };

/**
 * Decides whether to turn device chrome on by default.
 *
 * A screen declaration draws its own header and safe area, so the status-bar band sits in the right
 * place. A screen body component sits below the header on a device, which a preview does not have,
 * so drawing the band creates an overlap in the capture that does not exist on a device. Following
 * the repository convention, only `*Screen` counts as a screen.
 *
 * Sheets are on too. A sheet is anchored to the bottom of the cell and grows upward, so the top is
 * empty space, and whether a bottom fixed button collides with the home indicator is the problem
 * that comes up most often with sheets.
 */
const drawsDeviceChrome = (name: string, openOnMount: boolean): boolean => /Screen$/.test(name) || openOnMount;

/**
 * Draws the combination of variant, state, and device width as a grid.
 *
 * Kept as pure React Native components. On the web react-native-web turns them into DOM, and if a
 * native renderer is added later the same code runs unchanged.
 */
export const PreviewGrid = <P,>({ spec, name }: Props<P>) => {
    applyAbGroups(spec);

    // Comparing device widths side by side is the point, so cells are kept from shrinking (flexShrink: 0).
    const { variants, widths } = spec;
    const widthList = widths ?? [DEFAULT_WIDTH];
    // Screens and sheets have to fill the device size for their layout to match a device. A single
    // component takes only as much as its content: giving a small component the device height keeps
    // the variants from fitting on one screen, which defeats the comparison. Anything that varies by
    // server response is a screen.
    const fillsDevice =
        spec.openOnMount === true ||
        spec.mockQueries !== undefined ||
        spec.states !== undefined ||
        spec.route !== undefined;
    const height = spec.height ?? (fillsDevice ? DEFAULT_HEIGHT : undefined);
    // Static `Dimensions.get` calls cannot tell which cell asked, so they get the device of the first width drawn.
    setPreviewDeviceSize(
        resolveDevice({ fillsDevice, width: widthList[0] ?? DEFAULT_WIDTH, height, fontScale: NO_SCALE }),
    );
    const chrome = spec.platformChrome ?? (fillsDevice && drawsDeviceChrome(name, spec.openOnMount === true));
    const stateNames = Object.keys(spec.states ?? {});

    // Server responses differ per state, so each state gets its own client. Building one per cell
    // would duplicate it as many times as there are widths.
    const queryClients = useMemo(() => {
        const entries = (stateNames.length === 0 ? [NO_STATE] : stateNames).map((name) => {
            const stateMocks = name === NO_STATE ? [] : (spec.states?.[name] ?? []);
            return [name, createPreviewQueryClient([...(spec.mockQueries ?? []), ...stateMocks])] as const;
        });

        return Object.fromEntries(entries);
    }, [spec.mockQueries, spec.states, stateNames]);

    // One row is one variant. State, device width, and text scale are placed side by side within
    // that row so they can be compared.
    const fontScaleList = (spec.fontScales ?? [NO_SCALE]).map(resolveFontScale);
    const columns = Object.keys(queryClients).flatMap((stateName) =>
        widthList.flatMap((width) => fontScaleList.map((fontScale) => ({ stateName, width, fontScale }))),
    );

    return (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }}>
            {Object.entries(variants).map(([variantName, props]) => (
                <View key={variantName} style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
                    {columns.map(({ stateName, width, fontScale }) => (
                        <View
                            key={`${variantName}-${stateName}-${width}-${fontScale.label}`}
                            style={{ gap: 8, flexShrink: 0 }}>
                            {/* Device width goes last. The capture geometry extractor treats only labels matching `CELL_LABEL_PATTERN` as cells. */}
                            <Text style={{ fontSize: 12, color: '#888' }}>
                                {[
                                    variantName,
                                    stateName,
                                    fontScale.curve === 'linear' && fontScale.scale === NO_SCALE
                                        ? NO_STATE
                                        : fontScale.label,
                                    width,
                                ]
                                    .filter((part) => part !== NO_STATE)
                                    .join(' · ')}
                            </Text>
                            <PreviewCase
                                spec={spec}
                                props={props}
                                width={width}
                                height={height}
                                fontScale={fontScale}
                                chrome={chrome}
                                fillsDevice={fillsDevice}
                                queryClient={queryClients[stateName] as never}
                                presses={spec.interactions?.[stateName]?.map((step) => step.press)}
                            />
                        </View>
                    ))}
                </View>
            ))}
        </ScrollView>
    );
};
