import React from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
import { SettingsProvider, useSettingsContext } from '@settings/context/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Button, Text, View } from 'react-native';

// Mocks
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('expo-secure-store', () => ({
    setItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
}));

const mockI18n = {
    language: 'en',
    changeLanguage: jest.fn(),
};

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: mockI18n,
    }),
}));

const TestComponent = () => {
    const {
        backendConfig, setBackendConfig,
        themeMode, setThemeMode,
        language, setLanguage,
        setGhostStoneCount
    } = useSettingsContext();

    return (
        <View>
            <Text testID="mode">{backendConfig.mode}</Text>
            <Text testID="theme">{themeMode}</Text>
            <Text testID="lang">{language}</Text>
            <Button
                title="Update Config"
                onPress={() => setBackendConfig({
                    mode: 'runpod',
                    domainUrl: 'http://domain',
                    runpodEndpoint: 'http://runpod',
                    domainApiKey: 'key1',
                    runpodBearer: 'bearer1',
                    runpodWorkerKey: 'worker1'
                })}
            />
            <Button title="Set Dark Mode" onPress={() => setThemeMode('dark')} />
            <Button title="Set German" onPress={() => setLanguage('de')} />
            <Button title="Set Ghost Count" onPress={() => setGhostStoneCount(5)} />
        </View>
    );
};

describe('SettingsContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loads settings on mount', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
            if (key === 'themeMode') return Promise.resolve('light');
            if (key === 'backend_config_public') return Promise.resolve(JSON.stringify({ mode: 'runpod' }));
            if (key === 'ghostStoneCount') return Promise.resolve('4');
            if (key === 'alternativeMoveCount') return Promise.resolve('7');
            if (key === 'ghostStoneDisplay') return Promise.resolve('delta');
            return Promise.resolve(null);
        });
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('secret-val');

        const { getByTestId } = render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await waitFor(() => {
            expect(getByTestId('theme').props.children).toBe('light');
            expect(getByTestId('mode').props.children).toBe('runpod');
        });
    });

    it('updates backend config and persists securely', async () => {
        const { getByText, getByTestId } = render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await act(async () => {
            fireEvent.press(getByText('Update Config'));
        });

        await waitFor(() => {
            expect(getByTestId('mode').props.children).toBe('runpod');
        });

        // Verify public config saved to AsyncStorage
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            'backend_config_public',
            expect.stringContaining('"mode":"runpod"')
        );

        // Verify secrets saved to SecureStore
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('domainApiKey', 'key1');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('runpodBearer', 'bearer1');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('runpodWorkerKey', 'worker1');
    });

    it('updates theme and language', async () => {
        const { getByText } = render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await act(async () => {
            fireEvent.press(getByText('Set Dark Mode'));
        });

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('themeMode', 'dark');

        await act(async () => {
            fireEvent.press(getByText('Set German'));
        });

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('lang', 'de');
    });

    it('saves ghost stone count on change', async () => {
        const { getByText } = render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await act(async () => {
            fireEvent.press(getByText('Set Ghost Count'));
        });

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('ghostStoneCount', '5');
    });

    it('handles load errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Load failed'));

        render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        // Should not crash
        await waitFor(() => {
            expect(AsyncStorage.getItem).toHaveBeenCalled();
        });
        consoleSpy.mockRestore();
    });

    it('handles save errors gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Save failed'));

        const { getByText } = render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await act(async () => {
            fireEvent.press(getByText('Set Ghost Count'));
        });

        // Current implementation now catches and logs
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('loads saved language (en)', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
            if (key === 'lang') return Promise.resolve('en');
            return Promise.resolve(null);
        });

        render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await waitFor(() => {
            expect(mockI18n.changeLanguage).toHaveBeenCalledWith('en');
        });
    });

    it('loads saved language (de)', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
            if (key === 'lang') return Promise.resolve('de');
            return Promise.resolve(null);
        });

        render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await waitFor(() => {
            expect(mockI18n.changeLanguage).toHaveBeenCalledWith('de');
        });
    });

    it('does not change language for invalid saved value', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
            if (key === 'lang') return Promise.resolve('fr'); // Invalid
            return Promise.resolve(null);
        });

        render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await waitFor(() => {
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('lang');
        });

        // Should not call changeLanguage for invalid 'fr'
        expect(mockI18n.changeLanguage).not.toHaveBeenCalledWith('fr');
    });

    it('handles ghostStoneDisplay absolute value', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
            if (key === 'ghostStoneDisplay') return Promise.resolve('absolute');
            return Promise.resolve(null);
        });

        render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await waitFor(() => {
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('ghostStoneDisplay');
        });
    });

    it('saves alternativeMoveCount when changed', async () => {
        const TestAltCountComponent = () => {
            const { setAlternativeMoveCount } = useSettingsContext();
            return (
                <Button title="Set Alt Count" onPress={() => setAlternativeMoveCount(10)} />
            );
        };

        const { getByText } = render(
            <SettingsProvider>
                <TestAltCountComponent />
            </SettingsProvider>
        );

        await act(async () => {
            fireEvent.press(getByText('Set Alt Count'));
        });

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('alternativeMoveCount', '10');
    });

    it('handles SecureStore errors gracefully during save', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore failed'));

        const { getByText } = render(
            <SettingsProvider>
                <TestComponent />
            </SettingsProvider>
        );

        await act(async () => {
            fireEvent.press(getByText('Update Config'));
        });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('handles ghostStoneDisplay save error gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        (AsyncStorage.setItem as jest.Mock).mockImplementation((key) => {
            if (key === 'ghostStoneDisplay') return Promise.reject(new Error('Save failed'));
            return Promise.resolve();
        });

        const TestGhostDisplayComponent = () => {
            const { setGhostStoneDisplay } = useSettingsContext();
            return (
                <Button title="Set Ghost Display" onPress={() => setGhostStoneDisplay('delta')} />
            );
        };

        const { getByText } = render(
            <SettingsProvider>
                <TestGhostDisplayComponent />
            </SettingsProvider>
        );

        await act(async () => {
            fireEvent.press(getByText('Set Ghost Display'));
        });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('throws error when useSettingsContext is used outside provider', () => {
        const TestOutsideProvider = () => {
            useSettingsContext();
            return null;
        };

        expect(() => {
            render(<TestOutsideProvider />);
        }).toThrow('useSettingsContext must be used within a SettingsProvider');
    });
});
