import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Move } from '../lib/types';

type GoStoneProps = {
    row: number;
    col: number;
    cellSize: number;
    stonePlayer: number; // 0 for empty, 1 for black, 2 for white
    ghost?: Move;
    onPress: (row: number, col: number) => void;
    colors: {
        blackStone: string;
        whiteStone: string;
        ghostBlack: string;
        ghostWhite: string;
        bestMove: string;
        playedMove: string;
        deltaPositive: string;
        deltaNegative: string;
    };
    mode: 'winrate' | 'score';
    displayMode?: 'delta' | 'absolute';
};

const COLS = 'ABCDEFGHJKLMNOPQRST';

const GoStoneComponent = ({ row, col, cellSize, stonePlayer, ghost, onPress, colors, mode, displayMode = 'absolute' }: GoStoneProps) => {
    const stoneDiameter = cellSize * 0.9;
    const stoneRadius = stoneDiameter / 2;

    const {
        blackStone, whiteStone, ghostBlack, ghostWhite,
        bestMove, playedMove
    } = colors;

    // Generate accessibility label based on stone state
    const getAccessibilityLabel = (): string => {
        const coordinate = `${COLS[col]}${19 - row}`;
        if (stonePlayer === 1) return `Black stone at ${coordinate}`;
        if (stonePlayer === 2) return `White stone at ${coordinate}`;
        if (ghost) {
            const player = ghost.player === 1 ? 'Black' : 'White';
            if (ghost.isNextBest) return `Best move for ${player} at ${coordinate}`;
            if (ghost.isPlayed) return `Played move at ${coordinate}`;
            return `Alternative ${player} move at ${coordinate}`;
        }
        return `Empty point at ${coordinate}`;
    };

    // Render winrate/delta text centered inside the ghost stone
    const renderGhostLabel = () => {
        if (!ghost) return null;

        // Dynamic text color based on stone color (White stone -> Black text, Black stone -> White text)
        // ghost.player 1 = Black, 2 = White
        const contrastColor = ghost.player === 2 ? '#000' : '#fff';

        let text: string | null = null;
        let color = contrastColor;
        // Font size scales with stone size, max ~40% of diameter to fit inside
        let fontSize = Math.max(8, Math.min(cellSize * 0.35, 14));

        if (ghost.isNextBest) {
            text = '★';
            color = '#f1c40f';
            fontSize = Math.max(10, Math.min(cellSize * 0.5, 18));
        } else if (displayMode === 'delta') {
            // Delta mode: show difference from best move
            if (ghost.delta !== undefined && ghost.delta > 0.1) {
                const unit = mode === 'winrate' ? '' : '';
                text = `-${ghost.delta.toFixed(1)}${unit}`;
                color = ghost.isPlayed ? '#ff6b6b' : contrastColor;
                fontSize = Math.max(6, Math.min(cellSize * 0.28, 10));
            }
        } else {
            // Absolute mode: show winrate or score value
            if (mode === 'score' && ghost.score !== undefined) {
                text = `${ghost.score.toFixed(1)}`;
                fontSize = Math.max(6, Math.min(cellSize * 0.30, 11));
            } else if (ghost.winrate !== undefined) {
                text = `${Math.round(ghost.winrate)}`;
                fontSize = Math.max(7, Math.min(cellSize * 0.32, 12));
            }
        }

        if (!text) return null;

        return (
            <Text style={[styles.ghostLabel, {
                color,
                fontSize,
                // Text shadow for readability
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 0.5, height: 0.5 },
                textShadowRadius: 1,
            }]} pointerEvents="none">
                {text}
            </Text>
        );
    };

    return (
        <TouchableOpacity
            style={[styles.touchable, {
                top: row * cellSize - cellSize / 2,
                left: col * cellSize - cellSize / 2,
                width: cellSize,
                height: cellSize
            }]}
            onPress={() => onPress(row, col)}
            activeOpacity={0.6}
            accessibilityLabel={getAccessibilityLabel()}
            accessibilityRole="button"
            accessibilityHint="Double tap to play a move here"
        >
            {/* Normal Stone */}
            {stonePlayer !== 0 && (
                <View style={[styles.stone, {
                    backgroundColor: stonePlayer === 1 ? blackStone : whiteStone,
                    width: stoneDiameter,
                    height: stoneDiameter,
                    borderRadius: stoneRadius
                }]} />
            )}

            {/* Ghost Stone - opacity based on visits */}
            {ghost && stonePlayer === 0 && (() => {
                // Calculate opacity based on visits (min 0.3, max 0.9)
                // Logarithmic scale: visits 1 = 0.3, visits 100+ = 0.9
                let opacity = 0.6; // default
                if (ghost.visits !== undefined && ghost.visits > 0) {
                    const logVisits = Math.log10(ghost.visits + 1); // +1 to avoid log(0)
                    opacity = Math.min(0.9, Math.max(0.3, 0.3 + logVisits * 0.3));
                }
                // Best moves and played moves get full opacity
                if (ghost.isNextBest || ghost.isPlayed) opacity = 0.9;

                return (
                    <View style={[
                        styles.stone,
                        styles.ghostStone,
                        {
                            backgroundColor: ghost.player === 1 ? ghostBlack : ghostWhite,
                            width: stoneDiameter,
                            height: stoneDiameter,
                            borderRadius: stoneRadius,
                            opacity,
                        },
                        ghost.isPlayed ? { borderColor: playedMove, ...styles.playedGhostStone } :
                            ghost.isNextBest ? { borderColor: bestMove, ...styles.bestGhostStone } : {}
                    ]} />
                );
            })()}

            {/* Winrate label centered inside ghost stone */}
            {renderGhostLabel()}
        </TouchableOpacity>
    );
};

// Custom comparison to prevent unnecessary re-renders
// Only re-render if visible state actually changes
const arePropsEqual = (prev: GoStoneProps, next: GoStoneProps): boolean => {
    // Position changes always need re-render
    if (prev.row !== next.row || prev.col !== next.col) return false;
    if (prev.cellSize !== next.cellSize) return false;

    // Stone state change
    if (prev.stonePlayer !== next.stonePlayer) return false;

    // Display mode or analysis mode change
    if (prev.mode !== next.mode || prev.displayMode !== next.displayMode) return false;

    // Ghost stone comparison (most complex)
    if (!prev.ghost && !next.ghost) return true; // Both empty
    if (!prev.ghost || !next.ghost) return false; // One has ghost, one doesn't

    // Compare ghost properties that affect rendering
    const g1 = prev.ghost;
    const g2 = next.ghost;
    return (
        g1.player === g2.player &&
        g1.winrate === g2.winrate &&
        g1.score === g2.score &&
        g1.delta === g2.delta &&
        g1.visits === g2.visits &&
        g1.isNextBest === g2.isNextBest &&
        g1.isPlayed === g2.isPlayed
    );
};

export const GoStone = React.memo(GoStoneComponent, arePropsEqual);
const styles = StyleSheet.create({
    touchable: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
    stone: { borderWidth: 1, borderColor: 'gray' },
    ghostStone: {
        // opacity is calculated dynamically based on visits
        borderStyle: 'dashed',
    },
    bestGhostStone: {
        borderWidth: 3,
    },
    playedGhostStone: {
        borderWidth: 3,
    },
    deltaText: {
        position: 'absolute',
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
        zIndex: 10
    },
    ghostLabel: {
        position: 'absolute',
        fontWeight: 'bold',
        textAlign: 'center',
        zIndex: 10,
    },
});
