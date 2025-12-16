import { renderHook } from '@testing-library/react-native';
import { useGoBoardLogic } from '@/features/analysis/hooks/useGoBoardLogic';
import { MoveNode, RootNode } from '../../lib/types';
import { BOARD_SIZE } from '../../constants/game';

describe('useGoBoardLogic', () => {
    const createRoot = (): RootNode => ({ id: 0, children: [] });

    const createMoveNode = (
        id: number,
        row: number,
        col: number,
        player: number,
        parent: RootNode | MoveNode,
        captured?: { row: number; col: number }[]
    ): MoveNode => ({
        id,
        parent,
        children: [],
        move: { row, col, player, captured },
    });

    it('initializes with empty board', () => {
        const root = createRoot();
        const { result } = renderHook(() => useGoBoardLogic(root));

        const flatBoard = result.current.board.flat();
        expect(flatBoard.every((cell: number) => cell === 0)).toBe(true);
        expect(result.current.capturedByBlack).toBe(0);
        expect(result.current.capturedByWhite).toBe(0);
    });

    it('handles forward move (placing stone)', () => {
        const root = createRoot();
        const node1 = createMoveNode(1, 3, 3, 1, root); // Black at D4
        root.children.push(node1);

        // Start at root
        let activeNode: MoveNode | RootNode = root;
        const { result, rerender } = renderHook(
            () => useGoBoardLogic(activeNode)
        );

        // Move to first node
        activeNode = node1;
        rerender({});

        expect(result.current.board[3]![3]).toBe(1); // Black stone placed
    });

    it('handles backward move (undo)', () => {
        const root = createRoot();
        const node1 = createMoveNode(1, 3, 3, 1, root);
        root.children.push(node1);

        // Start at node1
        let activeNode: MoveNode | RootNode = node1;
        const { result, rerender } = renderHook(
            () => useGoBoardLogic(activeNode)
        );

        // Go back to root
        activeNode = root;
        rerender({});

        expect(result.current.board[3]![3]).toBe(0); // Stone removed
    });

    it('handles captured stones correctly', () => {
        const root = createRoot();

        // Setup: White at (0,0), Black at (1,0)
        // White at (0,0) has 2 liberties: (0,1) and (1,0).
        // Black at (1,0) removes one liberty.
        root.setupStones = [
            { row: 0, col: 0, player: 2 },
            { row: 1, col: 0, player: 1 }
        ];

        // Black plays at (0,1) to capture White at (0,0)
        const blackMove = createMoveNode(1, 0, 1, 1, root);
        root.children.push(blackMove);

        // Start at root
        let activeNode: MoveNode | RootNode = root;
        const { result, rerender } = renderHook(
            () => useGoBoardLogic(activeNode)
        );

        activeNode = blackMove;
        rerender({});

        // Black played and captured White's stones
        expect(result.current.capturedByWhite).toBe(1);
        expect(result.current.board[0]![0]).toBe(0); // Captured stone at (0,0) removed
        expect(result.current.board[0]![1]).toBe(1); // Black stone at (0,1) placed
    });

    it('handles jump (full recalculation)', () => {
        const root = createRoot();
        const node1 = createMoveNode(1, 3, 3, 1, root);
        const node2 = createMoveNode(2, 15, 15, 2, node1);
        const node3 = createMoveNode(3, 3, 15, 1, node2);
        root.children.push(node1);
        node1.children.push(node2);
        node2.children.push(node3);

        // Start at root, jump to node3
        let activeNode: MoveNode | RootNode = root;
        const { result, rerender } = renderHook(
            () => useGoBoardLogic(activeNode)
        );

        activeNode = node3;
        rerender({});

        expect(result.current.board[3]![3]).toBe(1); // First move
        expect(result.current.board[15]![15]).toBe(2); // Second move
        expect(result.current.board[3]![15]).toBe(1); // Third move
    });

    it('handles undefined activeNode', () => {
        const { result } = renderHook(() => useGoBoardLogic(undefined));

        const flatBoard = result.current.board.flat();
        expect(flatBoard.every((cell: number) => cell === 0)).toBe(true);
    });

    it('board dimensions are correct', () => {
        const root = createRoot();
        const { result } = renderHook(() => useGoBoardLogic(root));

        expect(result.current.board.length).toBe(BOARD_SIZE);
        expect(result.current.board[0]!.length).toBe(BOARD_SIZE);
    });

    it('handles moves with setupStones', () => {
        const root = createRoot();
        const node = createMoveNode(1, -1, -1, 0, root);
        node.move.setupStones = [
            { row: 3, col: 3, player: 1 },
            { row: 16, col: 16, player: 2 }
        ];
        root.children.push(node);

        const { result } = renderHook(() => useGoBoardLogic(node));

        expect(result.current.board[3]![3]).toBe(1);
        expect(result.current.board[16]![16]).toBe(2);
    });
});
