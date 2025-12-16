import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import CornerEditor from './CornerEditor';

const meta: Meta<typeof CornerEditor> = {
    title: 'features/board-recognition/CornerEditor',
    component: CornerEditor,
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

type Story = StoryObj<typeof CornerEditor>;

export const Default: Story = {
    args: {
        // Base64 specific to test, usually we'd use a real image or mock
        previewBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        initialCorners: [
            [10, 10], [100, 10], [100, 100], [10, 100]
        ],
        imageWidth: 400,
        imageHeight: 400,
        boardSize: 19,
    },
};
