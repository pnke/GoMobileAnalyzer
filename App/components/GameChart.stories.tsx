import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { GameChart } from './GameChart';

const meta: Meta<typeof GameChart> = {
    title: 'components/GameChart',
    component: GameChart,
    argTypes: {
        onSelectMove: { action: 'onSelectMove' },
        onScrub: { action: 'onScrub' },
        onTitlePress: { action: 'onTitlePress' },
    },
    decorators: [
        (Story) => (
            <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof GameChart>;

const sampleData = Array.from({ length: 50 }, (_, i) => Math.sin(i * 0.2) * 20 + 50);

export const Default: Story = {
    args: {
        data: sampleData,
        title: 'Game Analysis',
        yRange: { min: 0, max: 100 },
        yAxisLabels: ['100%', '50%', '0%'],
        currentMoveIndex: 25,
        errorIndices: [10, 35],
    },
};

export const Empty: Story = {
    args: {
        data: [],
        title: 'No Data',
        yRange: { min: 0, max: 100 },
        yAxisLabels: [],
        currentMoveIndex: 0,
    },
};
