// components/CornerEditor.tsx
// Draggable corner editor for adjusting detected board corners

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View,
    Image,
    StyleSheet,
    Pressable,
    GestureResponderEvent,
    Dimensions,
    Text,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { CORNER_SIZE } from '@/constants/game';
import { Corner } from '@board-recognition/lib/boardRecognition';

type Props = {
    previewBase64: string;
    initialCorners: Corner[];
    imageWidth: number;
    imageHeight: number;
    boardSize?: number;  // For grid display
    onConfirm: (corners: Corner[]) => void;
    onCancel: () => void;
};

const CORNER_LABELS = ['1', '2', '3', '4'];
const CORNER_COLORS = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
const GRID_LINES = 19;  // Default Go board

export const CornerEditor: React.FC<Props> = ({
    previewBase64,
    initialCorners,
    imageWidth,
    imageHeight,
    boardSize = GRID_LINES,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const screenWidth = Dimensions.get('window').width;
    const padding = 20;
    const displayWidth = screenWidth - padding * 2;

    // Calculate display scale
    const scale = displayWidth / Math.max(imageWidth, imageHeight);
    const displayHeight = imageHeight * scale;

    // Scale corners to display size with defensive check
    const [corners, setCorners] = useState<Corner[]>(() => {
        if (!initialCorners || !Array.isArray(initialCorners) || initialCorners.length === 0) {
            // Default corners if none provided
            return [
                [displayWidth * 0.1, displayHeight * 0.1],
                [displayWidth * 0.9, displayHeight * 0.1],
                [displayWidth * 0.9, displayHeight * 0.9],
                [displayWidth * 0.1, displayHeight * 0.9],
            ];
        }
        return initialCorners.map(([x, y]) => [x * scale, y * scale]);
    });

    const [activeCorner, setActiveCorner] = useState<number | null>(null);
    const [containerLayout, setContainerLayout] = useState({ x: 0, y: 0 });

    const handleContainerLayout = useCallback((event: any) => {
        // We need pageX/pageY, so measure relative to window
        event.target.measureInWindow((pageX: number, pageY: number) => {
            setContainerLayout({ x: pageX, y: pageY });
        });
    }, []);

    const handleCornerMove = useCallback(
        (event: GestureResponderEvent) => {
            if (activeCorner === null) return;

            const { pageX, pageY } = event.nativeEvent;

            // Calculate position relative to container
            const x = pageX - containerLayout.x;
            const y = pageY - containerLayout.y;

            setCorners((prev) => {
                const updated = [...prev] as Corner[];
                updated[activeCorner] = [
                    Math.max(0, Math.min(displayWidth, x)),
                    Math.max(0, Math.min(displayHeight, y)),
                ];
                return updated;
            });
        },
        [activeCorner, displayWidth, displayHeight, containerLayout]
    );

    // Generate perspective grid lines based on corners
    // Corners: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left
    // The corners mark the BOARD edges, but grid lines are inset by half a cell
    const generateGridLines = useCallback(() => {
        const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
        if (corners.length !== 4) return lines;

        const tl = corners[0]!;
        const tr = corners[1]!;
        const br = corners[2]!;
        const bl = corners[3]!;

        // Grid margin: half a cell on each side
        // For a 19x19 board, there are 18 cells, so margin = 0.5/18 = 1/36 of total span
        const cells = boardSize - 1;
        const margin = 0; // Backend returns exact Grid Corners, so no margin needed

        // Helper: interpolate point on quadrilateral
        // u goes left-to-right (0 to 1), v goes top-to-bottom (0 to 1)
        const getPoint = (u: number, v: number): [number, number] => {
            // Top edge point
            const topX = tl[0] + u * (tr[0] - tl[0]);
            const topY = tl[1] + u * (tr[1] - tl[1]);
            // Bottom edge point
            const bottomX = bl[0] + u * (br[0] - bl[0]);
            const bottomY = bl[1] + u * (br[1] - bl[1]);
            // Interpolate between top and bottom
            return [
                topX + v * (bottomX - topX),
                topY + v * (bottomY - topY)
            ];
        };

        // Horizontal lines (from left to right, at each row)
        for (let i = 0; i < boardSize; i++) {
            const v = margin + (i / cells) * (1 - 2 * margin);
            const [x1, y1] = getPoint(margin, v);
            const [x2, y2] = getPoint(1 - margin, v);
            lines.push({ x1, y1, x2, y2 });
        }

        // Vertical lines (from top to bottom, at each column)
        for (let i = 0; i < boardSize; i++) {
            const u = margin + (i / cells) * (1 - 2 * margin);
            const [x1, y1] = getPoint(u, margin);
            const [x2, y2] = getPoint(u, 1 - margin);
            lines.push({ x1, y1, x2, y2 });
        }

        return lines;
    }, [corners, boardSize]);

    const handleConfirm = () => {
        // Scale corners back to original image size
        const scaledCorners = corners.map(([x, y]) => [
            x / scale,
            y / scale,
        ]) as Corner[];
        onConfirm(scaledCorners);
    };

    const gridLines = generateGridLines();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('capture.corner.title')}</Text>
            <Text style={styles.subtitle}>{t('capture.corner.subtitle')}</Text>

            <View
                style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}
                onLayout={handleContainerLayout}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderMove={handleCornerMove}
                onResponderRelease={() => setActiveCorner(null)}
            >
                <Image
                    source={{ uri: `data:image/jpeg;base64,${previewBase64}` }}
                    style={[styles.image, { width: displayWidth, height: displayHeight }]}
                    resizeMode="contain"
                />

                {/* Grid overlay */}
                <Svg
                    width={displayWidth}
                    height={displayHeight}
                    style={styles.gridOverlay}
                    pointerEvents="none"
                >
                    {gridLines.map((line, index) => (
                        <Line
                            key={`grid-${index}`}
                            x1={line.x1}
                            y1={line.y1}
                            x2={line.x2}
                            y2={line.y2}
                            stroke="rgba(255, 0, 0, 0.6)"
                            strokeWidth={1}
                        />
                    ))}
                </Svg>

                {/* Corner handles */}
                {corners.map((corner, index) => (
                    <Pressable
                        key={index}
                        style={[
                            styles.cornerHandle,
                            {
                                left: corner[0] - CORNER_SIZE / 2,
                                top: corner[1] - CORNER_SIZE / 2,
                                backgroundColor: CORNER_COLORS[index],
                                borderColor: activeCorner === index ? '#fff' : 'transparent',
                            },
                        ]}
                        onPressIn={() => setActiveCorner(index)}
                    >
                        <Text style={styles.cornerLabel}>{CORNER_LABELS[index]}</Text>
                    </Pressable>
                ))}
            </View>

            <View style={styles.buttonContainer}>
                <Pressable style={styles.cancelButton} onPress={onCancel}>
                    <Text style={styles.buttonText}>{t('capture.corner.cancel')}</Text>
                </Pressable>
                <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                    <Text style={styles.buttonText}>{t('capture.corner.confirm')}</Text>
                </Pressable>
            </View>

            <Text style={styles.hint}>
                {t('capture.corner.hint')}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 16,
    },
    imageContainer: {
        position: 'relative',
        backgroundColor: '#000',
        borderRadius: 8,
        overflow: 'hidden',
    },
    image: {
        position: 'absolute',
    },
    gridOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    cornerHandle: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderRadius: CORNER_SIZE / 2,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    cornerLabel: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonContainer: {
        flexDirection: 'row',
        marginTop: 20,
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
    hint: {
        marginTop: 16,
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
    },
});

export default CornerEditor;
