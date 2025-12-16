import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { AIAlternative, MoveNode } from '@/lib/types';
import { formatMove } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type UnifiedMoveListProps = {
    variations?: MoveNode[];
    alternatives?: AIAlternative[];
    onSelectVariation: (index: number) => void;
    mode: 'winrate' | 'score';
    maxCount?: number;  // Limit number of displayed items
};

export const UnifiedMoveList = ({ variations, alternatives, onSelectVariation, mode, maxCount }: UnifiedMoveListProps) => {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';

    const hasVariations = variations && variations.length > 0;
    const hasAlternatives = alternatives && alternatives.length > 0;

    if (!hasVariations && !hasAlternatives) {
        return null;
    }

    // Priority: Variations (Game Moves) > AI Alternatives
    const showVariations = hasVariations;

    const title = showVariations ? t('variations.title') : t('alt.title');
    const unit = mode === 'winrate' ? '%' : ` ${t('alt.pointsUnit.score')}`;

    const renderStats = (match: AIAlternative) => {
        // If mode is Score, check if we have score data
        const showScore = mode === 'score' && match.score !== undefined;

        // Primary Value: Score or Winrate
        const mainLabel = showScore ? t('alt.score') || 'Score' : t('alt.win');
        const mainValue = showScore
            ? match.score!.toFixed(1) // Score usually has no unit suffix like %
            : `${match.winrate.toFixed(1)}%`;

        // Secondary Value: Loss
        const secondaryValue = `(-${match.pointsLost.toFixed(1)}${unit})`;

        return (
            <View style={styles.statsContainer}>
                <Text style={[styles.winrateText, { color: Colors[colorScheme].goBoard.bestMove }]}>
                    {`${mainLabel}: ${mainValue}`}
                </Text>
                <Text style={[styles.pointsText, { color: Colors[colorScheme].goBoard.deltaNegative }]}>
                    {secondaryValue}
                </Text>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].icon }]}>
            <Text style={[styles.title, { color: Colors[colorScheme].text }]}>{title}</Text>
            <ScrollView style={styles.list} nestedScrollEnabled>
                {showVariations ? (() => {
                    // Find best moves for delta calculations
                    const variationsWithStats = variations!.filter(
                        v => v.move.winrate !== undefined && v.move.score !== undefined
                    );

                    if (variationsWithStats.length === 0) {
                        // No stats available, just render without deltas
                        return (maxCount ? variations!.slice(0, maxCount) : variations!).map((node, index) => {
                            const isPlayedMove = index === 0;
                            return (
                                <TouchableOpacity
                                    key={node.id}
                                    style={[
                                        styles.row,
                                        { borderBottomColor: Colors[colorScheme].icon + '40' },
                                        isPlayedMove && styles.playedRow
                                    ]}
                                    onPress={() => onSelectVariation(index)}>
                                    <Text style={[styles.moveText, { color: Colors[colorScheme].text }]}>
                                        {isPlayedMove ? '▶ ' : ''}{`${index + 1}. ${formatMove(node.move)}`}
                                    </Text>
                                    <Text style={[styles.infoText, { color: Colors[colorScheme].icon }]}>
                                        {t('variations.gameMove')}
                                    </Text>
                                </TouchableOpacity>
                            );
                        });
                    }

                    const player = variationsWithStats[0]!.move.player;

                    // Find best move based on mode
                    let bestNode: MoveNode;
                    if (mode === 'winrate') {
                        if (player === 1) {
                            // Black: higher winrate = better
                            bestNode = variationsWithStats.reduce((best, current) =>
                                (current.move.winrate! > best.move.winrate!) ? current : best
                            );
                        } else {
                            // White: lower winrate = better
                            bestNode = variationsWithStats.reduce((best, current) =>
                                (current.move.winrate! < best.move.winrate!) ? current : best
                            );
                        }
                    } else {
                        // Score mode
                        if (player === 1) {
                            // Black wants highest score
                            bestNode = variationsWithStats.reduce((best, current) =>
                                (current.move.score! > best.move.score!) ? current : best
                            );
                        } else {
                            // White wants lowest score
                            bestNode = variationsWithStats.reduce((best, current) =>
                                (current.move.score! < best.move.score!) ? current : best
                            );
                        }
                    }

                    return (maxCount ? variations!.slice(0, maxCount) : variations!).map((node, index) => {
                        const moveStr = formatMove(node.move).split(' ')[1];

                        const hasNodeStats = node.move.winrate !== undefined && node.move.score !== undefined;
                        const match = alternatives?.find(alt => alt.move === moveStr);

                        // Calculate pointsLost based on best reference for current mode
                        let pointsLost = match?.pointsLost ?? 0;
                        if (hasNodeStats && !match) {
                            if (mode === 'winrate') {
                                const nodePlayer = node.move.player;
                                if (nodePlayer === 1) {
                                    // Black: higher = better, delta = best - current
                                    pointsLost = Math.max(0, (bestNode.move.winrate! - node.move.winrate!));
                                } else {
                                    // White: lower = better, delta = current - best
                                    pointsLost = Math.max(0, (node.move.winrate! - bestNode.move.winrate!));
                                }
                            } else {
                                // Score: depends on player perspective
                                const nodePlayer = node.move.player;
                                pointsLost = nodePlayer === 1
                                    ? Math.max(0, (bestNode.move.score! - node.move.score!))
                                    : Math.max(0, (node.move.score! - bestNode.move.score!));
                            }
                        }

                        // Build stats object from node data if available
                        const stats: AIAlternative | undefined = hasNodeStats
                            ? {
                                move: moveStr || '',
                                winrate: node.move.winrate!,
                                score: node.move.score!,
                                pointsLost
                            }
                            : match;
                        const isPlayedMove = index === 0;

                        return (
                            <TouchableOpacity
                                key={node.id}
                                style={[
                                    styles.row,
                                    { borderBottomColor: Colors[colorScheme].icon + '40' },
                                    isPlayedMove && styles.playedRow
                                ]}
                                onPress={() => onSelectVariation(index)}>
                                <Text style={[styles.moveText, { color: Colors[colorScheme].text }]}>
                                    {isPlayedMove ? '▶ ' : ''}{`${index + 1}. ${formatMove(node.move)}`}
                                </Text>
                                {stats ? renderStats(stats) : (
                                    <Text style={[styles.infoText, { color: Colors[colorScheme].icon }]}>
                                        {t('variations.gameMove')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    });
                })() : (
                    (maxCount ? alternatives!.slice(0, maxCount) : alternatives!).map((alt, index) => (
                        <View key={index} style={[styles.row, { borderBottomColor: Colors[colorScheme].icon + '40' }]}>
                            <Text style={[styles.moveText, { color: Colors[colorScheme].text }]}>
                                {`${index + 1}. ${alt.move}`}
                            </Text>
                            {renderStats(alt)}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '95%',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginVertical: 5,
    },
    title: {
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 8,
    },
    list: {
        maxHeight: 200, // Limit height to show ~4 items (assuming ~50px per item)
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    playedRow: {
        backgroundColor: 'rgba(10, 126, 164, 0.15)',  // Subtle highlight using primaryAction color
        borderRadius: 4,
        marginHorizontal: -4,
        paddingHorizontal: 4,
    },
    moveText: {
        fontSize: 16,
        fontWeight: '600',
    },
    infoText: {
        fontSize: 14,
    },
    statsContainer: {
        alignItems: 'flex-end',
    },
    winrateText: {
        fontSize: 14,
        fontWeight: '500',
    },
    pointsText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
});
