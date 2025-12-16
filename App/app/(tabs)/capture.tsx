import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameContext } from '@game/context/GameContext';
import { useError } from '@game/context/ErrorContext';
import { getInitialDisplayNode } from '@game/lib/sgf';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Ionicons from '@expo/vector-icons/Ionicons';
import CornerEditor from '@board-recognition/components/CornerEditor';
import StoneEditor from '@board-recognition/components/StoneEditor';
import CaptureMetadataEditor from '@board-recognition/components/CaptureMetadataEditor';
import { RootNode } from '@/lib/types';

import { useImageCapture } from '@board-recognition/hooks/useImageCapture';
import { useRecognitionFlow } from '@board-recognition/hooks/useRecognitionFlow';
import { SUPPORTED_BOARD_SIZES } from '@/constants/game';

export default function CaptureScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = colorScheme ?? 'light';
    const { setCurrentNode, setRootNode } = useGameContext();
    const { showError } = useError();
    const [boardSize, setBoardSize] = useState(19);

    // Custom Hooks
    const capture = useImageCapture();

    // Success Handler
    const handleRecognitionSuccess = useCallback((rootNode: RootNode, message: string) => {
        setRootNode(rootNode);
        setCurrentNode(getInitialDisplayNode(rootNode));
        showError(message, 'success');
        router.push('/(tabs)');
    }, [setRootNode, setCurrentNode, showError, router]);

    // Error Handler
    const handleRecognitionError = useCallback((message: string) => {
        showError(message, 'error');
    }, [showError]);

    const recognition = useRecognitionFlow({
        imageUri: capture.imageUri,
        boardSize,
        onSuccess: handleRecognitionSuccess,
        onError: handleRecognitionError,
        setImageUri: capture.setImageUri
    });

    const BoardSizeButton = ({ size }: { size: number }) => {
        const isSelected = boardSize === size;
        return (
            <TouchableOpacity
                style={[
                    styles.sizeButton,
                    {
                        backgroundColor: isSelected ? Colors[theme].primaryAction : Colors[theme].secondaryBackground,
                        borderColor: isSelected ? Colors[theme].primaryAction : Colors[theme].icon
                    }
                ]}
                onPress={() => setBoardSize(size)}
            >
                <Text style={[
                    styles.sizeButtonText,
                    { color: isSelected ? '#ffffff' : Colors[theme].text }
                ]}>
                    {size}x{size}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
            <Text style={[styles.title, { color: Colors[theme].text }]}>
                {t('capture.title')}
            </Text>

            <View style={styles.sizeContainer}>
                <Text style={[styles.label, { color: Colors[theme].text }]}>
                    {t('capture.boardSize')}:
                </Text>
                <View style={styles.sizeButtons}>
                    {SUPPORTED_BOARD_SIZES.map(size => (
                        <BoardSizeButton key={size} size={size} />
                    ))}
                </View>
            </View>

            {capture.imageUri ? (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: capture.imageUri }} style={styles.preview} />
                    <View style={styles.previewButtons}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={capture.clearImage}
                        >
                            <Ionicons name="close" size={24} color="#fff" />
                            <Text style={styles.buttonText}>{t('capture.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.recognizeButton, { backgroundColor: Colors[theme].primaryAction }]}
                            onPress={recognition.detectAndEditCorners}
                            disabled={recognition.isProcessing}
                        >
                            {recognition.isProcessing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="scan" size={24} color="#fff" />
                                    <Text style={styles.buttonText}>{t('capture.recognize')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.captureButtons}>
                    <TouchableOpacity
                        style={[styles.captureButton, { borderColor: Colors[theme].primaryAction }]}
                        onPress={capture.takePhoto}
                    >
                        <Ionicons name="camera" size={48} color={Colors[theme].primaryAction} />
                        <Text style={[styles.captureText, { color: Colors[theme].text }]}>
                            {t('capture.camera')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.captureButton, { borderColor: Colors[theme].primaryAction }]}
                        onPress={capture.pickImage}
                    >
                        <Ionicons name="images" size={48} color={Colors[theme].primaryAction} />
                        <Text style={[styles.captureText, { color: Colors[theme].text }]}>
                            {t('capture.gallery')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <Text style={[styles.hint, { color: Colors[theme].icon }]}>
                {t('capture.hint')}
            </Text>

            {/* Corner Editor Modal */}
            <Modal
                visible={recognition.showCornerEditor && recognition.cornersData !== null}
                animationType="slide"
                onRequestClose={recognition.handleCornersCancel}
            >
                {recognition.cornersData && (
                    <CornerEditor
                        previewBase64={recognition.cornersData.previewBase64}
                        initialCorners={recognition.cornersData.corners}
                        imageWidth={recognition.cornersData.imageWidth}
                        imageHeight={recognition.cornersData.imageHeight}
                        boardSize={boardSize}
                        onConfirm={recognition.handleCornersConfirmed}
                        onCancel={recognition.handleCornersCancel}
                    />
                )}
            </Modal>

            {/* Stone Editor Modal */}
            <Modal
                visible={recognition.showStoneEditor && recognition.classifiedBoard !== null}
                animationType="slide"
                onRequestClose={recognition.handleStonesCancel}
            >
                {recognition.classifiedBoard && (
                    <StoneEditor
                        initialBoard={recognition.classifiedBoard}
                        boardSize={boardSize}
                        backgroundImageBase64={recognition.warpedImageBase64 || undefined}
                        onConfirm={recognition.handleStonesConfirmed}
                        onCancel={recognition.handleStonesCancel}
                    />
                )}
            </Modal>

            {/* Metadata Editor Modal */}
            <Modal
                visible={recognition.showMetadataEditor}
                animationType="slide"
                onRequestClose={recognition.handleMetadataCancel}
            >
                <CaptureMetadataEditor
                    blackStoneCount={recognition.blackStoneCount}
                    whiteStoneCount={recognition.whiteStoneCount}
                    onConfirm={recognition.handleMetadataConfirmed}
                    onCancel={recognition.handleMetadataCancel}
                />
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    sizeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        marginRight: 10,
    },
    sizeButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    sizeButton: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderWidth: 2,
        borderRadius: 8,
    },
    sizeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    captureButtons: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 30,
        alignItems: 'center',
    },
    captureButton: {
        width: 120,
        height: 120,
        borderWidth: 2,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderStyle: 'dashed',
    },
    captureText: {
        marginTop: 8,
        fontSize: 14,
    },
    previewContainer: {
        flex: 1,
        alignItems: 'center',
    },
    preview: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 12,
        marginBottom: 20,
    },
    previewButtons: {
        flexDirection: 'row',
        gap: 20,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        gap: 8,
    },
    cancelButton: {
        backgroundColor: '#666',
    },
    recognizeButton: {
        minWidth: 140,
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    hint: {
        textAlign: 'center',
        fontSize: 12,
        marginTop: 20,
    },
});
