import { useMemo } from 'react';
import { Move, MoveNode, RootNode, isMoveNode, CachedBoardState } from '@/lib/types';
import { BOARD_SIZE } from '@/constants/game';
import { findCaptures } from '@game/lib/goRules';

type BoardState = {
    board: number[][];
    capturedByBlack: number;
    capturedByWhite: number;
};

/**
 * Deep clone a 2D board array for caching.
 * Using slice for performance over JSON.parse/stringify.
 */
const cloneBoard = (board: number[][]): number[][] => {
    return board.map(row => [...row]);
};

/**
 * Apply a single move to a board (mutates board).
 * Returns updated capture counts.
 */
const applyMoveToBoard = (
    board: number[][],
    move: Move,
    capturedByBlack: number,
    capturedByWhite: number
): { capturedByBlack: number; capturedByWhite: number } => {
    // Handle setup stones first
    if (move.setupStones?.length) {
        for (const stone of move.setupStones) {
            if (stone.row >= 0 && stone.row < BOARD_SIZE && stone.col >= 0 && stone.col < BOARD_SIZE) {
                const rowData = board[stone.row];
                if (rowData) rowData[stone.col] = stone.player;
            }
        }
        return { capturedByBlack, capturedByWhite };
    }

    // Regular move with capture calculation
    if (move.row >= 0 && move.row < BOARD_SIZE && move.col >= 0 && move.col < BOARD_SIZE) {
        // 1. Calculate and remove captures
        const captures = findCaptures(board, move.row, move.col, move.player);

        for (const stone of captures) {
            const row = board[stone.row];
            if (row) {
                row[stone.col] = 0;
            }
        }

        // 2. Place the stone
        const moveRow = board[move.row];
        if (moveRow) {
            moveRow[move.col] = move.player;
        }

        // 3. Update capture counts
        if (move.player === 1) {
            capturedByWhite += captures.length;
        } else {
            capturedByBlack += captures.length;
        }
    }

    return { capturedByBlack, capturedByWhite };
};

/**
 * Compute board state with caching for O(1) navigation.
 *
 * Strategy:
 * 1. If node has cached state, return it immediately (O(1))
 * 2. If parent has cached state, apply single move (O(1))
 * 3. Otherwise, compute from root and cache (O(n) first time only)
 */
const computeBoardState = (activeNode: MoveNode | RootNode | undefined): BoardState => {
    // 1. Check if this node already has cached state
    if (isMoveNode(activeNode) && activeNode._cachedBoardState) {
        return activeNode._cachedBoardState;
    }

    // 2. Try to use parent's cache for incremental update (single move = O(1))
    if (isMoveNode(activeNode) && activeNode.parent) {
        const parent = activeNode.parent;

        // Check if parent has cached state
        let parentState: BoardState | undefined;

        if (isMoveNode(parent) && parent._cachedBoardState) {
            parentState = parent._cachedBoardState;
        } else if (!isMoveNode(parent)) {
            // Parent is RootNode - compute initial state from setup stones
            parentState = computeRootState(parent);
        }

        if (parentState) {
            // Clone parent's board and apply single move
            const board = cloneBoard(parentState.board);
            const { capturedByBlack, capturedByWhite } = applyMoveToBoard(
                board,
                activeNode.move,
                parentState.capturedByBlack,
                parentState.capturedByWhite
            );

            const result: CachedBoardState = { board, capturedByBlack, capturedByWhite };

            // Cache the result on the node for future access
            activeNode._cachedBoardState = result;

            return result;
        }
    }

    // 3. Fallback: Full computation from root (happens first time or for root)
    return computeFromRoot(activeNode);
};

/**
 * Compute initial state from RootNode (setup stones only).
 */
const computeRootState = (rootNode: RootNode): BoardState => {
    const board: number[][] = Array.from({ length: BOARD_SIZE }, () =>
        Array(BOARD_SIZE).fill(0)
    );

    if (rootNode.setupStones) {
        for (const stone of rootNode.setupStones) {
            if (stone.row >= 0 && stone.row < BOARD_SIZE && stone.col >= 0 && stone.col < BOARD_SIZE) {
                const rowData = board[stone.row];
                if (rowData) rowData[stone.col] = stone.player;
            }
        }
    }

    return { board, capturedByBlack: 0, capturedByWhite: 0 };
};

/**
 * Full computation from root (original algorithm).
 * Used when no cached states are available.
 */
const computeFromRoot = (activeNode: MoveNode | RootNode | undefined): BoardState => {
    // Build path from root to activeNode
    const path: MoveNode[] = [];
    let curr: MoveNode | RootNode | undefined = activeNode;

    while (isMoveNode(curr)) {
        path.push(curr);
        curr = curr.parent;
    }
    path.reverse();

    // Get root state
    const rootNode = curr as RootNode | undefined;
    let state = rootNode ? computeRootState(rootNode) : {
        board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
        capturedByBlack: 0,
        capturedByWhite: 0
    };

    // Apply each move and cache along the way
    for (const node of path) {
        // Clone board for this node
        const board = cloneBoard(state.board);
        const { capturedByBlack, capturedByWhite } = applyMoveToBoard(
            board,
            node.move,
            state.capturedByBlack,
            state.capturedByWhite
        );

        state = { board, capturedByBlack, capturedByWhite };

        // Cache on each node in path for future navigation
        node._cachedBoardState = state;
    }

    return state;
};

export const useGoBoardLogic = (activeNode: MoveNode | RootNode | undefined) => {
    // Use useMemo for synchronous, memoized computation
    // This updates in the SAME render cycle as activeNode changes
    const { board, capturedByBlack, capturedByWhite } = useMemo(
        () => computeBoardState(activeNode),
        [activeNode]
    );

    return { board, capturedByBlack, capturedByWhite };
};
