import { MoveNode } from '@/lib/types';

// =============================================================================
// State Definition
// =============================================================================

export interface AnalysisProgress {
    current: number;
    total: number;
    isStreaming: boolean;
}

export interface GameState {
    // UI State
    scrubbingNode: MoveNode | null;
    analysisMode: 'winrate' | 'score';

    // Analysis State
    isAnalyzing: boolean;
    analysisProgress: AnalysisProgress;
}

export const initialGameState: GameState = {
    scrubbingNode: null,
    analysisMode: 'winrate',
    isAnalyzing: false,
    analysisProgress: {
        current: 0,
        total: 0,
        isStreaming: false,
    },
};

// =============================================================================
// Action Types
// =============================================================================

export type GameAction =
    // UI Actions
    | { type: 'SET_SCRUBBING_NODE'; payload: MoveNode | null }
    | { type: 'SET_ANALYSIS_MODE'; payload: 'winrate' | 'score' }
    | { type: 'TOGGLE_ANALYSIS_MODE' }

    // Analysis Actions
    | { type: 'START_ANALYSIS'; payload?: { streaming: boolean } }
    | { type: 'UPDATE_PROGRESS'; payload: { current: number; total: number } }
    | { type: 'COMPLETE_ANALYSIS' }
    | { type: 'ANALYSIS_ERROR' };

// =============================================================================
// Reducer
// =============================================================================

export const gameReducer = (state: GameState, action: GameAction): GameState => {
    switch (action.type) {
        // UI Actions
        case 'SET_SCRUBBING_NODE':
            return { ...state, scrubbingNode: action.payload };

        case 'SET_ANALYSIS_MODE':
            return { ...state, analysisMode: action.payload };

        case 'TOGGLE_ANALYSIS_MODE':
            return {
                ...state,
                analysisMode: state.analysisMode === 'winrate' ? 'score' : 'winrate',
            };

        // Analysis Actions
        case 'START_ANALYSIS':
            return {
                ...state,
                isAnalyzing: true,
                analysisProgress: {
                    current: 0,
                    total: 0,
                    isStreaming: action.payload?.streaming ?? true,
                },
            };

        case 'UPDATE_PROGRESS':
            return {
                ...state,
                analysisProgress: {
                    ...state.analysisProgress,
                    current: action.payload.current,
                    total: action.payload.total,
                },
            };

        case 'COMPLETE_ANALYSIS':
            return {
                ...state,
                isAnalyzing: false,
                analysisProgress: {
                    ...state.analysisProgress,
                    isStreaming: false,
                },
            };

        case 'ANALYSIS_ERROR':
            return {
                ...state,
                isAnalyzing: false,
                analysisProgress: {
                    ...state.analysisProgress,
                    isStreaming: false,
                },
            };

        default:
            return state;
    }
};
