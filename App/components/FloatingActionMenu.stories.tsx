import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { FloatingActionMenu } from './FloatingActionMenu';

const meta: Meta<typeof FloatingActionMenu> = {
    title: 'components/FloatingActionMenu',
    component: FloatingActionMenu,
    argTypes: {
        onLoad: { action: 'onLoad' },
        onSave: { action: 'onSave' },
        onExport: { action: 'onExport' },
        onToggleAnalysis: { action: 'onToggleAnalysis' },
    },
    args: {
        onLoad: () => console.log('onLoad'),
        onSave: () => console.log('onSave'),
        onExport: () => console.log('onExport'),
        onToggleAnalysis: () => console.log('onToggleAnalysis'),
    },
    decorators: [
        (Story) => (
            <View style={{ flex: 1, minHeight: 400, backgroundColor: '#eee', justifyContent: 'flex-end', paddingBottom: 50 }}>
                <Story />
            </View>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof FloatingActionMenu>;

export const Default: Story = {}; // Removed isAnalysing from args

export const Expanded: Story = { // Replaced Analyzing story with Expanded
    play: async ({ canvasElement }) => {
        // We can interact with the component if needed,
        // but for now relying on user interaction
    }
};
