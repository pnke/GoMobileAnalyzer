import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { AnalysisInfo } from './AnalysisInfo';

const meta: Meta<typeof AnalysisInfo> = {
    title: 'components/AnalysisInfo',
    component: AnalysisInfo,
    decorators: [
        (Story) => (
            <View style={{ padding: 20, flex: 1, backgroundColor: '#f0f0f0' }}>
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof AnalysisInfo>;

export const WithComment: Story = {
    args: {
        comment: 'This is a very good move because it secures the corner while exerting influence towards the center.',
    },
};

export const NoComment: Story = {
    args: {
        comment: undefined,
    },
};

export const LongComment: Story = {
    args: {
        comment: 'This is a much longer comment to test how the component handles large amounts of text. It should wrap correctly and look good on different screen sizes. In the game of Go, comments can sometimes be quite detailed, explaining variations and strategic concepts.',
    },
};
