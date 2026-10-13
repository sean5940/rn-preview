import { Text, View } from 'react-native';
import { StarIcon } from './StarIcon';

type Props = {
    name: string;
};

export const Greeting = ({ name }: Props) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <StarIcon size={16} />
        <Text>Hello, {name}</Text>
    </View>
);
