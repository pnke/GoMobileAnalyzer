import { useMemo, useCallback, useTransition } from 'react';
import { useGameContext } from '@game/context/GameContext';
import { useSettingsContext } from '@settings/context/SettingsContext';
import { Move, MoveNode, RootNode, isMoveNode } from '@/lib/types';
import { useError } from '@game/context/ErrorContext';
import { useGameHistory } from './useGameHistory';
import { useGoBoardLogic } from './useGoBoardLogic';
import { useAnalysisData } from './useAnalysisData';
import { GameAction } from '@game/gameReducer';
import { exportSgfFile } from '@/lib/saveGame';
import { findCaptures, isValidMove, hashBoard } from '@game/lib/goRules';

export const useGameEngine = () => {
    const {
        rootNode,
        currentNode,
        setCurrentNode,
        scrubbingNode,
        analysisMode,
        dispatchGameAction,
    } = useGameContext();

    const {
        errorThresholdEnabled,
        errorThresholdMode,
        winrateThreshold,
        scoreThreshold,
        ghostStoneCount,
        alternativeMoveCount
    } = useSettingsContext();

    const { showError } = useError();

    const activeNode = scrubbingNode || currentNode;

    // 1. Game History
    const gameHistoryData = useGameHistory(rootNode);

    // 2. Board Logic
    const { board, capturedByBlack, capturedByWhite } = useGoBoardLogic(activeNode);

    // Use transition for non-blocking navigation
    const [, startTransition] = useTransition();

    // 3. Analysis Data
    const { analysisData, chartDisplayData, yAxisLabels, yRange, errorIndices } = useAnalysisData({
        activeNode,
        gameHistoryData,
        analysisMode,
        errorThresholdEnabled,
        errorThresholdMode,
        winrateThreshold,
        scoreThreshold,
        ghostStoneCount,
        alternativeMoveCount
    });

    // Navigation Handlers
    const handleCellPress = useCallback((row: number, col: number) => {
        // 1. Try to select existing variation
        if (trySelectExistingVariation(row, col, currentNode, dispatchGameAction, setCurrentNode)) {
            return;
        }

        // 2. Prepare move context (Player, Ko)
        const { nextPlayer, previousBoardHash } = getNextMoveContext(currentNode, board);

        // 3. Validate move
        if (!isValidMove(board, row, col, nextPlayer, previousBoardHash)) {
            showError("Invalid Move: This move is not allowed.", 'warning');
            return;
        }

        // 4. Execute new move
        executeNewMove(row, col, nextPlayer, board, currentNode, dispatchGameAction, setCurrentNode);
    }, [currentNode, board, setCurrentNode, showError, dispatchGameAction]);

    const handleToggleAnalysisMode = useCallback(() => {
        dispatchGameAction({ type: 'TOGGLE_ANALYSIS_MODE' });
    }, [dispatchGameAction]);

    const handleScrub = useCallback((index: number | null) => {
        if (index !== null && gameHistoryData.moveNodes[index]) {
            dispatchGameAction({ type: 'SET_SCRUBBING_NODE', payload: gameHistoryData.moveNodes[index] });
        } else {
            dispatchGameAction({ type: 'SET_SCRUBBING_NODE', payload: null });
        }
    }, [dispatchGameAction, gameHistoryData.moveNodes]);

    const handleSelectMove = useCallback((index: number) => {
        dispatchGameAction({ type: 'SET_SCRUBBING_NODE', payload: null });
        if (gameHistoryData.moveNodes?.[index]) setCurrentNode(gameHistoryData.moveNodes[index]);
    }, [dispatchGameAction, gameHistoryData.moveNodes, setCurrentNode]);

    const handlePrevMove = useCallback(() => {
        if (isMoveNode(currentNode) && currentNode.parent) {
            startTransition(() => {
                setCurrentNode(currentNode.parent!);
            });
        }
    }, [currentNode, setCurrentNode]);

    const handleNextMove = useCallback((variationIndex = 0) => {
        if (currentNode.children?.[variationIndex]) {
            startTransition(() => {
                setCurrentNode(currentNode.children[variationIndex]!);
            });
        }
    }, [currentNode, setCurrentNode]);

    const navigateSteps = useCallback((direction: 'prev' | 'next', count: number) => {
        let targetNode = currentNode;
        for (let i = 0; i < count; i++) {
            if (direction === 'prev') {
                if (isMoveNode(targetNode) && targetNode.parent) targetNode = targetNode.parent;
                else break;
            } else {
                if (targetNode.children?.[0]) targetNode = targetNode.children[0];
                else break;
            }
        }
        startTransition(() => {
            setCurrentNode(targetNode);
        });
    }, [currentNode, setCurrentNode]);

    const handlePrev10 = useCallback(() => navigateSteps('prev', 10), [navigateSteps]);
    const handleNext10 = useCallback(() => navigateSteps('next', 10), [navigateSteps]);

    const jumpToStart = useCallback(() => setCurrentNode(rootNode), [rootNode, setCurrentNode]);

    const jumpToEnd = useCallback(() => {
        let n = currentNode;
        while (n.children?.length > 0 && n.children[0]) n = n.children[0];
        setCurrentNode(n);
    }, [currentNode, setCurrentNode]);

    const { moveCount, totalMoves } = useMemo(() => {
        let count = 0; let n: MoveNode | RootNode = currentNode;
        while (isMoveNode(n) && n.parent) { count++; n = n.parent; }
        let total = count; let endNode = currentNode;
        while (endNode.children?.length > 0 && endNode.children[0]) { endNode = endNode.children[0]; total++; }
        return { moveCount: count, totalMoves: total };
    }, [currentNode]);

    const currentMoveIndex = useMemo(() => isMoveNode(activeNode) ? gameHistoryData.moveNodes.findIndex((node) => node.id === activeNode.id) : -1, [activeNode, gameHistoryData.moveNodes]);

    return {
        board,
        capturedByBlack,
        capturedByWhite,
        analysisMode,
        activeNode,
        currentNode,
        rootNode,
        gameHistoryData,
        analysisData,
        chartDisplayData,
        yAxisLabels,
        yRange,
        errorIndices,
        moveCount,
        totalMoves,
        currentMoveIndex,
        handleCellPress,
        handleToggleAnalysisMode,
        handleScrub,
        handleSelectMove,
        handlePrevMove,
        handleNextMove,
        handlePrev10,
        handleNext10,
        navigateSteps,
        jumpToStart,
        jumpToEnd,
        handleExportSgf: async () => {
            const result = await exportSgfFile(rootNode);
            if (!result.success && result.error) {
                showError(result.error);
            }
            return result;
        }
    };
};

// Helper Functions

const trySelectExistingVariation = (
    row: number,
    col: number,
    currentNode: MoveNode | RootNode,
    dispatch: React.Dispatch<GameAction>,
    setCurrentNode: (node: MoveNode | RootNode) => void
): boolean => {
    const clickedVariationNode = currentNode.children.find(
        (child) => isMoveNode(child) && child.move.row === row && child.move.col === col
    );

    if (clickedVariationNode) {
        dispatch({ type: 'SET_SCRUBBING_NODE', payload: null });
        setCurrentNode(clickedVariationNode);
        return true;
    }
    return false;
};

const getNextMoveContext = (
    currentNode: MoveNode | RootNode,
    board: number[][]
): { nextPlayer: number; previousBoardHash: string | null } => {
    let nextPlayer = 1;
    if (isMoveNode(currentNode)) {
        nextPlayer = currentNode.move.player === 1 ? 2 : 1;
    }

    let previousBoardHash: string | null = null;
    if (isMoveNode(currentNode) && isMoveNode(currentNode.parent)) {
        const grandparent = currentNode.parent.parent;
        if (grandparent) {
            previousBoardHash = hashBoard(board);
        }
    }

    return { nextPlayer, previousBoardHash };
};

const executeNewMove = (
    row: number,
    col: number,
    nextPlayer: number,
    board: number[][],
    currentNode: MoveNode | RootNode,
    dispatch: React.Dispatch<GameAction>,
    setCurrentNode: (node: MoveNode | RootNode) => void
) => {
    const captured = findCaptures(board, row, col, nextPlayer);

    const newMove: Move = {
        row,
        col,
        player: nextPlayer,
        captured: captured.length > 0 ? captured : undefined
    };

    const newNode: MoveNode = {
        id: Date.now(),
        parent: currentNode,
        children: [],
        move: newMove
    };

    currentNode.children.push(newNode);
    dispatch({ type: 'SET_SCRUBBING_NODE', payload: null });
    setCurrentNode(newNode);
};
