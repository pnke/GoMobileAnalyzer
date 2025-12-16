import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { UnifiedMoveList } from './UnifiedMoveList';

const meta: Meta<typeof UnifiedMoveList> = {
    title: 'features/analysis/UnifiedMoveList',
    component: UnifiedMoveList,
    argTypes: {
        onSelectVariation: { action: 'onSelectVariation' },
    },
    decorators: [
        (Story) => (
            <View style={{ padding: 10, flex: 1, backgroundColor: '#f9f9f9' }}>
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof UnifiedMoveList>;

// Mock data
const mockAlternatives = [
    { move: 'D4', winrate: 0.46, score: -0.4, visits: 1000, pointsLost: 0.1 },
    { move: 'Q16', winrate: 0.45, score: -0.5, visits: 900, pointsLost: 0.2 },
    { move: 'K10', winrate: 0.40, score: -1.2, visits: 100, pointsLost: 1.5 },
];

export const Default: Story = {
    args: {
        variations: [
            { id: 1, move: { row: 3, col: 3, player: 1, comment: 'Main line' }, children: [] },
            { id: 2, move: { row: 15, col: 15, player: 2 }, children: [] }
        ],
        alternatives: [],
        mode: 'winrate',
    },
};

export const WithAlternatives: Story = {
    args: {
        alternatives: mockAlternatives,
        onSelectVariation: () => console.log('onSelectVariation'),
        mode: 'winrate',
    },
};

export const WinrateMode: Story = {
    args: {
        variations: [
            { id: 1, move: { row: 3, col: 3, player: 1, winrate: 55.0 }, children: [] }
        ],
        alternatives: [],
        mode: 'winrate',
    },
};

export const ScoreMode: Story = {
    args: {
        variations: [
            { id: 1, move: { row: 3, col: 3, player: 1, score: 1.5 }, children: [] }
        ],
        alternatives: [],
        mode: 'score',
    },
};
