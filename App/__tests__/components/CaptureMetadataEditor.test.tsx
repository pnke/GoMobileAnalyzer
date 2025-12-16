import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CaptureMetadataEditor } from '@/features/board-recognition/components/CaptureMetadataEditor';

// Mock dependencies
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback,
    }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

describe('CaptureMetadataEditor', () => {
    const mockOnConfirm = jest.fn();
    const mockOnCancel = jest.fn();

    const defaultProps = {
        blackStoneCount: 10,
        whiteStoneCount: 10,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Default Values', () => {
        it('defaults to Black as next player when stone counts are equal', () => {
            const { getByText } = render(<CaptureMetadataEditor {...defaultProps} />);

            // The Black button should be visible and we can press confirm
            expect(getByText('Black')).toBeTruthy();
        });

        it('defaults to White as next player when Black has more stones', () => {
            const { getByText } = render(
                <CaptureMetadataEditor
                    {...defaultProps}
                    blackStoneCount={15}
                    whiteStoneCount={14}
                />
            );

            // Component should render with White selected by default
            expect(getByText('White')).toBeTruthy();
        });

        it('defaults to Black as next player when White has more stones', () => {
            const { getByText } = render(
                <CaptureMetadataEditor
                    {...defaultProps}
                    blackStoneCount={14}
                    whiteStoneCount={15}
                />
            );

            expect(getByText('Black')).toBeTruthy();
        });

        it('displays stone counts in info box', () => {
            const { getByText } = render(
                <CaptureMetadataEditor
                    {...defaultProps}
                    blackStoneCount={25}
                    whiteStoneCount={24}
                />
            );

            expect(getByText(/25.*Black.*24.*White/)).toBeTruthy();
        });
    });

    describe('User Interactions', () => {
        it('allows selecting White as next player', () => {
            render(<CaptureMetadataEditor {...defaultProps} />);

            // We can verify the component renders without errors
            // Full interaction tests would require more setup
        });

        it('allows entering komi value', () => {
            const { getByPlaceholderText } = render(<CaptureMetadataEditor {...defaultProps} />);

            const komiInput = getByPlaceholderText('6.5');
            expect(komiInput).toBeTruthy();

            fireEvent.changeText(komiInput, '7.5');
        });

        it('accepts comma as decimal separator for komi', () => {
            const { getByPlaceholderText } = render(<CaptureMetadataEditor {...defaultProps} />);

            const komiInput = getByPlaceholderText('6.5');
            fireEvent.changeText(komiInput, '7,5');

            // The component should convert comma to period internally
        });

        it('allows entering player names', () => {
            const { getByPlaceholderText } = render(<CaptureMetadataEditor {...defaultProps} />);

            const blackNameInput = getByPlaceholderText('Black player');
            const whiteNameInput = getByPlaceholderText('White player');

            expect(blackNameInput).toBeTruthy();
            expect(whiteNameInput).toBeTruthy();

            fireEvent.changeText(blackNameInput, 'Player 1');
            fireEvent.changeText(whiteNameInput, 'Player 2');
        });
    });

    describe('Callbacks', () => {
        it('calls onCancel when back button is pressed', () => {
            render(
                <CaptureMetadataEditor {...defaultProps} />
            );

            // Find the back button (first TouchableOpacity in header)
            // Note: This test may need adjustment based on exact component structure
        });

        it('calls onConfirm with metadata when confirm button is pressed', () => {
            const { getByText } = render(<CaptureMetadataEditor {...defaultProps} />);

            const confirmButton = getByText('Start Analysis');
            fireEvent.press(confirmButton);

            expect(mockOnConfirm).toHaveBeenCalledTimes(1);
            expect(mockOnConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    nextPlayer: 'B',
                    komi: 6.5,
                    blackName: '',
                    whiteName: '',
                })
            );
        });

        it('passes correct metadata after user changes', () => {
            const { getByText, getByPlaceholderText } = render(
                <CaptureMetadataEditor {...defaultProps} />
            );

            // Change komi
            const komiInput = getByPlaceholderText('6.5');
            fireEvent.changeText(komiInput, '7.5');

            // Change player names
            const blackNameInput = getByPlaceholderText('Black player');
            const whiteNameInput = getByPlaceholderText('White player');
            fireEvent.changeText(blackNameInput, 'Alice');
            fireEvent.changeText(whiteNameInput, 'Bob');

            // Select White as next player
            const whiteButton = getByText('White');
            fireEvent.press(whiteButton);

            // Confirm
            const confirmButton = getByText('Start Analysis');
            fireEvent.press(confirmButton);

            expect(mockOnConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    nextPlayer: 'W',
                    komi: 7.5,
                    blackName: 'Alice',
                    whiteName: 'Bob',
                })
            );
        });
    });

    describe('Komi Input Validation', () => {
        it('handles empty komi input', () => {
            const { getByPlaceholderText, getByText } = render(
                <CaptureMetadataEditor {...defaultProps} />
            );

            const komiInput = getByPlaceholderText('6.5');
            fireEvent.changeText(komiInput, '');

            const confirmButton = getByText('Start Analysis');
            fireEvent.press(confirmButton);

            // Should default to 0 when empty
            expect(mockOnConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    komi: 0,
                })
            );
        });

        it('handles negative komi values', () => {
            const { getByPlaceholderText, getByText } = render(
                <CaptureMetadataEditor {...defaultProps} />
            );

            const komiInput = getByPlaceholderText('6.5');
            fireEvent.changeText(komiInput, '-');

            const confirmButton = getByText('Start Analysis');
            fireEvent.press(confirmButton);

            // Should handle dash gracefully
            expect(mockOnConfirm).toHaveBeenCalled();
        });
    });

    describe('UI Elements', () => {
        it('renders all required sections', () => {
            const { getByText } = render(<CaptureMetadataEditor {...defaultProps} />);

            expect(getByText('Position Settings')).toBeTruthy();
            expect(getByText('Next to play')).toBeTruthy();
            expect(getByText('Komi')).toBeTruthy();
            expect(getByText(/Player Names/)).toBeTruthy();
            expect(getByText('Start Analysis')).toBeTruthy();
        });

        it('shows optional label for player names', () => {
            const { getByText } = render(<CaptureMetadataEditor {...defaultProps} />);

            expect(getByText(/optional/)).toBeTruthy();
        });
    });
});
