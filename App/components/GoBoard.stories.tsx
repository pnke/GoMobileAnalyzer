import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { GoBoard } from './GoBoard';

const meta: Meta<typeof GoBoard> = {
    title: 'components/GoBoard',
    component: GoBoard,
    argTypes: {
        onCellPress: { action: 'onCellPress' },
    },
    decorators: [
        (Story) => (
            <View style={{ padding: 10, alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: '#f0f0f0' }}>
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof GoBoard>;

// Helper to create an empty 19x19 board
const emptyBoard = Array(19).fill(null).map(() => Array(19).fill(0));

const gameBoard = Array(19).fill(null).map(() => Array(19).fill(0));
if (gameBoard[3] && gameBoard[15] && gameBoard[9]) {
    gameBoard[3][3] = 1; // Black
    gameBoard[15][15] = 2; // White
    gameBoard[3][15] = 1; // Black
    gameBoard[15][3] = 2; // White
    gameBoard[9][9] = 1; // Tengen
}

export const Empty: Story = {
    args: {
        board: emptyBoard,
        mode: 'winrate',
        displayMode: 'absolute',
    },
};

export const GameState: Story = {
    args: {
        board: gameBoard,
        mode: 'winrate',
        displayMode: 'absolute',
    },
};

export const WinrateMode: Story = {
    args: {
        board: gameBoard,
        mode: 'winrate',
        displayMode: 'absolute',
        ghostStones: [
            { row: 4, col: 4, player: 1, winrate: 45, score: 0.5, pointsLost: 0.2 },
            { row: 16, col: 16, player: 1, winrate: 42, score: -0.5, pointsLost: 2.5 }
        ] as any
    },
};

export const MinimalDisplay: Story = {
    args: {
        board: gameBoard,
        mode: 'score',
        displayMode: 'absolute',
    },
};
