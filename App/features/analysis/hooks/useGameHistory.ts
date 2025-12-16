import { useMemo } from 'react';
import { MoveNode, RootNode, isMoveNode } from '@/lib/types';

export const useGameHistory = (rootNode: RootNode) => {
    return useMemo(() => {
        const winrates: number[] = [];
        const scores: number[] = [];
        const nodes: MoveNode[] = [];

        function traverse(node: MoveNode | RootNode) {
            if (isMoveNode(node)) {

                const rawWinrate = node.move.winrate ?? 50;

                const rawScore = node.move.score ?? 0;


                winrates.push(rawWinrate);// always report score and winrate from black perspective
                scores.push(rawScore);
                nodes.push(node);
            }
            if (node.children?.[0]) traverse(node.children[0]);
        }
        traverse(rootNode);
        if (winrates.length === 0) winrates.push(50);
        if (scores.length === 0) scores.push(0);
        return { winrates, scores, moveNodes: nodes };
    }, [rootNode]);
};
