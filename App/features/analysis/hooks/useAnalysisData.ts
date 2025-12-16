import { useMemo } from 'react';
import { Move, MoveNode, RootNode, AIAlternative, isMoveNode } from '@/lib/types';

type UseAnalysisDataProps = {
    activeNode: MoveNode | RootNode | undefined;
    gameHistoryData: { winrates: number[]; scores: number[]; moveNodes: MoveNode[] };
    analysisMode: 'winrate' | 'score';
    errorThresholdEnabled: boolean;
    errorThresholdMode: 'winrate' | 'score';
    winrateThreshold: number;
    scoreThreshold: number;
    ghostStoneCount: number;
    alternativeMoveCount: number;
};

export const useAnalysisData = ({
    activeNode,
    gameHistoryData,
    analysisMode,
    errorThresholdEnabled,
    errorThresholdMode,
    winrateThreshold,
    scoreThreshold,
    ghostStoneCount,
    alternativeMoveCount
}: UseAnalysisDataProps) => {

    // Analysis Data
    const analysisData = useMemo(() => {
        if (!activeNode) return { alternatives: [], ghostStones: [] };

        // 1. SGF Variations (Existing children)
        if (activeNode.children.length > 0) {
            const childrenWithStats = activeNode.children.filter((node): node is MoveNode =>
                isMoveNode(node) &&
                typeof node.move.winrate === 'number' &&
                typeof node.move.score === 'number'
            );

            if (childrenWithStats.length > 0) {
                // Determine next player from first child
                const nextPlayer = childrenWithStats[0]!.move.player;

                // Sort by Winrate - higher winrate = better for the player to move
                // (KataGo returns winrate from perspective of player to move)
                const sortedSiblings = [...childrenWithStats].sort((a, b) =>
                    (b.move.winrate! - a.move.winrate!)
                );

                if (!sortedSiblings[0]) return { alternatives: [], ghostStones: [] };
                const firstChildId = activeNode.children[0]?.id;

                // Find the best move based on current mode and player
                let bestNode: typeof sortedSiblings[0];
                if (analysisMode === 'winrate') {
                    if (nextPlayer === 1) {
                        // Black's moves: higher winrate = better for Black
                        bestNode = sortedSiblings.reduce((best, n) =>
                            (n.move.winrate ?? -Infinity) > (best.move.winrate ?? -Infinity) ? n : best
                        );
                    } else {
                        // White's moves: lower winrate = better for White
                        bestNode = sortedSiblings.reduce((best, n) =>
                            (n.move.winrate ?? Infinity) < (best.move.winrate ?? Infinity) ? n : best
                        );
                    }
                } else {
                    // Score mode
                    if (nextPlayer === 1) {
                        // Black wants highest score (score is from Black's perspective)
                        bestNode = sortedSiblings.reduce((best, n) =>
                            (n.move.score ?? -Infinity) > (best.move.score ?? -Infinity) ? n : best
                        );
                    } else {
                        // White wants lowest score
                        bestNode = sortedSiblings.reduce((best, n) =>
                            (n.move.score ?? Infinity) < (best.move.score ?? Infinity) ? n : best
                        );
                    }
                }
                const bestMove = bestNode.move;

                const ghostStonesRaw: Move[] = sortedSiblings.map(node => {
                    const move = node.move;
                    let delta = 0;

                    if (analysisMode === 'winrate') {
                        // Winrate delta depends on player
                        if (nextPlayer === 1) {
                            // Black: higher = better, delta = best - current
                            delta = (bestMove.winrate ?? 0) - (move.winrate ?? 0);
                        } else {
                            // White: lower = better, delta = current - best
                            delta = (move.winrate ?? 0) - (bestMove.winrate ?? 0);
                        }
                    } else {
                        // Score delta: how many points lost vs best score
                        if (nextPlayer === 1) {
                            // Black wants higher score
                            delta = (bestMove.score ?? 0) - (move.score ?? 0);
                        } else {
                            // White wants lower score
                            delta = (move.score ?? 0) - (bestMove.score ?? 0);
                        }
                    }
                    delta = Math.max(0, delta);

                    return {
                        ...move,
                        isPlayed: node.id === firstChildId,
                        isNextBest: node.id === bestNode.id,
                        delta
                    };
                });

                // Generate Alternatives List (exclude played move, show only alternatives)
                const alternatives: AIAlternative[] = ghostStonesRaw
                    .filter(gs => !gs.isPlayed)  // Exclude the played move from alternatives
                    .map(gs => ({
                        move: String.fromCharCode(65 + gs.col + (gs.col >= 8 ? 1 : 0)) + (19 - gs.row),
                        winrate: gs.winrate!,
                        pointsLost: gs.delta!,
                        score: gs.score!
                    }))
                    .slice(0, alternativeMoveCount);

                // Ghost Stones for Board - prioritize best move and played move
                const bestGhost = ghostStonesRaw.find(gs => gs.isNextBest);
                const playedGhost = ghostStonesRaw.find(gs => gs.isPlayed);
                const isSamePosition = bestGhost && playedGhost &&
                    bestGhost.row === playedGhost.row && bestGhost.col === playedGhost.col;

                // Build priority list: best move first, then played move (if different)
                const ghostStones: Move[] = [];
                if (bestGhost) ghostStones.push(bestGhost);
                if (playedGhost && !isSamePosition) ghostStones.push(playedGhost);

                // Fill remaining slots with other moves
                const remainingSlots = ghostStoneCount - ghostStones.length;
                if (remainingSlots > 0) {
                    const others = ghostStonesRaw
                        .filter(gs => !gs.isNextBest && !gs.isPlayed)
                        .slice(0, remainingSlots);
                    ghostStones.push(...others);
                }

                return { alternatives, ghostStones };
            }
        }

        // 2. Streaming Analysis (AI Alternatives)
        if (isMoveNode(activeNode) && activeNode.move.aiAlternatives && activeNode.move.aiAlternatives.length > 0) {
            const alts = activeNode.move.aiAlternatives;

            const alternatives: AIAlternative[] = alts
                .map(alt => ({
                    move: alt.move,
                    winrate: alt.winrate,
                    pointsLost: alt.pointsLost,
                    score: alt.score
                }))
                .slice(0, alternativeMoveCount);

            const ghostStones: Move[] = alts.map((alt, idx) => {
                const gtpMove = alt.move;
                let col = gtpMove.charCodeAt(0) - 65;
                if (col >= 8) col--; // Adjust for I skip check (Standard I skip is J=8, so if >=8, means J,K...)
                // Standard GTP: A(0)..H(7), J(8)..T(18).
                // If I receive "J4", code=74. 74-65=9.
                // Wait. I (73) is skipped.
                // A..H: 0..7. J: 8.
                // If I get J(74). 74-65 = 9. 9 > 8? No?
                // Logic: A=0...H=7. I is undefined. J=8.
                // My map: 0..18.
                // If I have col 8, I want J.
                // If I receive 'J', I want 8.
                // 'J'-65 = 9. 9-1 = 8. Correct.
                // 'H'-65 = 7. 7. Correct.
                const charCode = gtpMove.charCodeAt(0);
                col = charCode >= 73 ? charCode - 66 : charCode - 65; // '>=' 73 ('I') -> -1? 'I' shouldn't exist in GTP. 'J'(74) -> 74-66=8. Correct.

                const row = 19 - parseInt(gtpMove.slice(1), 10);
                return {
                    row,
                    col,
                    player: activeNode.move.player === 1 ? 2 : 1,
                    winrate: alt.winrate,
                    score: alt.score,
                    delta: alt.pointsLost,
                    isNextBest: idx === 0,
                    isPlayed: false,
                };
            }).slice(0, ghostStoneCount);

            return { alternatives, ghostStones };
        }

        return { alternatives: [], ghostStones: [] };
    }, [activeNode, analysisMode, ghostStoneCount, alternativeMoveCount]);

    // Chart Data
    const { chartDisplayData, yAxisLabels, yRange } = useMemo(() => {
        if (analysisMode === 'score') {
            const scores = gameHistoryData.scores;
            const minScore = Math.min(...scores, -1);
            const maxScore = Math.max(...scores, 1);
            const absMax = Math.max(Math.abs(minScore), Math.abs(maxScore));
            const range = Math.max(10, Math.ceil(absMax / 5) * 5);
            return { chartDisplayData: scores, yRange: { min: -range, max: range }, yAxisLabels: [`+${range}`, '0', `-${range}`] };
        }
        return { chartDisplayData: gameHistoryData.winrates, yRange: { min: 0, max: 100 }, yAxisLabels: ['100%', '50%', '0%'] };
    }, [analysisMode, gameHistoryData]);

    // Error Indices
    const errorIndices = useMemo(() => {
        if (!errorThresholdEnabled) return [];

        const indices: number[] = [];
        const mainLine = gameHistoryData.moveNodes;

        for (let i = 0; i < mainLine.length; i++) {
            const node = mainLine[i];
            if (!node) continue;
            const parent = node.parent;
            if (!isMoveNode(parent) || parent.children.length <= 1) continue;

            const childrenWithStats = parent.children.filter((n): n is MoveNode => isMoveNode(n) && typeof n.move.winrate === 'number');
            if (childrenWithStats.length === 0) continue;

            // Sort by winrate (maximize player winrate)
            const sorted = [...childrenWithStats].sort((a, b) => (b.move.winrate ?? 0) - (a.move.winrate ?? 0));
            const best = sorted[0];
            if (!best) continue;

            // Simple delta check
            const delta = Math.abs((best.move.winrate ?? 0) - (node.move.winrate ?? 0));

            if (errorThresholdMode === 'winrate') {
                if (delta > winrateThreshold) indices.push(i);
            } else {
                // Check score thresholds
                const nextPlayer = node.move.player;
                const bestScore = best.move.score ?? 0;
                const moveScore = node.move.score ?? 0;
                const scoreDelta = nextPlayer === 1 ? (bestScore - moveScore) : (moveScore - bestScore);
                if (Math.max(0, scoreDelta) > scoreThreshold) indices.push(i);
            }
        }
        return indices;
    }, [errorThresholdEnabled, errorThresholdMode, winrateThreshold, scoreThreshold, gameHistoryData.moveNodes]);

    return { analysisData, chartDisplayData, yAxisLabels, yRange, errorIndices };
};
