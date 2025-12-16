import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { ModernButton } from './ModernButton';

const meta: Meta<typeof ModernButton> = {
    title: 'components/ModernButton',
    component: ModernButton,
    argTypes: {
        onPress: { action: 'onPress' },
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

type Story = StoryObj<typeof ModernButton>;

export const Primary: Story = {
    args: {
        title: 'Primary Action',
        style: { backgroundColor: '#007AFF' }
    },
};

export const Secondary: Story = {
    args: {
        title: 'Secondary Action',
        style: { backgroundColor: '#5856D6' }
    },
};

export const Disabled: Story = {
    args: {
        title: 'Disabled Action',
        disabled: true,
    },
};

export const Danger: Story = {
    args: {
        title: 'Danger Action',
        style: { backgroundColor: '#FF3B30' }
    },
};
