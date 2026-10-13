import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { publishCaptureMeta, resolveCaptureMeta } from './captureMeta.ts';
import type { PreviewSpec } from './definePreview.ts';
import { loadPreviewFiles, loadPreviewLoaders } from './loadPreviews.ts';
import { PreviewGrid } from './PreviewGrid.tsx';
import { selectInitialPreview } from './selectInitialPreview.ts';

const loaders = loadPreviewLoaders();
const previewFiles = loadPreviewFiles();

const EMPTY_GUIDE = 'No declaration files. Create a *.preview.tsx under the declaration directory.';

/**
 * Whether this was opened inside an editor panel.
 *
 * The editor shows only the one file you opened. A list beside it just takes up room in a narrow
 * panel, and the editor tab already says what you are looking at. Opened directly in a browser the
 * list is the only way to move around, so it stays.
 */
const isEmbedded = new URLSearchParams(window.location.search).get('embed') === '1';

type Loaded =
    { status: 'loading' } | { status: 'ready'; spec: PreviewSpec<unknown> } | { status: 'failed'; reason: string };

/**
 * Loads only the one declaration that was selected.
 *
 * Loading them all statically means **one broken declaration takes down every one of them.**
 * Branches differ per worktree, so a module a declaration references sometimes does not exist on
 * that branch. When that happens, which declaration failed and why is left on screen as well.
 */
const usePreview = (name: string): Loaded => {
    const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

    useEffect(() => {
        const loader = loaders[name];
        if (loader === undefined) {
            setLoaded({ status: 'failed', reason: EMPTY_GUIDE });
            return undefined;
        }

        let cancelled = false;
        setLoaded({ status: 'loading' });

        loader()
            .then((module) => {
                if (cancelled) return;
                // Published before the grid renders so the capture script never reads the previous
                // declaration's time axis.
                publishCaptureMeta(resolveCaptureMeta(module.default));
                setLoaded({ status: 'ready', spec: module.default });
            })
            .catch((error: Error) => {
                if (cancelled) return;
                publishCaptureMeta(undefined);
                setLoaded({ status: 'failed', reason: error.message });
            });

        return () => {
            cancelled = true;
        };
    }, [name]);

    return loaded;
};

const Message = ({ text }: { text: string }) => (
    <Text style={{ padding: 24, color: '#666666', lineHeight: 20 }}>{text}</Text>
);

export const App = () => {
    const names = Object.keys(loaders).sort();
    const [selected, setSelected] = useState(() => selectInitialPreview(names, previewFiles, window.location.search));
    const loaded = usePreview(selected);

    return (
        <View style={{ flexDirection: 'row', height: '100%' }}>
            {!isEmbedded && (
                // A ScrollView shares the leftover space by default. Pin the list width.
                <ScrollView
                    style={{ width: 240, flexGrow: 0, flexShrink: 0, borderRightWidth: 1, borderColor: '#e0e0e0' }}>
                    {names.map((name) => (
                        <Pressable key={name} onPress={() => setSelected(name)} style={{ padding: 12 }}>
                            <Text style={{ fontWeight: name === selected ? 'bold' : 'normal' }}>{name}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            )}
            <View style={{ flex: 1 }}>
                {loaded.status === 'loading' && <Message text='Loading…' />}
                {loaded.status === 'failed' && (
                    // The wording is deliberately distinctive. The capture script detects a broken
                    // declaration by this phrase, and a generic "could not load" would also match
                    // the error text a declaration mocks on purpose for its failure state.
                    <Message text={`Failed to load preview declaration: ${selected}\n\n${loaded.reason}`} />
                )}
                {loaded.status === 'ready' && <PreviewGrid spec={loaded.spec} name={selected} />}
            </View>
        </View>
    );
};
