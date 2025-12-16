import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { AnalysisSettings } from './AnalysisSettings';

const meta: Meta<typeof AnalysisSettings> = {
    title: 'features/analysis/AnalysisSettings',
    component: AnalysisSettings,
    argTypes: {
        onStartAnalysis: { action: 'onStartAnalysis' },
    },
    decorators: [
        (Story) => (
            <View style={{ padding: 20, flex: 1, backgroundColor: '#fff' }}>
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof AnalysisSettings>;

export const Default: Story = {};
