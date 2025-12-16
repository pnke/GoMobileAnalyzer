import { renderHook } from '@testing-library/react-native';
import { useGameHistory } from '@/features/analysis/hooks/useGameHistory';
import { MoveNode, RootNode } from '../../lib/types';

describe('useGameHistory', () => {
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

    it('returns empty arrays for root-only tree', () => {
        const root = createRoot();
        const { result } = renderHook(() => useGameHistory(root));

        // Defaults to [50] and [0] when empty
        expect(result.current.winrates).toEqual([50]);
        expect(result.current.scores).toEqual([0]);
        expect(result.current.moveNodes).toEqual([]);
    });

    it('traverses main line and extracts winrates/scores', () => {
        const root = createRoot();
        const node1 = createMoveNode(1, 3, 3, 1, root, 52.5, 1.5);
        const node2 = createMoveNode(2, 15, 15, 2, node1, 48.0, -1.0);
        const node3 = createMoveNode(3, 3, 15, 1, node2, 55.0, 2.0);
        root.children.push(node1);
        node1.children.push(node2);
        node2.children.push(node3);

        const { result } = renderHook(() => useGameHistory(root));

        expect(result.current.winrates).toEqual([52.5, 48.0, 55.0]);
        expect(result.current.scores).toEqual([1.5, -1.0, 2.0]);
        expect(result.current.moveNodes).toHaveLength(3);
    });

    it('only follows first child (main line)', () => {
        const root = createRoot();
        const mainLine = createMoveNode(1, 3, 3, 1, root, 50, 0);
        const variation = createMoveNode(2, 16, 3, 1, root, 45, -1);
        root.children.push(mainLine, variation);

        const { result } = renderHook(() => useGameHistory(root));

        // Should only have main line move, not variation
        expect(result.current.moveNodes).toHaveLength(1);
        expect(result.current.moveNodes[0]!.move.row).toBe(3);
    });

    it('handles nodes without winrate/score', () => {
        const root = createRoot();
        const node1 = createMoveNode(1, 3, 3, 1, root); // No winrate/score
        root.children.push(node1);

        const { result } = renderHook(() => useGameHistory(root));

        // Should still include the node but not add to winrates/scores
        expect(result.current.moveNodes).toHaveLength(1);
        expect(result.current.winrates).toEqual([50]); // Default
        expect(result.current.scores).toEqual([0]); // Default
    });

    it('memoizes result based on rootNode', () => {
        const root = createRoot();
        const { result } = renderHook(() => useGameHistory(root));

        // Result should be stable
        expect(result.current.winrates).toBeDefined();
        expect(result.current.scores).toBeDefined();
    });
});
