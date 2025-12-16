import React, {
    createContext,
    Dispatch,
    PropsWithChildren,
    SetStateAction,
    useContext,
    useMemo,
    useState,
    useCallback,
    useReducer,
    useRef,
} from 'react';
import { useTranslation } from 'react-i18next';

import { toLinearSgf } from '@game/lib/sgf';
import { MoveNode, RootNode, isMoveNode } from '@/lib/types'; // Add isMoveNode import
import { buildApiHeaders, getStreamingUrl } from '@/lib/apiUtils';
import { useSettingsContext } from '@settings/context/SettingsContext';
import { useError } from '@game/context/ErrorContext';
import { validateBackendConfig } from '@/lib/validateBackend';
import { useTreeOperations } from '@game/hooks/useTreeOperations';
import { useSgfLoader } from '@game/hooks/useSgfLoader';
import { useBatchAnalysis } from '@game/hooks/useBatchAnalysis';
import { useNodeDepthSync } from '@game/hooks/useNodeDepthSync';
import {
    gameReducer,
    initialGameState,
    GameAction,
    AnalysisProgress,
} from '../gameReducer';

// Re-export for compatibility
export type { AnalysisProgress } from '../gameReducer';

type GameContextType = {
    // Tree state
    rootNode: RootNode;
    setRootNode: Dispatch<SetStateAction<RootNode>>;
    currentNode: MoveNode | RootNode;
    setCurrentNode: Dispatch<SetStateAction<MoveNode | RootNode>>;
    isScoringMode: boolean;
    setIsScoringMode: Dispatch<SetStateAction<boolean>>;

    // From reducer
    isAnalyzing: boolean;
    analysisProgress: AnalysisProgress;
    scrubbingNode: MoveNode | null;
    analysisMode: 'winrate' | 'score';
    dispatchGameAction: Dispatch<GameAction>;

    // Actions
    handleLoadSgf: () => Promise<void>;
    handleStartAnalysis: (params: { steps: number, startTurn?: number, endTurn?: number, streaming?: boolean }) => Promise<void>;
    promoteVariation: () => void;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: PropsWithChildren) => {
    const { t } = useTranslation();
    const { backendConfig } = useSettingsContext();
    const { showError } = useError();

    // Reducer state
    const [gameState, dispatchGameAction] = useReducer(gameReducer, initialGameState);
    const { scrubbingNode, analysisMode, isAnalyzing, analysisProgress } = gameState;

    // Tree state (remains useState for complex object mutations)
    const [rootNode, setRootNode] = useState<RootNode>({ id: 0, children: [] });
    const [currentNode, setCurrentNode] = useState<MoveNode | RootNode>(rootNode);
    const [isScoringMode, setIsScoringMode] = useState(false);

    // Extracted hooks
    const { updateNodeAnalysis, promoteVariation: promoteVariationFn } = useTreeOperations();
    const { handleLoadSgf } = useSgfLoader({ setRootNode, setCurrentNode });

    // Ref to track the node IDs corresponding to the analysis stream turns
    const analysisPathIds = useRef<number[]>([]);

    // Stable setIsAnalyzing function - dispatch-based without isAnalyzing dependency
    const setIsAnalyzingStable = useCallback((value: boolean) => {
        if (value) {
            dispatchGameAction({ type: 'START_ANALYSIS', payload: { streaming: false } });
        } else {
            dispatchGameAction({ type: 'COMPLETE_ANALYSIS' });
        }
    }, [dispatchGameAction]);

    const { handleBatchAnalysis } = useBatchAnalysis({
        setRootNode,
        setCurrentNode,
        setIsAnalyzing: setIsAnalyzingStable,
    });

    // Depth sync - keeps currentNode in sync when rootNode changes
    useNodeDepthSync({ rootNode, currentNode, setCurrentNode });

    // Streaming analysis handler
    const handleStreamingAnalysis = useCallback(async (
        sgfData: string,
        params: { steps: number, startTurn?: number, endTurn?: number }
    ): Promise<void> => {
        const url = getStreamingUrl(backendConfig);
        dispatchGameAction({ type: 'START_ANALYSIS', payload: { streaming: true } });

        return new Promise<void>((resolve, reject) => {
            const EventSource = require('react-native-sse').default;

            const headers = buildApiHeaders(backendConfig, { 'Accept': 'text/event-stream' });

            const es = new EventSource(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    sgf: sgfData,
                    visits: params.steps,
                    start_turn: params.startTurn,
                    end_turn: params.endTurn
                }),
            });

            es.addEventListener('message', (event: { data: string }) => {
                try {
                    if (!event.data?.trim()) return;
                    const data = JSON.parse(event.data);

                    if (data.done) {
                        dispatchGameAction({ type: 'COMPLETE_ANALYSIS' });
                        showError(t('alerts.complete'), 'success');
                        es.close();
                        resolve();
                        return;
                    }

                    if (data.error) {
                        es.close();
                        reject(new Error(data.error));
                        return;
                    }

                    dispatchGameAction({
                        type: 'UPDATE_PROGRESS',
                        payload: { current: data.turn + 1, total: data.total }
                    });
                    const nextPlayer = data.rootInfo?.currentPlayer === 'W' ? 2 : 1;

                    // Map turn to Node ID using the tracked path
                    // Backend sends turn indices starting at 1 (mapped to Move 1).
                    // analysisPathIds[0] is Root. analysisPathIds[1] is Move 1.
                    const nodeId = analysisPathIds.current[data.turn];

                    if (nodeId !== undefined) {
                        setRootNode(prev => updateNodeAnalysis(prev, nodeId, data.winrate, data.score, data.topMoves, nextPlayer));
                    }
                } catch (e) {
                    console.warn('Failed to parse SSE:', e);
                }
            });

            es.addEventListener('error', (error: unknown) => {
                es.close();
                dispatchGameAction({ type: 'ANALYSIS_ERROR' });
                reject(new Error(error instanceof Error ? error.message : 'Streaming failed'));
            });

            es.addEventListener('close', () => {
                dispatchGameAction({ type: 'COMPLETE_ANALYSIS' });
            });
        }).catch((error: unknown) => {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            showError(`${t('alerts.failed')}: ${msg}`, 'error');
            dispatchGameAction({ type: 'ANALYSIS_ERROR' });
        });
    }, [backendConfig, t, showError, updateNodeAnalysis]);

    // Main analysis entry point
    const handleStartAnalysis = useCallback(async (
        params: { steps: number, startTurn?: number, endTurn?: number, streaming?: boolean }
    ) => {
        const hasContent = rootNode.children.length > 0 || (rootNode.setupStones?.length ?? 0) > 0;
        if (!hasContent) {
            showError(t('alerts.noMoves'), 'warning');
            return;
        }

        if (isAnalyzing) {
            showError(t('alerts.analysisInProgress'), 'warning');
            return;
        }

        const validation = validateBackendConfig(backendConfig, t);
        if (!validation.isValid) {
            showError(validation.errorMessage || t('settings.configError'), 'error');
            return;
        }

        // Use leaf node to capture full history of the current variation
        const getLeafNode = (node: MoveNode | RootNode): MoveNode | RootNode => {
            let current = node;
            while (current.children && current.children.length > 0) {
                const next = current.children[0];
                if (next) {
                    current = next;
                } else {
                    break;
                }
            }
            return current;
        };
        const targetNode = getLeafNode(currentNode);

        // Capture the full path of IDs for result mapping
        const pathIds: number[] = [];
        let curr: MoveNode | RootNode | undefined = targetNode;
        while (curr) {
            pathIds.unshift(curr.id);
            if (isMoveNode(curr)) {
                curr = curr.parent;
            } else {
                curr = undefined;
            }
        }
        analysisPathIds.current = pathIds;

        const sgfData = toLinearSgf(rootNode, targetNode);

        if (params.streaming !== false) {
            await handleStreamingAnalysis(sgfData, params);
        } else {
            await handleBatchAnalysis(sgfData, params);
        }
    }, [rootNode, currentNode, backendConfig, t, showError, isAnalyzing, handleStreamingAnalysis, handleBatchAnalysis]);

    // Promote variation wrapper
    const promoteVariation = useCallback(() => {
        promoteVariationFn(currentNode, setRootNode);
    }, [currentNode, promoteVariationFn]);

    // Split value into separate memoized groups to reduce unnecessary re-renders
    // When only analysis state changes, tree consumers won't re-render

    // Group 1: Tree state (changes when navigating)
    const treeState = useMemo(() => ({
        rootNode, setRootNode,
        currentNode, setCurrentNode,
        isScoringMode, setIsScoringMode,
    }), [rootNode, currentNode, isScoringMode]);

    // Group 2: Analysis state (changes during analysis)
    const analysisState = useMemo(() => ({
        isAnalyzing, analysisProgress,
        scrubbingNode, analysisMode,
        dispatchGameAction,
    }), [isAnalyzing, analysisProgress, scrubbingNode, analysisMode]);

    // Group 3: Actions (stable references via useCallback)
    const actions = useMemo(() => ({
        handleLoadSgf, handleStartAnalysis, promoteVariation,
    }), [handleLoadSgf, handleStartAnalysis, promoteVariation]);

    // Combined value - still a single context but with optimized internal memoization
    const value = useMemo(() => ({
        ...treeState,
        ...analysisState,
        ...actions,
    }), [treeState, analysisState, actions]);

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGameContext = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGameContext must be used within a GameProvider');
    return context;
};
