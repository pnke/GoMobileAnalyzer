/**
 * Hook for tree manipulation operations on game nodes.
 * Extracted from GameContext for modularity.
 */
import { useCallback, useRef } from 'react';
import { MoveNode, RootNode, isMoveNode, TopMove } from '@/lib/types';

/**
 * Parses a GTP move string (e.g., "D4") to row/col coordinates.
 * @param gtpMove - GTP format move string
 * @returns Object with row and col (0-indexed)
 */
export const parseGtpMove = (gtpMove: string): { row: number; col: number } => {
    const colChar = gtpMove.charAt(0).toUpperCase();
    // GTP skips 'I', so A-H = 0-7, J-T = 8-18
    const col = colChar.charCodeAt(0) - 65 - (colChar > 'I' ? 1 : 0);
    const row = 19 - parseInt(gtpMove.slice(1), 10);
    return { row, col };
};

/**
 * Hook providing tree manipulation operations for Go game trees.
 */
export function useTreeOperations() {
    // Counter for generating unique node IDs
    const nodeIdCounter = useRef(1000);
    const getNextNodeId = useCallback(() => ++nodeIdCounter.current, []);

    /**
     * Gets node at a specific turn (depth) in the main line.
     */
    const getNodeAtTurn = useCallback((root: RootNode, turn: number): MoveNode | null => {
        let current: MoveNode | RootNode = root;
        for (let i = 0; i < turn; i++) {
            const child: MoveNode | undefined = current.children[0];
            if (child) {
                current = child;
            } else {
                return null;
            }
        }
        return isMoveNode(current) ? current : null;
    }, []);

    /**
     * Finds a node by its ID using BFS.
     */
    const findNodeById = useCallback((root: RootNode, id: number): MoveNode | RootNode | null => {
        if (root.id === id) return root;
        const queue: (MoveNode | RootNode)[] = [root];
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current.id === id) return current;
            if (current.children) {
                queue.push(...current.children);
            }
        }
        return null;
    }, []);

    /**
     * Deep clones a MoveNode tree.
     */
    const cloneNode = useCallback((node: MoveNode, parent?: MoveNode | RootNode): MoveNode => {
        const cloned: MoveNode = {
            ...node,
            parent,
            move: { ...node.move },
            children: [],
        };
        cloned.children = node.children.map(child => cloneNode(child, cloned));
        return cloned;
    }, []);

    /**
     * Updates a node's analysis data and adds variation moves immutably.
     * @param root - Current root node
     * @param turn - Turn number to update
     * @param winrate - Winrate value
     * @param score - Score value
     * @param topMoves - Optional array of top moves from analysis
     * @param currentPlayerArg - Optional current player (1=Black, 2=White)
     * @returns New root node with updates applied
     */
    const updateNodeAnalysis = useCallback((
        root: RootNode,
        targetId: number, // Changed from turn to targetId
        winrate: number,
        score: number,
        topMoves?: TopMove[],
        currentPlayerArg?: number
    ): RootNode => {
        // Deep clone the tree
        const newRoot: RootNode = {
            ...root,
            children: [],
        };
        newRoot.children = root.children.map(child => cloneNode(child, newRoot));

        // Find and update the target node
        const targetNode = findNodeById(newRoot, targetId);
        if (targetNode && isMoveNode(targetNode)) {
            targetNode.move.winrate = winrate;
            targetNode.move.score = score;
        }

        // Determine parent for variations
        let parent: MoveNode | RootNode | undefined;
        let startPlayer = currentPlayerArg || 1;

        if (targetNode) {
            if (isMoveNode(targetNode)) {
                parent = targetNode.parent;
                startPlayer = targetNode.move.player;
            } else {
                parent = targetNode;
            }
        } else {
            // Fallback if targetNode not found (should not happen with valid ID)
            // But we can't reliably guess "prevNode" without path info.
            // If targetId was meant to be the node we just analyzed...
            // Assuming targetId IS the node we analyzed (and want to attach stats to).
            // So parent for variations is IT'S parent.
        }

        // Add topMoves as variations
        if (parent && topMoves && topMoves.length > 0) {
            const existingMoves = new Set(
                parent.children.map(c => isMoveNode(c) ? `${c.move.row},${c.move.col}` : '')
            );

            for (const topMove of topMoves) {
                const { row, col } = parseGtpMove(topMove.move);
                const moveKey = `${row},${col}`;

                if (existingMoves.has(moveKey)) continue;

                const pv: string[] = topMove.pv || [topMove.move];
                let currentParent: MoveNode | RootNode = parent;
                let currentPlayer = startPlayer;

                for (let i = 0; i < pv.length; i++) {
                    const pvMove = pv[i];
                    if (!pvMove) continue;
                    const { row: pvRow, col: pvCol } = parseGtpMove(pvMove);

                    const existingChild = currentParent.children.find(
                        c => isMoveNode(c) && c.move.row === pvRow && c.move.col === pvCol
                    ) as MoveNode | undefined;

                    if (existingChild) {
                        currentParent = existingChild;
                    } else {
                        const newNode: MoveNode = {
                            id: getNextNodeId(),
                            parent: currentParent,
                            children: [],
                            move: {
                                row: pvRow,
                                col: pvCol,
                                player: currentPlayer,
                                winrate: topMove.winrate,
                                score: topMove.scoreLead,
                                visits: topMove.visits,
                            }
                        };
                        currentParent.children.push(newNode);
                        currentParent = newNode;
                    }

                    currentPlayer = currentPlayer === 1 ? 2 : 1;
                }
                existingMoves.add(moveKey);
            }
        }

        return newRoot;
    }, [cloneNode, findNodeById, getNextNodeId]);

    /**
     * Promotes a variation to be the main line (first child).
     */
    const promoteVariation = useCallback((
        currentNode: MoveNode | RootNode,
        setRootNode: React.Dispatch<React.SetStateAction<RootNode>>
    ) => {
        if (!isMoveNode(currentNode)) return;
        const parent = currentNode.parent;
        if (!parent) return;

        const index = parent.children.findIndex(c => c.id === currentNode.id);
        if (index <= 0) return;

        const newChildren = [...parent.children];
        const first = newChildren[0];
        const current = newChildren[index];
        if (!first || !current) return;

        newChildren[0] = current;
        newChildren[index] = first;
        parent.children = newChildren;

        setRootNode(prev => ({ ...prev }));
    }, []);

    return {
        getNodeAtTurn,
        cloneNode,
        updateNodeAnalysis,
        promoteVariation,
        parseGtpMove,
        getNextNodeId,
    };
}
