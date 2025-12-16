// components/StoneEditor.tsx
// Grid-based stone editor for correcting classification errors

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View,
    Image,
    StyleSheet,
    Pressable,
    Dimensions,
    Text,
    ScrollView,
} from 'react-native';
import Svg, { Circle, Polygon, Line } from 'react-native-svg';

type Props = {
    initialBoard: number[][];  // 0=empty, 1=black, 2=white
    boardSize: number;
    backgroundImageBase64?: string;  // Warped board image
    onConfirm: (board: number[][]) => void;
    onCancel: () => void;
};

const STONE_BLACK = 1;
const STONE_WHITE = 2;

export const StoneEditor: React.FC<Props> = ({
    initialBoard,
    boardSize,
    backgroundImageBase64,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const screenWidth = Dimensions.get('window').width;
    const padding = 16;
    const gridSize = screenWidth - padding * 2;
    const cellSize = gridSize / boardSize;
    const stoneRadius = cellSize * 0.4;

    const [board, setBoard] = useState<number[][]>(() =>
        initialBoard.map(row => [...row])
    );

    const handleCellTap = useCallback((row: number, col: number) => {
        setBoard(prev => {
            const newBoard = prev.map(r => [...r]);
            const current = newBoard[row]?.[col] ?? 0;
            // Cycle: empty -> black -> white -> empty
            const next = (current + 1) % 3;
            if (newBoard[row]) {
                newBoard[row][col] = next;
            }
            return newBoard;
        });
    }, []);

    const handleConfirm = () => {
        onConfirm(board);
    };

    const countStones = () => {
        let black = 0, white = 0;
        for (const row of board) {
            for (const cell of row) {
                if (cell === STONE_BLACK) black++;
                if (cell === STONE_WHITE) white++;
            }
        }
        return { black, white };
    };

    const { black, white } = countStones();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('capture.stone.title')}</Text>
            <Text style={styles.subtitle}>
                {t('capture.stone.subtitle')}
            </Text>

            <Text style={styles.count}>
                ● {t('capture.stone.black')}: {black}  ○ {t('capture.stone.white')}: {white}
            </Text>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.gridContainer, { width: gridSize, height: gridSize }]}>
                    {/* Background image */}
                    {backgroundImageBase64 && (
                        <Image
                            source={{ uri: `data:image/jpeg;base64,${backgroundImageBase64}` }}
                            style={[styles.backgroundImage, { width: gridSize, height: gridSize }]}
                            resizeMode="cover"
                        />
                    )}
                    <Svg width={gridSize} height={gridSize} style={styles.svgOverlay}>
                        {/* Draw grid lines */}
                        {Array.from({ length: boardSize }).map((_, i) => {
                            const pos = (i + 0.5) * cellSize;
                            return (
                                <React.Fragment key={`line-${i}`}>
                                    <Line
                                        x1={cellSize / 2}
                                        y1={pos}
                                        x2={gridSize - cellSize / 2}
                                        y2={pos}
                                        stroke="#8B7355"
                                        strokeWidth={1}
                                    />
                                    <Line
                                        x1={pos}
                                        y1={cellSize / 2}
                                        x2={pos}
                                        y2={gridSize - cellSize / 2}
                                        stroke="#8B7355"
                                        strokeWidth={1}
                                    />
                                </React.Fragment>
                            );
                        })}

                        {/* Draw stones */}
                        {board.map((row, rowIdx) =>
                            row.map((cell, colIdx) => {
                                const cx = (colIdx + 0.5) * cellSize;
                                const cy = (rowIdx + 0.5) * cellSize;

                                if (cell === STONE_BLACK) {
                                    // Black = Triangle
                                    const size = stoneRadius * 1.2;
                                    const points = [
                                        `${cx},${cy - size}`,
                                        `${cx - size * 0.866},${cy + size * 0.5}`,
                                        `${cx + size * 0.866},${cy + size * 0.5}`,
                                    ].join(' ');
                                    return (
                                        <Polygon
                                            key={`stone-${rowIdx}-${colIdx}`}
                                            points={points}
                                            fill="#222"
                                            stroke="#000"
                                            strokeWidth={1}
                                        />
                                    );
                                } else if (cell === STONE_WHITE) {
                                    // White = Circle
                                    return (
                                        <Circle
                                            key={`stone-${rowIdx}-${colIdx}`}
                                            cx={cx}
                                            cy={cy}
                                            r={stoneRadius}
                                            fill="#fff"
                                            stroke="#000"
                                            strokeWidth={1}
                                        />
                                    );
                                }
                                return null;
                            })
                        )}
                    </Svg>

                    {/* Invisible touch targets */}
                    {board.map((row, rowIdx) =>
                        row.map((_, colIdx) => (
                            <Pressable
                                key={`touch-${rowIdx}-${colIdx}`}
                                style={[
                                    styles.touchTarget,
                                    {
                                        left: colIdx * cellSize,
                                        top: rowIdx * cellSize,
                                        width: cellSize,
                                        height: cellSize,
                                    },
                                ]}
                                onPress={() => handleCellTap(rowIdx, colIdx)}
                            />
                        ))
                    )}
                </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
                <Pressable style={styles.cancelButton} onPress={onCancel}>
                    <Text style={styles.buttonText}>{t('capture.stone.cancel')}</Text>
                </Pressable>
                <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                    <Text style={styles.buttonText}>{t('capture.stone.confirm')}</Text>
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#D4B896',
        padding: 16,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#555',
        marginBottom: 8,
    },
    count: {
        fontSize: 14,
        color: '#333',
        marginBottom: 12,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
        maxHeight: 500,
    },
    scrollContent: {
        alignItems: 'center',
    },
    gridContainer: {
        backgroundColor: '#D4B896',
        position: 'relative',
    },
    backgroundImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        opacity: 0.9,
    },
    svgOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    touchTarget: {
        position: 'absolute',
    },
    buttonContainer: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 16,
    },
    cancelButton: {
        backgroundColor: '#666',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 8,
    },
    confirmButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default StoneEditor;
