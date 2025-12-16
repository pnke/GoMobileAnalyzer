import React from 'react';
import { View, Button } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { AnalysisSettingsModal } from './AnalysisSettingsModal';

const meta: Meta<typeof AnalysisSettingsModal> = {
    title: 'components/AnalysisSettingsModal',
    component: AnalysisSettingsModal,
    argTypes: {
        onClose: { action: 'onClose' },
        onStartAnalysis: { action: 'onStartAnalysis' },
    },
    decorators: [
        (Story) => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Button title="Background Context" onPress={() => { }} />
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof AnalysisSettingsModal>;

export const Visible: Story = {
    args: {
        visible: true,
    },
};

export const Hidden: Story = {
    args: {
        visible: false,
    },
};
