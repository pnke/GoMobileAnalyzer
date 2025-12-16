import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds';
import type { Preview } from '@storybook/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';

const preview: Preview = {
    decorators: [
        withBackgrounds,
        (Story: any) => (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <Story />
            </GestureHandlerRootView>
        ),
    ],
    parameters: {
        backgrounds: {
            default: 'plain',
            values: [
                { name: 'plain', value: 'white' },
                { name: 'dark', value: '#333' },
            ],
        },
        actions: { argTypesRegex: '^on[A-Z].*' },
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/,
            },
        },
    },
};

export default preview;
