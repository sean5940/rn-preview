import { Children, forwardRef, useImperativeHandle, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native-web';
import type { StyleProp, ViewStyle } from 'react-native-web';

type Props = PropsWithChildren<{
    initialPage?: number;
    scrollEnabled?: boolean;
    style?: StyleProp<ViewStyle>;
}>;

type PagerViewHandle = {
    setPage: (page: number) => void;
    setPageWithoutAnimation: (page: number) => void;
};

/**
 * Stands in for `react-native-pager-view`, which ships native code only.
 *
 * Without a replacement the import resolves to the native module and the screen throws on render,
 * so every screen built out of pager steps captures as its error boundary instead of its content.
 *
 * Only the page that is showing is rendered. Swiping is a gesture the headless capture cannot make,
 * so the pages behind it would land in the capture as extra copy below the fold.
 */
const PagerView = forwardRef<PagerViewHandle, Props>(({ initialPage = 0, style, children }, ref) => {
    const [page, setPage] = useState(initialPage);

    useImperativeHandle(ref, () => ({ setPage, setPageWithoutAnimation: setPage }));

    const pages = Children.toArray(children);

    return <View style={style}>{pages[page] ?? null}</View>;
});

PagerView.displayName = 'PagerView';

export default PagerView;
