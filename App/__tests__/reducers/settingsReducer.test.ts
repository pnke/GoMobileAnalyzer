import {
    settingsReducer,
    initialSettingsState,
    SettingsState,
    DEFAULT_BACKEND_CONFIG,
} from '@settings/settingsReducer';

describe('settingsReducer', () => {
    it('should return initial state for unknown action', () => {
        const state = settingsReducer(initialSettingsState, { type: 'UNKNOWN' } as any);
        expect(state).toEqual(initialSettingsState);
    });

    describe('display settings', () => {
        it('should handle SET_SHOW_COMMENTS', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_SHOW_COMMENTS',
                payload: true,
            });
            expect(state.showComments).toBe(true);
        });

        it('should handle SET_SHOW_ALTERNATIVES', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_SHOW_ALTERNATIVES',
                payload: false,
            });
            expect(state.showAlternatives).toBe(false);
        });

        it('should handle SET_THEME_MODE', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_THEME_MODE',
                payload: 'dark',
            });
            expect(state.themeMode).toBe('dark');
        });
    });

    describe('error threshold settings', () => {
        it('should handle SET_ERROR_THRESHOLD_ENABLED', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_ERROR_THRESHOLD_ENABLED',
                payload: false,
            });
            expect(state.errorThresholdEnabled).toBe(false);
        });

        it('should handle SET_ERROR_THRESHOLD_MODE', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_ERROR_THRESHOLD_MODE',
                payload: 'score',
            });
            expect(state.errorThresholdMode).toBe('score');
        });

        it('should handle SET_WINRATE_THRESHOLD', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_WINRATE_THRESHOLD',
                payload: 15,
            });
            expect(state.winrateThreshold).toBe(15);
        });

        it('should handle SET_SCORE_THRESHOLD', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_SCORE_THRESHOLD',
                payload: 3,
            });
            expect(state.scoreThreshold).toBe(3);
        });
    });

    describe('ghost stone settings', () => {
        it('should handle SET_GHOST_STONE_DISPLAY', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_GHOST_STONE_DISPLAY',
                payload: 'delta',
            });
            expect(state.ghostStoneDisplay).toBe('delta');
        });

        it('should handle SET_GHOST_STONE_COUNT', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_GHOST_STONE_COUNT',
                payload: 5,
            });
            expect(state.ghostStoneCount).toBe(5);
        });

        it('should handle SET_ALTERNATIVE_MOVE_COUNT', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_ALTERNATIVE_MOVE_COUNT',
                payload: 8,
            });
            expect(state.alternativeMoveCount).toBe(8);
        });
    });

    describe('backend configuration', () => {
        it('should handle SET_BACKEND_CONFIG', () => {
            const newConfig = {
                ...DEFAULT_BACKEND_CONFIG,
                mode: 'runpod' as const,
                runpodEndpoint: 'https://api.runpod.io',
            };
            const state = settingsReducer(initialSettingsState, {
                type: 'SET_BACKEND_CONFIG',
                payload: newConfig,
            });
            expect(state.backendConfig.mode).toBe('runpod');
            expect(state.backendConfig.runpodEndpoint).toBe('https://api.runpod.io');
        });
    });

    describe('bulk operations', () => {
        it('should handle LOAD_SETTINGS with partial payload', () => {
            const state = settingsReducer(initialSettingsState, {
                type: 'LOAD_SETTINGS',
                payload: {
                    themeMode: 'dark',
                    ghostStoneCount: 7,
                },
            });
            expect(state.themeMode).toBe('dark');
            expect(state.ghostStoneCount).toBe(7);
            // Other values should remain default
            expect(state.showComments).toBe(false);
        });

        it('should handle RESET_TO_DEFAULTS', () => {
            const modifiedState: SettingsState = {
                ...initialSettingsState,
                themeMode: 'dark',
                showComments: true,
                ghostStoneCount: 10,
            };
            const state = settingsReducer(modifiedState, { type: 'RESET_TO_DEFAULTS' });
            expect(state).toEqual(initialSettingsState);
        });
    });
});
