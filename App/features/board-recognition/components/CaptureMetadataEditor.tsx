import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Ionicons from '@expo/vector-icons/Ionicons';

export type CaptureMetadata = {
    nextPlayer: 'B' | 'W';
    blackName: string;
    whiteName: string;
    komi: number;
};

type CaptureMetadataEditorProps = {
    blackStoneCount: number;
    whiteStoneCount: number;
    onConfirm: (metadata: CaptureMetadata) => void;
    onCancel: () => void;
};

const DEFAULT_METADATA: CaptureMetadata = {
    nextPlayer: 'B',
    blackName: '',
    whiteName: '',
    komi: 6.5,
};

export const CaptureMetadataEditor = ({
    blackStoneCount,
    whiteStoneCount,
    onConfirm,
    onCancel
}: CaptureMetadataEditorProps) => {
    const { t } = useTranslation();
    const colorScheme = useColorScheme();
    const theme = colorScheme ?? 'light';

    // Intelligent default: if Black has more stones, White is probably next
    const inferredNextPlayer = blackStoneCount > whiteStoneCount ? 'W' : 'B';

    const [metadata, setMetadata] = useState<CaptureMetadata>({
        ...DEFAULT_METADATA,
        nextPlayer: inferredNextPlayer,
    });

    const handleConfirm = () => {
        onConfirm(metadata);
    };

    const PlayerButton = ({ player, label }: { player: 'B' | 'W'; label: string }) => {
        const isSelected = metadata.nextPlayer === player;
        const stoneColor = player === 'B' ? '#000' : '#fff';
        const stoneBorder = player === 'W' ? '#000' : 'transparent';

        return (
            <TouchableOpacity
                style={[
                    styles.playerButton,
                    {
                        backgroundColor: isSelected ? Colors[theme].primaryAction : Colors[theme].secondaryBackground,
                        borderColor: isSelected ? Colors[theme].primaryAction : Colors[theme].icon,
                    }
                ]}
                onPress={() => setMetadata(prev => ({ ...prev, nextPlayer: player }))}
            >
                <View style={[styles.stoneIndicator, { backgroundColor: stoneColor, borderColor: stoneBorder }]} />
                <Text style={[
                    styles.playerButtonText,
                    { color: isSelected ? '#fff' : Colors[theme].text }
                ]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors[theme].text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: Colors[theme].text }]}>
                    {t('capture.metadata.title', 'Position Settings')}
                </Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Stone Count Info */}
                <View style={[styles.infoBox, { backgroundColor: Colors[theme].secondaryBackground }]}>
                    <Text style={[styles.infoText, { color: Colors[theme].text }]}>
                        ⚫ {blackStoneCount} {t('capture.black', 'Black')} | ⚪ {whiteStoneCount} {t('capture.white', 'White')}
                    </Text>
                </View>

                {/* Next Player */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: Colors[theme].text }]}>
                        {t('capture.metadata.nextPlayer', 'Next to play')}
                    </Text>
                    <View style={styles.playerButtons}>
                        <PlayerButton player="B" label={t('capture.metadata.black', 'Black')} />
                        <PlayerButton player="W" label={t('capture.metadata.white', 'White')} />
                    </View>
                </View>

                {/* Komi */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: Colors[theme].text }]}>
                        {t('capture.metadata.komi', 'Komi')}
                    </Text>
                    <TextInput
                        style={[styles.komiInput, {
                            color: Colors[theme].text,
                            borderColor: Colors[theme].icon,
                            backgroundColor: Colors[theme].secondaryBackground
                        }]}
                        value={String(metadata.komi)}
                        onChangeText={(text) => {
                            const parsed = parseFloat(text.replace(',', '.'));
                            if (!isNaN(parsed)) {
                                setMetadata(prev => ({ ...prev, komi: parsed }));
                            } else if (text === '' || text === '-') {
                                setMetadata(prev => ({ ...prev, komi: 0 }));
                            }
                        }}
                        keyboardType="decimal-pad"
                        placeholder="6.5"
                        placeholderTextColor={Colors[theme].icon}
                    />
                </View>

                {/* Player Names (Optional) */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: Colors[theme].text }]}>
                        {t('capture.metadata.playerNames', 'Player Names')} ({t('capture.metadata.optional', 'optional')})
                    </Text>
                    <View style={styles.inputRow}>
                        <View style={[styles.stoneIndicator, { backgroundColor: '#000' }]} />
                        <TextInput
                            style={[styles.input, {
                                color: Colors[theme].text,
                                borderColor: Colors[theme].icon,
                                backgroundColor: Colors[theme].secondaryBackground
                            }]}
                            value={metadata.blackName}
                            onChangeText={(text) => setMetadata(prev => ({ ...prev, blackName: text }))}
                            placeholder={t('capture.metadata.blackPlayer', 'Black player')}
                            placeholderTextColor={Colors[theme].icon}
                        />
                    </View>
                    <View style={styles.inputRow}>
                        <View style={[styles.stoneIndicator, { backgroundColor: '#fff', borderColor: '#000' }]} />
                        <TextInput
                            style={[styles.input, {
                                color: Colors[theme].text,
                                borderColor: Colors[theme].icon,
                                backgroundColor: Colors[theme].secondaryBackground
                            }]}
                            value={metadata.whiteName}
                            onChangeText={(text) => setMetadata(prev => ({ ...prev, whiteName: text }))}
                            placeholder={t('capture.metadata.whitePlayer', 'White player')}
                            placeholderTextColor={Colors[theme].icon}
                        />
                    </View>
                </View>
            </ScrollView>

            {/* Confirm Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.confirmButton, { backgroundColor: Colors[theme].primaryAction }]}
                    onPress={handleConfirm}
                >
                    <Ionicons name="checkmark" size={24} color="#fff" />
                    <Text style={styles.confirmButtonText}>
                        {t('capture.metadata.confirm', 'Start Analysis')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
    },
    closeButton: {
        padding: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    placeholder: {
        width: 40,
    },
    content: {
        padding: 20,
        gap: 24,
    },
    infoBox: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    infoText: {
        fontSize: 16,
        fontWeight: '500',
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    playerButtons: {
        flexDirection: 'row',
        gap: 16,
    },
    playerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 2,
        gap: 10,
    },
    playerButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    stoneIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
    },
    komiInput: {
        height: 48,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 18,
        textAlign: 'center',
        fontWeight: '600',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    input: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
    },
    footer: {
        padding: 20,
        paddingBottom: 40,
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});

export default CaptureMetadataEditor;
