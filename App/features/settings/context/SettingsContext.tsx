import React, {
    createContext,
    PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useCallback,
    useReducer,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import {
    settingsReducer,
    initialSettingsState,
    DEFAULT_BACKEND_CONFIG,
} from '../settingsReducer';

// Backend configuration types (re-exported for compatibility)
export type BackendMode = 'domain' | 'runpod';
export type BackendConfig = {
    mode: BackendMode;
    domainUrl: string;
    domainApiKey?: string;
    runpodEndpoint: string;
    runpodBearer?: string;
    runpodWorkerKey?: string;
};

// =============================================================================
// Context Type
// =============================================================================

type SettingsContextType = {
    // State values (from reducer)
    showComments: boolean;
    showAlternatives: boolean;
    themeMode: 'system' | 'light' | 'dark';
    errorThresholdEnabled: boolean;
    errorThresholdMode: 'winrate' | 'score';
    winrateThreshold: number;
    scoreThreshold: number;
    ghostStoneDisplay: 'delta' | 'absolute';
    ghostStoneCount: number;
    alternativeMoveCount: number;
    backendConfig: BackendConfig;

    // Setters (dispatch wrappers for compatibility)
    setShowComments: (value: boolean) => void;
    setShowAlternatives: (value: boolean) => void;
    setThemeMode: (mode: 'system' | 'light' | 'dark') => void;
    setErrorThresholdEnabled: (value: boolean) => void;
    setErrorThresholdMode: (value: 'winrate' | 'score') => void;
    setWinrateThreshold: (value: number) => void;
    setScoreThreshold: (value: number) => void;
    setGhostStoneDisplay: (value: 'delta' | 'absolute') => void;
    setGhostStoneCount: (value: number) => void;
    setAlternativeMoveCount: (value: number) => void;
    setBackendConfig: (cfg: BackendConfig) => Promise<void>;

    // Language (handled separately due to i18n integration)
    language: string;
    setLanguage: (lang: 'en' | 'de') => Promise<void>;

    // New: Reset to defaults
    resetToDefaults: () => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

export const SettingsProvider = ({ children }: PropsWithChildren) => {
    const { i18n } = useTranslation();
    const [state, dispatch] = useReducer(settingsReducer, initialSettingsState);

    // =========================================================================
    // Dispatch Wrappers (for API compatibility)
    // =========================================================================

    const setShowComments = useCallback((value: boolean) => {
        dispatch({ type: 'SET_SHOW_COMMENTS', payload: value });
    }, []);

    const setShowAlternatives = useCallback((value: boolean) => {
        dispatch({ type: 'SET_SHOW_ALTERNATIVES', payload: value });
    }, []);

    const setThemeMode = useCallback((mode: 'system' | 'light' | 'dark') => {
        dispatch({ type: 'SET_THEME_MODE', payload: mode });
        AsyncStorage.setItem('themeMode', mode).catch(e => console.error('Failed to save themeMode', e));
    }, []);

    const setErrorThresholdEnabled = useCallback((value: boolean) => {
        dispatch({ type: 'SET_ERROR_THRESHOLD_ENABLED', payload: value });
    }, []);

    const setErrorThresholdMode = useCallback((value: 'winrate' | 'score') => {
        dispatch({ type: 'SET_ERROR_THRESHOLD_MODE', payload: value });
    }, []);

    const setWinrateThreshold = useCallback((value: number) => {
        dispatch({ type: 'SET_WINRATE_THRESHOLD', payload: value });
    }, []);

    const setScoreThreshold = useCallback((value: number) => {
        dispatch({ type: 'SET_SCORE_THRESHOLD', payload: value });
    }, []);

    const setGhostStoneDisplay = useCallback((value: 'delta' | 'absolute') => {
        dispatch({ type: 'SET_GHOST_STONE_DISPLAY', payload: value });
        AsyncStorage.setItem('ghostStoneDisplay', value).catch(e => console.error('Failed to save ghostStoneDisplay', e));
    }, []);

    const setGhostStoneCount = useCallback((value: number) => {
        dispatch({ type: 'SET_GHOST_STONE_COUNT', payload: value });
        AsyncStorage.setItem('ghostStoneCount', String(value)).catch(console.error);
    }, []);

    const setAlternativeMoveCount = useCallback((value: number) => {
        dispatch({ type: 'SET_ALTERNATIVE_MOVE_COUNT', payload: value });
        AsyncStorage.setItem('alternativeMoveCount', String(value)).catch(console.error);
    }, []);

    const setBackendConfig = useCallback(async (newConfig: BackendConfig) => {
        dispatch({ type: 'SET_BACKEND_CONFIG', payload: newConfig });
        try {
            const publicConfig = {
                mode: newConfig.mode,
                domainUrl: newConfig.domainUrl,
                runpodEndpoint: newConfig.runpodEndpoint,
            };
            await AsyncStorage.setItem('backend_config_public', JSON.stringify(publicConfig));
            await SecureStore.setItemAsync('domainApiKey', newConfig.domainApiKey || '');
            await SecureStore.setItemAsync('runpodBearer', newConfig.runpodBearer || '');
            await SecureStore.setItemAsync('runpodWorkerKey', newConfig.runpodWorkerKey || '');
        } catch (e) {
            console.error(e);
        }
    }, []);

    const setLanguage = useCallback(async (lang: 'en' | 'de') => {
        await i18n.changeLanguage(lang);
        await AsyncStorage.setItem('lang', lang);
    }, [i18n]);

    const resetToDefaults = useCallback(() => {
        dispatch({ type: 'RESET_TO_DEFAULTS' });
    }, []);

    // =========================================================================
    // Load Settings on Mount
    // =========================================================================

    useEffect(() => {
        (async () => {
            try {
                // Load language
                const savedLang = await AsyncStorage.getItem('lang');
                if (savedLang && (savedLang === 'en' || savedLang === 'de')) {
                    await i18n.changeLanguage(savedLang);
                }

                // Load backend config
                const publicConfigJson = await AsyncStorage.getItem('backend_config_public');
                const publicConfig = publicConfigJson ? JSON.parse(publicConfigJson) : {};
                const domainApiKey = await SecureStore.getItemAsync('domainApiKey');
                const runpodBearer = await SecureStore.getItemAsync('runpodBearer');
                const runpodWorkerKey = await SecureStore.getItemAsync('runpodWorkerKey');

                const loadedBackendConfig: BackendConfig = {
                    ...DEFAULT_BACKEND_CONFIG,
                    ...publicConfig,
                    domainApiKey: domainApiKey || '',
                    runpodBearer: runpodBearer || '',
                    runpodWorkerKey: runpodWorkerKey || '',
                };

                // Load other settings
                const savedGhostDisplay = await AsyncStorage.getItem('ghostStoneDisplay');
                const savedGhostCount = await AsyncStorage.getItem('ghostStoneCount');
                const savedAltCount = await AsyncStorage.getItem('alternativeMoveCount');
                const savedTheme = await AsyncStorage.getItem('themeMode');

                // Bulk load all settings at once
                dispatch({
                    type: 'LOAD_SETTINGS',
                    payload: {
                        backendConfig: loadedBackendConfig,
                        ghostStoneDisplay: (savedGhostDisplay === 'delta' || savedGhostDisplay === 'absolute')
                            ? savedGhostDisplay : undefined,
                        ghostStoneCount: savedGhostCount ? parseInt(savedGhostCount, 10) : undefined,
                        alternativeMoveCount: savedAltCount ? parseInt(savedAltCount, 10) : undefined,
                        themeMode: (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')
                            ? savedTheme : undefined,
                    },
                });
            } catch (e) {
                console.error('Failed to load settings', e);
            }
        })();
    }, [i18n]);

    // =========================================================================
    // Context Value
    // =========================================================================

    const value = useMemo<SettingsContextType>(() => ({
        // State values
        showComments: state.showComments,
        showAlternatives: state.showAlternatives,
        themeMode: state.themeMode,
        errorThresholdEnabled: state.errorThresholdEnabled,
        errorThresholdMode: state.errorThresholdMode,
        winrateThreshold: state.winrateThreshold,
        scoreThreshold: state.scoreThreshold,
        ghostStoneDisplay: state.ghostStoneDisplay,
        ghostStoneCount: state.ghostStoneCount,
        alternativeMoveCount: state.alternativeMoveCount,
        backendConfig: state.backendConfig,

        // Setters
        setShowComments,
        setShowAlternatives,
        setThemeMode,
        setErrorThresholdEnabled,
        setErrorThresholdMode,
        setWinrateThreshold,
        setScoreThreshold,
        setGhostStoneDisplay,
        setGhostStoneCount,
        setAlternativeMoveCount,
        setBackendConfig,

        // Language
        language: i18n.language,
        setLanguage,

        // Reset
        resetToDefaults,
    }), [
        state,
        i18n.language,
        setShowComments,
        setShowAlternatives,
        setThemeMode,
        setErrorThresholdEnabled,
        setErrorThresholdMode,
        setWinrateThreshold,
        setScoreThreshold,
        setGhostStoneDisplay,
        setGhostStoneCount,
        setAlternativeMoveCount,
        setBackendConfig,
        setLanguage,
        resetToDefaults,
    ]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

// =============================================================================
// Hook
// =============================================================================

export const useSettingsContext = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettingsContext must be used within a SettingsProvider');
    }
    return context;
};
