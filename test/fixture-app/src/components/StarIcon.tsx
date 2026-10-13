import Svg, { Path } from 'react-native-svg';

type Props = {
    size: number;
};

export const StarIcon = ({ size }: Props) => (
    <Svg width={size} height={size} viewBox='0 0 24 24'>
        <Path d='M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z' fill='#F5A623' />
    </Svg>
);
