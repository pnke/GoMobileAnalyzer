import React from 'react';
import { View, Button } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react';
import { ErrorProvider, useError } from '../features/game/context/ErrorContext';
import { ErrorToast } from './ErrorToast';

// Component to trigger errors for testing
const TriggerError = () => {
    const { showError } = useError();
    return (
        <View style={{ gap: 10 }}>
            <Button title="Show Error" color="red" onPress={() => showError('Something went wrong!', 'error')} />
            <Button title="Show Success" color="green" onPress={() => showError('Operation successful!', 'success')} />
            <Button title="Show Info" color="blue" onPress={() => showError('Just letting you know.', 'info')} />
        </View>
    );
};

const meta: Meta<typeof ErrorToast> = {
    title: 'components/ErrorToast',
    component: ErrorToast,
    decorators: [
        (Story) => (
            <ErrorProvider>
                <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <TriggerError />
                    <Story />
                </View>
            </ErrorProvider>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof ErrorToast>;

export const Interactive: Story = {};
