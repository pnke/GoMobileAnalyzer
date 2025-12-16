import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { BoardGrid } from './BoardGrid';

const meta: Meta<typeof BoardGrid> = {
    title: 'components/BoardGrid',
    component: BoardGrid,
    decorators: [
        (Story) => (
            <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: '#DBB08C' }}>
                <View style={{ width: 300, height: 300, position: 'relative' }}>
                    <Story />
                </View>
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof BoardGrid>;

export const Standard19x19: Story = {
    args: {
        cellSize: 300 / 19,
        boardDimension: 300,
        lineColor: '#000',
        coordTextColor: '#000',
    },
};

export const CustomColors: Story = {
    args: {
        cellSize: 300 / 19,
        boardDimension: 300,
        lineColor: 'blue',
        coordTextColor: 'red',
    },
};
