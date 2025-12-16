import React from 'react';
import { render } from '@testing-library/react-native';
import { GameInfo } from '../../components/GameInfo';

// Mock i18n
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { [key: string]: any }) => {
            if (options && Object.keys(options).length > 0) {
                // Simple interpolation for testing purposes
                let result = key;
                for (const optKey in options) {
                    result = result.replace(`{{${optKey}}}`, options[optKey].toString());
                }
                return result;
            }
            return key;
        }
    }),
}));

// Mock ThemedText to just return children in a Text
jest.mock('../../components/ThemedText', () => {
    const { Text } = require('react-native');
    return {
        ThemedText: ({ children }: any) => <Text>{children}</Text>,
    };
});

describe('GameInfo', () => {
    it('renders correctly with given props', () => {
        const { getByText } = render(
            <GameInfo
                moveCount={10}
                totalMoves={100}
                capturedByBlack={2}
                capturedByWhite={5}
            />
        );

        // Debug: Check if ANY text is rendered
        // expect(getByText(/game/)).toBeTruthy();

        // Basic check for numbers which shouldn't depend on i18n
        // Check for individual parts because they are rendered as sibling text nodes
        expect(getByText(/10/)).toBeTruthy();
        expect(getByText(/\//)).toBeTruthy();
        expect(getByText(/100/)).toBeTruthy();
        expect(getByText(/5/)).toBeTruthy();
        expect(getByText(/2/)).toBeTruthy();
    });
});
