import { BackendConfig, BackendMode } from './context/SettingsContext';

// =============================================================================
// State Definition
// =============================================================================

export interface SettingsState {
    // Display settings
    showComments: boolean;
    showAlternatives: boolean;
    themeMode: 'system' | 'light' | 'dark';

    // Error threshold settings
    errorThresholdEnabled: boolean;
    errorThresholdMode: 'winrate' | 'score';
    winrateThreshold: number;
    scoreThreshold: number;

    // Ghost stone settings
    ghostStoneDisplay: 'delta' | 'absolute';
    ghostStoneCount: number;
    alternativeMoveCount: number;

    // Backend configuration
    backendConfig: BackendConfig;
}

export const DEFAULT_BACKEND_CONFIG: BackendConfig = {
    mode: 'domain' as BackendMode,
    domainUrl: '',
    domainApiKey: '',
    runpodEndpoint: '',
    runpodBearer: '',
    runpodWorkerKey: '',
};

export const initialSettingsState: SettingsState = {
    showComments: false,
    showAlternatives: true,
    themeMode: 'system',
    errorThresholdEnabled: true,
    errorThresholdMode: 'winrate',
    winrateThreshold: 10,
    scoreThreshold: 1,
    ghostStoneDisplay: 'absolute',
    ghostStoneCount: 3,
    alternativeMoveCount: 5,
    backendConfig: DEFAULT_BACKEND_CONFIG,
};

// =============================================================================
// Action Types
// =============================================================================

export type SettingsAction =
    // Display settings
    | { type: 'SET_SHOW_COMMENTS'; payload: boolean }
    | { type: 'SET_SHOW_ALTERNATIVES'; payload: boolean }
    | { type: 'SET_THEME_MODE'; payload: 'system' | 'light' | 'dark' }

    // Error threshold settings
    | { type: 'SET_ERROR_THRESHOLD_ENABLED'; payload: boolean }
    | { type: 'SET_ERROR_THRESHOLD_MODE'; payload: 'winrate' | 'score' }
    | { type: 'SET_WINRATE_THRESHOLD'; payload: number }
    | { type: 'SET_SCORE_THRESHOLD'; payload: number }

    // Ghost stone settings
    | { type: 'SET_GHOST_STONE_DISPLAY'; payload: 'delta' | 'absolute' }
    | { type: 'SET_GHOST_STONE_COUNT'; payload: number }
    | { type: 'SET_ALTERNATIVE_MOVE_COUNT'; payload: number }

    // Backend configuration
    | { type: 'SET_BACKEND_CONFIG'; payload: BackendConfig }

    // Bulk operations
    | { type: 'LOAD_SETTINGS'; payload: Partial<SettingsState> }
    | { type: 'RESET_TO_DEFAULTS' };

// =============================================================================
// Reducer
// =============================================================================

export const settingsReducer = (
    state: SettingsState,
    action: SettingsAction
): SettingsState => {
    switch (action.type) {
        // Display settings
        case 'SET_SHOW_COMMENTS':
            return { ...state, showComments: action.payload };
        case 'SET_SHOW_ALTERNATIVES':
            return { ...state, showAlternatives: action.payload };
        case 'SET_THEME_MODE':
            return { ...state, themeMode: action.payload };

        // Error threshold settings
        case 'SET_ERROR_THRESHOLD_ENABLED':
            return { ...state, errorThresholdEnabled: action.payload };
        case 'SET_ERROR_THRESHOLD_MODE':
            return { ...state, errorThresholdMode: action.payload };
        case 'SET_WINRATE_THRESHOLD':
            return { ...state, winrateThreshold: action.payload };
        case 'SET_SCORE_THRESHOLD':
            return { ...state, scoreThreshold: action.payload };

        // Ghost stone settings
        case 'SET_GHOST_STONE_DISPLAY':
            return { ...state, ghostStoneDisplay: action.payload };
        case 'SET_GHOST_STONE_COUNT':
            return { ...state, ghostStoneCount: action.payload };
        case 'SET_ALTERNATIVE_MOVE_COUNT':
            return { ...state, alternativeMoveCount: action.payload };

        // Backend configuration
        case 'SET_BACKEND_CONFIG':
            return { ...state, backendConfig: action.payload };

        // Bulk operations
        case 'LOAD_SETTINGS':
            return { ...state, ...action.payload };
        case 'RESET_TO_DEFAULTS':
            return initialSettingsState;

        default:
            return state;
    }
};
