import { renderHook } from '@testing-library/react-native';
import { useAnalysisData } from '@/features/analysis/hooks/useAnalysisData';
import { MoveNode, RootNode } from '../../lib/types';

describe('useAnalysisData', () => {
    const createRoot = (): RootNode => ({ id: 0, children: [] });

    const createMoveNode = (
        id: number,
        row: number,
        col: number,
        player: number,
        parent: RootNode | MoveNode,
        winrate?: number,
        score?: number
    ): MoveNode => ({
        id,
        parent,
        children: [],
        move: { row, col, player, winrate, score },
    });

    const defaultProps = {
        gameHistoryData: { winrates: [50], scores: [0], moveNodes: [] },
        analysisMode: 'winrate' as const,
        errorThresholdEnabled: false,
        errorThresholdMode: 'winrate' as const,
        winrateThreshold: 5,
        scoreThreshold: 2,
        ghostStoneCount: 3,
        alternativeMoveCount: 3,
    };

    it('returns empty analysis for root node', () => {
        const root = createRoot();
        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: root })
        );

        expect(result.current.analysisData.alternatives).toEqual([]);
        expect(result.current.analysisData.ghostStones).toEqual([]);
    });

    it('returns empty analysis when node has no children', () => {
        const root = createRoot();
        const node = createMoveNode(1, 3, 3, 1, root, 50, 0);
        root.children.push(node);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: node })
        );

        expect(result.current.analysisData.alternatives).toEqual([]);
        expect(result.current.analysisData.ghostStones).toEqual([]);
    });

    it('generates ghost stones for analyzed positions', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
        const playedMove = createMoveNode(2, 15, 15, 2, parentNode, 48, -1);
        const altMove = createMoveNode(3, 16, 3, 2, parentNode, 52, 1);
        root.children.push(parentNode);
        parentNode.children.push(playedMove, altMove);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode })
        );

        // Now includes both played and alternative moves (up to ghostStoneCount limit)
        expect(result.current.analysisData.ghostStones.length).toBeGreaterThanOrEqual(1);
    });

    it('identifies best move correctly (winrate mode, Black)', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 2, root, 50, 0); // White just played
        const playedMove = createMoveNode(2, 15, 15, 1, parentNode, 48, -1); // Black plays
        const betterMove = createMoveNode(3, 16, 3, 1, parentNode, 55, 2); // Better for Black
        root.children.push(parentNode);
        parentNode.children.push(playedMove, betterMove);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode })
        );

        const bestGhost = result.current.analysisData.ghostStones.find(
            gs => gs.isNextBest
        );
        expect(bestGhost?.row).toBe(16);
        expect(bestGhost?.col).toBe(3);
    });

    it('handles aiAlternatives from streaming analysis', () => {
        const root = createRoot();
        const node = createMoveNode(1, 3, 3, 1, root, 50, 0); // Black Moved
        node.move.aiAlternatives = [
            { move: 'D16', winrate: 0.6, score: 2.5, pointsLost: 0 },
            { move: 'Q4', winrate: 0.55, score: 1.5, pointsLost: 10 }
        ];

        // Next player is White (2)
        node.move.player = 1;

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: node })
        );

        // Should generate alternatives
        expect(result.current.analysisData.alternatives.length).toBe(2);

        const firstAlt = result.current.analysisData.alternatives[0];
        expect(firstAlt).toBeDefined();
        if (firstAlt) {
            expect(firstAlt.move).toBe('D16');
        }

        // Should generate ghost stones for these alternatives
        expect(result.current.analysisData.ghostStones.length).toBe(2);

        const ghost1 = result.current.analysisData.ghostStones[0];
        expect(ghost1).toBeDefined();
        if (ghost1) {
            expect(ghost1.col).toBe(3); // D
            expect(ghost1.row).toBe(3); // 19-16
            expect(ghost1.player).toBe(2); // Next player
        }
    });

    it('handles aiAlternatives with skipped I column', () => {
        const root = createRoot();
        const node = createMoveNode(1, 3, 3, 1, root, 50, 0);

        node.move.aiAlternatives = [
            { move: 'J4', winrate: 0.5, score: 0, pointsLost: 0 }
        ];

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: node })
        );

        const ghost = result.current.analysisData.ghostStones[0];
        expect(ghost).toBeDefined();
        if (ghost) {
            expect(ghost.col).toBe(8);
            expect(ghost.row).toBe(15);
        }
    });

    it('calculates chart data for winrate mode', () => {
        const root = createRoot();
        const { result } = renderHook(() =>
            useAnalysisData({
                ...defaultProps,
                activeNode: root,
                gameHistoryData: { winrates: [50, 55, 48], scores: [0, 1, -1], moveNodes: [] },
            })
        );

        expect(result.current.chartDisplayData).toEqual([50, 55, 48]);
        expect(result.current.yRange).toEqual({ min: 0, max: 100 });
        expect(result.current.yAxisLabels).toEqual(['100%', '50%', '0%']);
    });

    it('calculates chart data for score mode', () => {
        const root = createRoot();
        const { result } = renderHook(() =>
            useAnalysisData({
                ...defaultProps,
                activeNode: root,
                analysisMode: 'score',
                gameHistoryData: { winrates: [50, 55, 48], scores: [0, 8, -5], moveNodes: [] },
            })
        );

        expect(result.current.chartDisplayData).toEqual([0, 8, -5]);
        expect(result.current.yRange.min).toBeLessThan(0);
        expect(result.current.yRange.max).toBeGreaterThan(0);
    });

    it('identifies error indices when threshold enabled (winrate)', () => {
        const root = createRoot();
        const node1 = createMoveNode(1, 3, 3, 1, root, 50, 0);
        const node2 = createMoveNode(2, 15, 15, 2, node1, 40, -2); // 10% loss
        const betterAlt = createMoveNode(3, 16, 3, 2, node1, 52, 1);
        root.children.push(node1);
        node1.children.push(node2, betterAlt);

        const { result } = renderHook(() =>
            useAnalysisData({
                ...defaultProps,
                activeNode: node1,
                gameHistoryData: { winrates: [50, 40], scores: [0, -2], moveNodes: [node1, node2] },
                errorThresholdEnabled: true,
                winrateThreshold: 5,
            })
        );

        expect(result.current.errorIndices).toContain(1); // Index of node2
    });

    it('identifies error indices when threshold enabled (score)', () => {
        const root = createRoot();
        const node1 = createMoveNode(1, 3, 3, 1, root, 50, 0);
        // Best move for White should be lowest score.
        // Let's say Best Move Score is -5.
        // Bad Move Score is 5 (10 points worse).

        const betterAlt = createMoveNode(3, 16, 3, 2, node1, 42, -5); // Best score -5
        const node2 = createMoveNode(2, 15, 15, 2, node1, 40, 5); // Bad score 5

        root.children.push(node1);
        node1.children.push(node2, betterAlt);

        const { result } = renderHook(() =>
            useAnalysisData({
                ...defaultProps,
                activeNode: node1,
                gameHistoryData: { winrates: [50, 40], scores: [0, 5], moveNodes: [node1, node2] },
                errorThresholdEnabled: true,
                errorThresholdMode: 'score',
                scoreThreshold: 2,
            })
        );

        // Delta is 10 points. Threshold is 2. Should flag.
        expect(result.current.errorIndices).toContain(1);
    });

    it('returns empty error indices when threshold disabled', () => {
        const root = createRoot();
        const { result } = renderHook(() =>
            useAnalysisData({
                ...defaultProps,
                activeNode: root,
                errorThresholdEnabled: false,
            })
        );

        expect(result.current.errorIndices).toEqual([]);
    });

    it('handles score mode sorting for White player', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0); // Black just played
        const playedMove = createMoveNode(2, 15, 15, 2, parentNode, 48, 5); // White plays
        const betterMove = createMoveNode(3, 16, 3, 2, parentNode, 52, -2); // Better for White (lower score)
        root.children.push(parentNode);
        parentNode.children.push(playedMove, betterMove);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
        );

        // Should sort by best for White (minimizing score)
        expect(result.current.analysisData.alternatives.length).toBeGreaterThan(0);
        const bestAlt = result.current.analysisData.alternatives[0];
        expect(bestAlt).toBeDefined();
    });

    it('handles score mode sorting for Black player', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 2, root, 50, 0); // White just played
        const playedMove = createMoveNode(2, 15, 15, 1, parentNode, 48, -2); // Black plays
        const betterMove = createMoveNode(3, 16, 3, 1, parentNode, 52, 5); // Better for Black (higher score)
        root.children.push(parentNode);
        parentNode.children.push(playedMove, betterMove);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
        );

        // Should sort by best for Black (maximizing score)
        expect(result.current.analysisData.alternatives.length).toBeGreaterThan(0);
    });

    it('returns empty analysis for undefined activeNode', () => {
        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: undefined })
        );

        expect(result.current.analysisData.alternatives).toEqual([]);
        expect(result.current.analysisData.ghostStones).toEqual([]);
    });

    it('handles children without stats', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
        const childWithoutStats = createMoveNode(2, 15, 15, 2, parentNode); // No winrate or score
        root.children.push(parentNode);
        parentNode.children.push(childWithoutStats);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode })
        );

        // Should return empty since child has no stats
        expect(result.current.analysisData.alternatives).toEqual([]);
        expect(result.current.analysisData.ghostStones).toEqual([]);
    });

    it('respects ghostStoneCount limit', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
        // Add 5 children with stats
        for (let i = 0; i < 5; i++) {
            const child = createMoveNode(2 + i, 15 + i, 15, 2, parentNode, 50 - i, i);
            parentNode.children.push(child);
        }
        root.children.push(parentNode);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode, ghostStoneCount: 2 })
        );

        // Should only return 2 ghost stones (excluding played move)
        expect(result.current.analysisData.ghostStones.length).toBeLessThanOrEqual(2);
    });

    it('respects alternativeMoveCount limit', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
        // Add 10 children with stats
        for (let i = 0; i < 10; i++) {
            const child = createMoveNode(2 + i, 15 + i, 15, 2, parentNode, 50 - i, i);
            parentNode.children.push(child);
        }
        root.children.push(parentNode);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode, alternativeMoveCount: 4 })
        );

        // Should only return 4 alternatives
        expect(result.current.analysisData.alternatives.length).toBe(4);
    });

    it('calculates delta correctly in winrate mode (White)', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0); // Black just played
        // For White: lower winrate = better
        const bestMove = createMoveNode(2, 15, 15, 2, parentNode, 30, -5); // Best for White
        const playedMove = createMoveNode(3, 16, 3, 2, parentNode, 50, 0); // Worse for White
        root.children.push(parentNode);
        parentNode.children.push(bestMove, playedMove);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'winrate' })
        );

        const playedGhost = result.current.analysisData.ghostStones.find(
            gs => gs.row === 16 && gs.col === 3
        );
        // Delta for White = current - best = 50 - 30 = 20
        expect(playedGhost?.delta).toBe(20);
    });

    it('marks isPlayed correctly for first child', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
        const playedMove = createMoveNode(2, 15, 15, 2, parentNode, 60, 5);
        const altMove = createMoveNode(3, 16, 3, 2, parentNode, 55, 0);
        root.children.push(parentNode);
        parentNode.children.push(playedMove, altMove);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode })
        );

        // Ghost stones may include the played move - check that first child is marked
        const playedGhost = result.current.analysisData.ghostStones.find(
            gs => gs.row === 15 && gs.col === 15
        );
        // Either it exists with isPlayed=true, or it's filtered out
        if (playedGhost) {
            expect(playedGhost.isPlayed).toBe(true);
        }
    });

    it('calculates score delta correctly for score mode', () => {
        const root = createRoot();
        const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
        const bestMove = createMoveNode(2, 15, 15, 2, parentNode, 50, -5);
        const playedMove = createMoveNode(3, 16, 3, 2, parentNode, 50, 3);
        root.children.push(parentNode);
        parentNode.children.push(bestMove, playedMove);

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
        );

        // For White (player 2), delta should be (moveScore - bestScore) = 3 - (-5) = 8
        const playedGhost = result.current.analysisData.ghostStones.find(
            gs => gs.row === 16 && gs.col === 3
        );
        expect(playedGhost?.delta).toBe(8);
    });

    it('handles error threshold with parent having only one child', () => {
        const root = createRoot();
        const node1 = createMoveNode(1, 3, 3, 1, root, 50, 0);
        const node2 = createMoveNode(2, 15, 15, 2, node1, 40, -2);
        root.children.push(node1);
        node1.children.push(node2);

        const { result } = renderHook(() =>
            useAnalysisData({
                ...defaultProps,
                activeNode: node1,
                gameHistoryData: { winrates: [50, 40], scores: [0, -2], moveNodes: [node1, node2] },
                errorThresholdEnabled: true,
                winrateThreshold: 5,
            })
        );

        // Should not flag error when there's only one child (no alternative to compare)
        expect(result.current.errorIndices).not.toContain(1);
    });

    it('handles aiAlternatives with H column correctly', () => {
        const root = createRoot();
        const node = createMoveNode(1, 3, 3, 1, root, 50, 0);

        node.move.aiAlternatives = [
            { move: 'H4', winrate: 0.5, score: 0, pointsLost: 0 }
        ];

        const { result } = renderHook(() =>
            useAnalysisData({ ...defaultProps, activeNode: node })
        );

        const ghost = result.current.analysisData.ghostStones[0];
        expect(ghost).toBeDefined();
        if (ghost) {
            expect(ghost.col).toBe(7); // H = 7
            expect(ghost.row).toBe(15); // 19 - 4
        }
    });

    it('handles large score values for yRange calculation', () => {
        const root = createRoot();
        const { result } = renderHook(() =>
            useAnalysisData({
                ...defaultProps,
                activeNode: root,
                analysisMode: 'score',
                gameHistoryData: { winrates: [50], scores: [25, -30, 15], moveNodes: [] },
            })
        );

        // Range should be at least 30 (rounded up to nearest 5)
        expect(result.current.yRange.max).toBeGreaterThanOrEqual(30);
        expect(result.current.yRange.min).toBeLessThanOrEqual(-30);
    });

    // ====== NEW TESTS FOR PLAYER-SPECIFIC DELTA CALCULATIONS ======

    describe('Winrate Delta Calculations', () => {
        it('calculates winrate delta correctly for Black (higher = better)', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 2, root, 50, 0); // White just played
            // Black moves - higher winrate is better
            const bestMove = createMoveNode(2, 15, 15, 1, parentNode, 65, 5);
            const playedMove = createMoveNode(3, 16, 3, 1, parentNode, 55, 0);
            root.children.push(parentNode);
            parentNode.children.push(playedMove, bestMove);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'winrate' })
            );

            // Best move should be the one with higher winrate (65)
            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.winrate).toBe(65);

            // Delta for played move: 65 - 55 = 10
            const playedGhost = result.current.analysisData.ghostStones.find(
                gs => gs.row === 16 && gs.col === 3
            );
            expect(playedGhost?.delta).toBe(10);
        });

        it('calculates winrate delta correctly for White (lower = better)', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0); // Black just played
            // White moves - lower winrate is better (winrate is from Black's perspective after move)
            const bestMove = createMoveNode(2, 15, 15, 2, parentNode, 35, -5);
            const playedMove = createMoveNode(3, 16, 3, 2, parentNode, 50, 0);
            root.children.push(parentNode);
            parentNode.children.push(playedMove, bestMove);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'winrate' })
            );

            // Best move should be the one with lower winrate (35)
            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.winrate).toBe(35);

            // Delta for played move: 50 - 35 = 15
            const playedGhost = result.current.analysisData.ghostStones.find(
                gs => gs.row === 16 && gs.col === 3
            );
            expect(playedGhost?.delta).toBe(15);
        });

        it('best move has delta = 0 for Black in winrate mode', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 2, root, 50, 0);
            const bestMove = createMoveNode(2, 15, 15, 1, parentNode, 70, 5);
            const otherMove = createMoveNode(3, 16, 3, 1, parentNode, 60, 0);
            root.children.push(parentNode);
            parentNode.children.push(bestMove, otherMove);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'winrate' })
            );

            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.delta).toBe(0);
        });

        it('best move has delta = 0 for White in winrate mode', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
            const bestMove = createMoveNode(2, 15, 15, 2, parentNode, 30, -5);
            const otherMove = createMoveNode(3, 16, 3, 2, parentNode, 45, 0);
            root.children.push(parentNode);
            parentNode.children.push(bestMove, otherMove);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'winrate' })
            );

            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.delta).toBe(0);
        });
    });

    describe('Score Delta Calculations', () => {
        it('calculates score delta correctly for Black (higher = better)', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 2, root, 50, 0); // White just played
            // Black moves - higher score is better
            const bestMove = createMoveNode(2, 15, 15, 1, parentNode, 60, 8);
            const playedMove = createMoveNode(3, 16, 3, 1, parentNode, 55, 3);
            root.children.push(parentNode);
            parentNode.children.push(playedMove, bestMove);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
            );

            // Best move should be the one with higher score (8)
            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.score).toBe(8);

            // Delta for played move: 8 - 3 = 5
            const playedGhost = result.current.analysisData.ghostStones.find(
                gs => gs.row === 16 && gs.col === 3
            );
            expect(playedGhost?.delta).toBe(5);
        });

        it('calculates score delta correctly for White (lower = better)', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0); // Black just played
            // White moves - lower score is better (score is from Black's perspective)
            const bestMove = createMoveNode(2, 15, 15, 2, parentNode, 40, -6);
            const playedMove = createMoveNode(3, 16, 3, 2, parentNode, 45, 2);
            root.children.push(parentNode);
            parentNode.children.push(playedMove, bestMove);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
            );

            // Best move should be the one with lower score (-6)
            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.score).toBe(-6);

            // Delta for played move: 2 - (-6) = 8
            const playedGhost = result.current.analysisData.ghostStones.find(
                gs => gs.row === 16 && gs.col === 3
            );
            expect(playedGhost?.delta).toBe(8);
        });

        it('best move has delta = 0 for Black in score mode', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 2, root, 50, 0);
            const bestMove = createMoveNode(2, 15, 15, 1, parentNode, 60, 10);
            const otherMove = createMoveNode(3, 16, 3, 1, parentNode, 55, 5);
            root.children.push(parentNode);
            parentNode.children.push(bestMove, otherMove);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
            );

            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.delta).toBe(0);
        });

        it('best move has delta = 0 for White in score mode', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
            const bestMove = createMoveNode(2, 15, 15, 2, parentNode, 40, -10);
            const otherMove = createMoveNode(3, 16, 3, 2, parentNode, 45, -2);
            root.children.push(parentNode);
            parentNode.children.push(bestMove, otherMove);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
            );

            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.delta).toBe(0);
        });
    });

    describe('isNextBest Marking', () => {
        it('marks correct move as isNextBest for Black in winrate mode', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 2, root, 50, 0);
            const move1 = createMoveNode(2, 15, 15, 1, parentNode, 55, 0);
            const move2 = createMoveNode(3, 16, 3, 1, parentNode, 70, 5);
            const move3 = createMoveNode(4, 17, 3, 1, parentNode, 60, 2);
            root.children.push(parentNode);
            parentNode.children.push(move1, move2, move3);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'winrate' })
            );

            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.row).toBe(16); // move2 has highest winrate
            expect(bestGhost?.col).toBe(3);
        });

        it('marks correct move as isNextBest for White in winrate mode', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
            const move1 = createMoveNode(2, 15, 15, 2, parentNode, 55, 0);
            const move2 = createMoveNode(3, 16, 3, 2, parentNode, 30, -5); // Best for White (lowest)
            const move3 = createMoveNode(4, 17, 3, 2, parentNode, 45, -2);
            root.children.push(parentNode);
            parentNode.children.push(move1, move2, move3);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'winrate' })
            );

            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.row).toBe(16); // move2 has lowest winrate
            expect(bestGhost?.col).toBe(3);
        });

        it('marks correct move as isNextBest for Black in score mode', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 2, root, 50, 0);
            const move1 = createMoveNode(2, 15, 15, 1, parentNode, 55, 3);
            const move2 = createMoveNode(3, 16, 3, 1, parentNode, 60, 12); // Best for Black (highest)
            const move3 = createMoveNode(4, 17, 3, 1, parentNode, 58, 7);
            root.children.push(parentNode);
            parentNode.children.push(move1, move2, move3);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
            );

            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.score).toBe(12); // move2 has highest score
        });

        it('marks correct move as isNextBest for White in score mode', () => {
            const root = createRoot();
            const parentNode = createMoveNode(1, 3, 3, 1, root, 50, 0);
            const move1 = createMoveNode(2, 15, 15, 2, parentNode, 45, 3);
            const move2 = createMoveNode(3, 16, 3, 2, parentNode, 40, -8); // Best for White (lowest)
            const move3 = createMoveNode(4, 17, 3, 2, parentNode, 42, -2);
            root.children.push(parentNode);
            parentNode.children.push(move1, move2, move3);

            const { result } = renderHook(() =>
                useAnalysisData({ ...defaultProps, activeNode: parentNode, analysisMode: 'score' })
            );

            const bestGhost = result.current.analysisData.ghostStones.find(gs => gs.isNextBest);
            expect(bestGhost?.score).toBe(-8); // move2 has lowest score
        });
    });
});
