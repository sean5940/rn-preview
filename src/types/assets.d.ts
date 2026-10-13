/**
 * Target projects use `.svg` as a component through react-native-svg-transformer.
 * The declaration that lives in their tsconfig is absent here, so the same shape is provided.
 */
declare module '*.svg' {
    import type { FC } from 'react';
    import type { SvgProps } from 'react-native-svg';

    const content: FC<SvgProps>;
    export default content;
}
