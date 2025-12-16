import { Move, MoveNode } from './types';

/**
 * Formats a move for display (e.g., "⚫ Q16").
 * @param move The move object containing player, col, and row.
 * @returns A formatted string representing the move.
 */
export const formatMove = (move: Move | MoveNode['move']) => {
    const player = move.player === 1 ? '⚫' : '⚪';
    const col = String.fromCharCode(65 + move.col); // A, B, C...
    const row = 19 - move.row;
    return `${player} ${col}${row}`;
};
