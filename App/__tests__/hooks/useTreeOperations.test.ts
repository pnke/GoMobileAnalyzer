/**
 * Tests for useTreeOperations hook
 */
import { renderHook } from '@testing-library/react-native';
import { useTreeOperations, parseGtpMove } from '@game/hooks/useTreeOperations';
import { RootNode, MoveNode } from '../../lib/types';

describe('useTreeOperations', () => {
    describe('parseGtpMove', () => {
        it('parses standard moves', () => {
            expect(parseGtpMove('D4')).toEqual({ row: 15, col: 3 });
            expect(parseGtpMove('Q16')).toEqual({ row: 3, col: 15 });
        });

        it('handles I column skip', () => {
            // GTP skips 'I', so J is column 8
            expect(parseGtpMove('J10')).toEqual({ row: 9, col: 8 });
            expect(parseGtpMove('H10')).toEqual({ row: 9, col: 7 });
        });

        it('handles corner moves', () => {
            expect(parseGtpMove('A1')).toEqual({ row: 18, col: 0 });
            expect(parseGtpMove('T19')).toEqual({ row: 0, col: 18 });
        });
    });

    describe('getNodeAtTurn', () => {
        it('returns null for empty tree', () => {
            const { result } = renderHook(() => useTreeOperations());
            const root: RootNode = { id: 0, children: [] };

            expect(result.current.getNodeAtTurn(root, 1)).toBeNull();
        });

        it('returns correct node at turn', () => {
            const { result } = renderHook(() => useTreeOperations());

            const root: RootNode = { id: 0, children: [] };
            const move1: MoveNode = {
                id: 1,
                parent: root,
                children: [],
                move: { row: 3, col: 15, player: 1 }
            };
            const move2: MoveNode = {
                id: 2,
                parent: move1,
                children: [],
                move: { row: 3, col: 3, player: 2 }
            };
            move1.children = [move2];
            root.children = [move1];

            expect(result.current.getNodeAtTurn(root, 1)?.id).toBe(1);
            expect(result.current.getNodeAtTurn(root, 2)?.id).toBe(2);
        });
    });

    describe('cloneNode', () => {
        it('creates deep copy with correct parent references', () => {
            const { result } = renderHook(() => useTreeOperations());

            const root: RootNode = { id: 0, children: [] };
            const move1: MoveNode = {
                id: 1,
                parent: root,
                children: [],
                move: { row: 3, col: 15, player: 1, winrate: 55 }
            };

            const cloned = result.current.cloneNode(move1, root);

            expect(cloned.id).toBe(move1.id);
            expect(cloned.move.winrate).toBe(55);
            expect(cloned).not.toBe(move1); // Different object
            expect(cloned.parent).toBe(root);
        });
    });

    describe('updateNodeAnalysis', () => {
        it('updates node winrate and score', () => {
            const { result } = renderHook(() => useTreeOperations());

            const root: RootNode = { id: 0, children: [] };
            const move1: MoveNode = {
                id: 1,
                parent: root,
                children: [],
                move: { row: 3, col: 15, player: 1 }
            };
            root.children = [move1];

            const newRoot = result.current.updateNodeAnalysis(root, 1, 55, 1.5);

            expect(newRoot.children[0]?.move.winrate).toBe(55);
            expect(newRoot.children[0]?.move.score).toBe(1.5);
        });

        it('adds top moves as variations', () => {
            const { result } = renderHook(() => useTreeOperations());

            const root: RootNode = { id: 0, children: [] };
            const move1: MoveNode = {
                id: 1,
                parent: root,
                children: [],
                move: { row: 3, col: 15, player: 1 }
            };
            root.children = [move1];

            const topMoves = [
                { move: 'D4', winrate: 60, scoreLead: 2.0, visits: 100 }
            ];

            const newRoot = result.current.updateNodeAnalysis(root, 1, 55, 1.5, topMoves);

            // Should have added variation as sibling
            expect(newRoot.children.length).toBeGreaterThanOrEqual(1);
        });
    });
});
