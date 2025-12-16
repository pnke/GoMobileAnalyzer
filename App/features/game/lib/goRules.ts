// GoAnalysisApp/lib/goRules.ts
// Go game rules: capture detection, liberty counting, group finding, Ko rule

import { Stone } from '@/lib/types';
import { BOARD_SIZE } from '@/constants/game';

/**
 * Create a hash of the board state for comparison
 */
export const hashBoard = (board: number[][]): string => {
    return board.map(row => row.join('')).join('');
};

/**
 * Apply a move to a board and return the resulting board state
 * (placing stone and removing captures)
 */
export const applyMove = (
    board: number[][],
    row: number,
    col: number,
    player: number
): number[][] => {
    const newBoard = board.map((r) => [...r]);
    const rowData = newBoard[row];
    if (rowData) rowData[col] = player;

    // Remove captured stones
    const captures = findCaptures(board, row, col, player);
    for (const stone of captures) {
        const capturedRow = newBoard[stone.row];
        if (capturedRow) capturedRow[stone.col] = 0;
    }

    return newBoard;
};

/**
 * Check if a move would violate the Ko rule
 * (recreating the previous board position)
 */
export const isKoViolation = (
    board: number[][],
    row: number,
    col: number,
    player: number,
    previousBoardHash: string | null
): boolean => {
    if (!previousBoardHash) return false;

    // Calculate what the board would look like after this move
    const resultingBoard = applyMove(board, row, col, player);
    const resultingHash = hashBoard(resultingBoard);

    // If it matches the previous position, it's a Ko violation
    return resultingHash === previousBoardHash;
};

/**
 * Get all stones in a connected group (same color, orthogonally connected)
 * Uses flood-fill algorithm
 */
export const getGroup = (board: number[][], row: number, col: number): Stone[] => {
    const color = board[row]?.[col];
    if (!color || color === 0) return [];

    const group: Stone[] = [];
    const visited = new Set<string>();
    const stack: Stone[] = [{ row, col }];

    while (stack.length > 0) {
        const stone = stack.pop()!;
        const key = `${stone.row}-${stone.col}`;

        if (visited.has(key)) continue;
        visited.add(key);

        const stoneColor = board[stone.row]?.[stone.col];
        if (stoneColor !== color) continue;

        group.push(stone);

        // Check orthogonal neighbors
        const neighbors: Stone[] = [
            { row: stone.row - 1, col: stone.col },
            { row: stone.row + 1, col: stone.col },
            { row: stone.row, col: stone.col - 1 },
            { row: stone.row, col: stone.col + 1 },
        ];

        for (const neighbor of neighbors) {
            if (
                neighbor.row >= 0 &&
                neighbor.row < BOARD_SIZE &&
                neighbor.col >= 0 &&
                neighbor.col < BOARD_SIZE &&
                !visited.has(`${neighbor.row}-${neighbor.col}`)
            ) {
                stack.push(neighbor);
            }
        }
    }

    return group;
};

/**
 * Count liberties (empty adjacent points) of a group
 */
export const getLiberties = (board: number[][], group: Stone[]): number => {
    const liberties = new Set<string>();

    for (const stone of group) {
        const neighbors: Stone[] = [
            { row: stone.row - 1, col: stone.col },
            { row: stone.row + 1, col: stone.col },
            { row: stone.row, col: stone.col - 1 },
            { row: stone.row, col: stone.col + 1 },
        ];

        for (const neighbor of neighbors) {
            if (
                neighbor.row >= 0 &&
                neighbor.row < BOARD_SIZE &&
                neighbor.col >= 0 &&
                neighbor.col < BOARD_SIZE
            ) {
                const neighborColor = board[neighbor.row]?.[neighbor.col];
                if (neighborColor === 0) {
                    liberties.add(`${neighbor.row}-${neighbor.col}`);
                }
            }
        }
    }

    return liberties.size;
};

/**
 * Find all opponent stones that would be captured after placing a stone
 * Returns array of captured stones
 */
export const findCaptures = (
    board: number[][],
    row: number,
    col: number,
    player: number
): Stone[] => {
    // Create a copy of the board with the new stone placed
    const newBoard = board.map((r) => [...r]);
    const rowData = newBoard[row];
    if (rowData) rowData[col] = player;

    const opponent = player === 1 ? 2 : 1;
    const captured: Stone[] = [];
    const checkedGroups = new Set<string>();

    // Check all orthogonal neighbors for opponent groups
    const neighbors: Stone[] = [
        { row: row - 1, col: col },
        { row: row + 1, col: col },
        { row: row, col: col - 1 },
        { row: row, col: col + 1 },
    ];

    for (const neighbor of neighbors) {
        if (
            neighbor.row >= 0 &&
            neighbor.row < BOARD_SIZE &&
            neighbor.col >= 0 &&
            neighbor.col < BOARD_SIZE
        ) {
            const neighborColor = newBoard[neighbor.row]?.[neighbor.col];
            if (neighborColor === opponent) {
                const groupKey = `${neighbor.row}-${neighbor.col}`;
                if (checkedGroups.has(groupKey)) continue;

                const group = getGroup(newBoard, neighbor.row, neighbor.col);

                // Mark all stones in this group as checked
                for (const stone of group) {
                    checkedGroups.add(`${stone.row}-${stone.col}`);
                }

                const liberties = getLiberties(newBoard, group);
                if (liberties === 0) {
                    captured.push(...group);
                }
            }
        }
    }

    return captured;
};

/**
 * Check if a move is valid (not suicide, unless it captures, not Ko)
 */
export const isValidMove = (
    board: number[][],
    row: number,
    col: number,
    player: number,
    previousBoardHash?: string | null
): boolean => {
    // Check if position is occupied
    if (board[row]?.[col] !== 0) return false;

    // Check Ko rule
    if (previousBoardHash && isKoViolation(board, row, col, player, previousBoardHash)) {
        return false;
    }

    // Check if move captures opponent stones
    const captures = findCaptures(board, row, col, player);
    if (captures.length > 0) return true;

    // Check if move would be suicide (own group has no liberties)
    const newBoard = board.map((r) => [...r]);
    const rowData = newBoard[row];
    if (rowData) rowData[col] = player;

    const ownGroup = getGroup(newBoard, row, col);
    const liberties = getLiberties(newBoard, ownGroup);

    return liberties > 0;
};
