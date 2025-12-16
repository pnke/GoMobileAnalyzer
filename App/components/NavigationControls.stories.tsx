import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { NavigationControls } from './NavigationControls';

const meta: Meta<typeof NavigationControls> = {
    title: 'components/NavigationControls',
    component: NavigationControls,
    argTypes: {
        onJumpToStart: { action: 'onJumpToStart' },
        onPrev10: { action: 'onPrev10' },
        onPrevMove: { action: 'onPrevMove' },
        onNextMove: { action: 'onNextMove' },
        onNext10: { action: 'onNext10' },
        onJumpToEnd: { action: 'onJumpToEnd' },
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

type Story = StoryObj<typeof NavigationControls>;

export const Default: Story = {
    args: {
        isAtStart: false,
        isAtEnd: false,
    },
};

export const AtStart: Story = {
    args: {
        isAtStart: true,
        isAtEnd: false,
    },
};

export const AtEnd: Story = {
    args: {
        isAtStart: false,
        isAtEnd: true,
    },
};
