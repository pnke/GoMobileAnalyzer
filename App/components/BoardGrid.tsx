import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BOARD_SIZE } from '../constants/game';

const COLS = 'ABCDEFGHJKLMNOPQRST'.split('');

type BoardGridProps = {
    cellSize: number;
    boardDimension: number;
    lineColor: string;
    coordTextColor: string;
    starPointColor?: string;
};

// Standard star point positions for different board sizes
const getStarPoints = (boardSize: number): [number, number][] => {
    if (boardSize === 19) {
        // 19x19: 9 star points at 4th and 10th lines (0-indexed: 3, 9, 15)
        return [
            [3, 3], [3, 9], [3, 15],
            [9, 3], [9, 9], [9, 15],
            [15, 3], [15, 9], [15, 15]
        ];
    } else if (boardSize === 13) {
        // 13x13: 5 star points
        return [
            [3, 3], [3, 9],
            [6, 6],
            [9, 3], [9, 9]
        ];
    } else if (boardSize === 9) {
        // 9x9: 5 star points
        return [
            [2, 2], [2, 6],
            [4, 4],
            [6, 2], [6, 6]
        ];
    }
    return [];
};

/**
 * BoardGrid renders the static grid lines, coordinates, and star points.
 * Memoized because it only changes when dimensions or colors change.
 */
export const BoardGrid = React.memo(function BoardGrid({ cellSize, boardDimension, lineColor, coordTextColor, starPointColor }: BoardGridProps) {
    if (cellSize === 0) return null;

    const coordinateTextSize = Math.max(10, cellSize * 0.4);
    const starPointSize = Math.max(4, cellSize * 0.2);
    const elements = [];

    // Grid lines
    for (let i = 0; i < BOARD_SIZE; i++) {
        elements.push(<View key={`grid-h-${i}`} style={[styles.line, { backgroundColor: lineColor, top: i * cellSize, width: boardDimension }]} />);
        elements.push(<View key={`grid-v-${i}`} style={[styles.line, { backgroundColor: lineColor, left: i * cellSize, height: boardDimension, width: 1 }]} />);
    }

    // Star points (hoshi) - positioned at line intersections
    const starPoints = getStarPoints(BOARD_SIZE);
    const starColor = starPointColor || lineColor;
    for (const [row, col] of starPoints) {
        // Add 0.5 to account for the center of the 1px wide lines
        const centerX = col * cellSize + 0.5;
        const centerY = row * cellSize + 0.5;
        elements.push(
            <View
                key={`star-${row}-${col}`}
                style={[
                    styles.starPoint,
                    {
                        backgroundColor: starColor,
                        width: starPointSize,
                        height: starPointSize,
                        borderRadius: starPointSize / 2,
                        left: centerX - starPointSize / 2,
                        top: centerY - starPointSize / 2,
                    }
                ]}
            />
        );
    }

    // Coordinates
    const offset = cellSize / 2;
    for (let i = 0; i < BOARD_SIZE; i++) {
        elements.push(<Text key={`coord-top-${i}`} style={[styles.coordText, styles.coordHorizontal, { color: coordTextColor, left: (i * cellSize) - offset, fontSize: coordinateTextSize, width: cellSize, top: -cellSize }]}>{COLS[i]}</Text>);
        elements.push(<Text key={`coord-bottom-${i}`} style={[styles.coordText, styles.coordHorizontal, { color: coordTextColor, bottom: -cellSize, left: (i * cellSize) - offset, fontSize: coordinateTextSize, width: cellSize }]}>{COLS[i]}</Text>);
        elements.push(<Text key={`coord-left-${i}`} style={[styles.coordText, styles.coordVertical, { color: coordTextColor, top: (i * cellSize) - offset, fontSize: coordinateTextSize, height: cellSize, left: -cellSize, width: cellSize }]}>{BOARD_SIZE - i}</Text>);
        elements.push(<Text key={`coord-right-${i}`} style={[styles.coordText, styles.coordVertical, { color: coordTextColor, right: -cellSize, top: (i * cellSize) - offset, fontSize: coordinateTextSize, height: cellSize, width: cellSize }]}>{BOARD_SIZE - i}</Text>);
    }

    return <>{elements}</>;
});

const styles = StyleSheet.create({
    line: { position: 'absolute', height: 1 },
    coordText: { position: 'absolute', fontWeight: 'bold' },
    coordHorizontal: { textAlign: 'center' },
    coordVertical: { textAlignVertical: 'center', textAlign: 'center' },
    starPoint: { position: 'absolute' },
});
