import {
    gameReducer,
    initialGameState,
    GameState,
    GameAction,
} from '@game/gameReducer';
import { MoveNode } from '../../lib/types';

describe('gameReducer', () => {
    describe('UI actions', () => {
        it('should return initial state for unknown action', () => {
            // @ts-ignore - test with unknown action
            expect(gameReducer(initialGameState, { type: 'UNKNOWN' })).toEqual(initialGameState);
        });

        it('should handle SET_SCRUBBING_NODE', () => {
            const mockNode: MoveNode = { id: 1, children: [], move: { row: 0, col: 0, player: 1 } };
            const action: GameAction = { type: 'SET_SCRUBBING_NODE', payload: mockNode };
            const newState = gameReducer(initialGameState, action);
            expect(newState.scrubbingNode).toEqual(mockNode);
        });

        it('should handle SET_SCRUBBING_NODE with null', () => {
            const stateWithNode: GameState = {
                ...initialGameState,
                scrubbingNode: { id: 1, children: [], move: { row: 0, col: 0, player: 1 } },
            };
            const newState = gameReducer(stateWithNode, { type: 'SET_SCRUBBING_NODE', payload: null });
            expect(newState.scrubbingNode).toBeNull();
        });

        it('should handle SET_ANALYSIS_MODE', () => {
            const action: GameAction = { type: 'SET_ANALYSIS_MODE', payload: 'score' };
            const newState = gameReducer(initialGameState, action);
            expect(newState.analysisMode).toEqual('score');
        });

        it('should handle TOGGLE_ANALYSIS_MODE from winrate to score', () => {
            const action: GameAction = { type: 'TOGGLE_ANALYSIS_MODE' };
            const newState = gameReducer(initialGameState, action);
            expect(newState.analysisMode).toEqual('score');
        });

        it('should handle TOGGLE_ANALYSIS_MODE from score to winrate', () => {
            const scoreState: GameState = { ...initialGameState, analysisMode: 'score' };
            const newState = gameReducer(scoreState, { type: 'TOGGLE_ANALYSIS_MODE' });
            expect(newState.analysisMode).toEqual('winrate');
        });
    });

    describe('analysis actions', () => {
        it('should handle START_ANALYSIS with streaming', () => {
            const newState = gameReducer(initialGameState, {
                type: 'START_ANALYSIS',
                payload: { streaming: true },
            });
            expect(newState.isAnalyzing).toBe(true);
            expect(newState.analysisProgress.isStreaming).toBe(true);
            expect(newState.analysisProgress.current).toBe(0);
            expect(newState.analysisProgress.total).toBe(0);
        });

        it('should handle START_ANALYSIS without streaming', () => {
            const newState = gameReducer(initialGameState, {
                type: 'START_ANALYSIS',
                payload: { streaming: false },
            });
            expect(newState.isAnalyzing).toBe(true);
            expect(newState.analysisProgress.isStreaming).toBe(false);
        });

        it('should handle START_ANALYSIS with default streaming=true', () => {
            const newState = gameReducer(initialGameState, { type: 'START_ANALYSIS' });
            expect(newState.isAnalyzing).toBe(true);
            expect(newState.analysisProgress.isStreaming).toBe(true);
        });

        it('should handle UPDATE_PROGRESS', () => {
            const analyzingState: GameState = {
                ...initialGameState,
                isAnalyzing: true,
                analysisProgress: { current: 0, total: 0, isStreaming: true },
            };
            const newState = gameReducer(analyzingState, {
                type: 'UPDATE_PROGRESS',
                payload: { current: 5, total: 100 },
            });
            expect(newState.analysisProgress.current).toBe(5);
            expect(newState.analysisProgress.total).toBe(100);
            expect(newState.analysisProgress.isStreaming).toBe(true); // Preserved
        });

        it('should handle COMPLETE_ANALYSIS', () => {
            const analyzingState: GameState = {
                ...initialGameState,
                isAnalyzing: true,
                analysisProgress: { current: 50, total: 100, isStreaming: true },
            };
            const newState = gameReducer(analyzingState, { type: 'COMPLETE_ANALYSIS' });
            expect(newState.isAnalyzing).toBe(false);
            expect(newState.analysisProgress.isStreaming).toBe(false);
            // current/total are preserved
            expect(newState.analysisProgress.current).toBe(50);
        });

        it('should handle ANALYSIS_ERROR', () => {
            const analyzingState: GameState = {
                ...initialGameState,
                isAnalyzing: true,
                analysisProgress: { current: 25, total: 100, isStreaming: true },
            };
            const newState = gameReducer(analyzingState, { type: 'ANALYSIS_ERROR' });
            expect(newState.isAnalyzing).toBe(false);
            expect(newState.analysisProgress.isStreaming).toBe(false);
        });
    });
});
