import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { GameInfo } from './GameInfo';

const meta: Meta<typeof GameInfo> = {
    title: 'components/GameInfo',
    component: GameInfo,
    decorators: [
        (Story) => (
            <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof GameInfo>;

export const Start: Story = {
    args: {
        moveCount: 0,
        totalMoves: 250,
        capturedByBlack: 0,
        capturedByWhite: 0,
    },
};

export const MidGame: Story = {
    args: {
        moveCount: 125,
        totalMoves: 250,
        capturedByBlack: 5,
        capturedByWhite: 8,
    },
};

export const EndGame: Story = {
    args: {
        moveCount: 250,
        totalMoves: 250,
        capturedByBlack: 12,
        capturedByWhite: 15,
    },
};
