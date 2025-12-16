/**
 * Hook for syncing current node depth when root node changes.
 * Maintains user's position in the tree across analysis updates.
 */
import { useEffect, useRef } from 'react';
import { MoveNode, RootNode, isMoveNode } from '@/lib/types';

type DepthSyncParams = {
    rootNode: RootNode;
    currentNode: MoveNode | RootNode;
    setCurrentNode: React.Dispatch<React.SetStateAction<MoveNode | RootNode>>;
};

/**
 * Hook that syncs currentNode position when rootNode changes.
 * Preserves user's navigation depth across tree updates.
 */
export function useNodeDepthSync({
    rootNode,
    currentNode,
    setCurrentNode,
}: DepthSyncParams) {
    const currentDepthRef = useRef(0);

    // Update depth when currentNode changes
    useEffect(() => {
        let depth = 0;
        let node: MoveNode | RootNode | undefined = currentNode;
        while (node && isMoveNode(node)) {
            depth++;
            node = node.parent;
        }
        currentDepthRef.current = depth;
    }, [currentNode]);

    // Sync currentNode when rootNode changes
    useEffect(() => {
        let node: MoveNode | RootNode = rootNode;
        for (let i = 0; i < currentDepthRef.current; i++) {
            if (node.children.length > 0 && isMoveNode(node.children[0])) {
                node = node.children[0];
            } else {
                break;
            }
        }
        setCurrentNode(node);
    }, [rootNode, setCurrentNode]);
}
