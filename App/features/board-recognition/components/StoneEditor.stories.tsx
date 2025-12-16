import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import StoneEditor from './StoneEditor';

const meta: Meta<typeof StoneEditor> = {
    title: 'features/board-recognition/StoneEditor',
    component: StoneEditor,
    argTypes: {
        onConfirm: { action: 'onConfirm' },
        onCancel: { action: 'onCancel' },
    },
    decorators: [
        (Story) => (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof StoneEditor>;

// 19x19 empty board
const initialBoard = Array(19).fill(null).map(() => Array(19).fill(0));
if (initialBoard[3] && initialBoard[15]) {
    initialBoard[3][3] = 1; // Black
    initialBoard[15][15] = 2; // White
}

export const Default: Story = {
    args: {
        initialBoard: initialBoard,
        boardSize: 19,
        // Optional background
        backgroundImageBase64: undefined,
    },
};

export const WithBackground: Story = {
    args: {
        initialBoard: initialBoard,
        boardSize: 19,
        backgroundImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    },
};
