import { useState, useCallback } from 'react';
import { detectCorners, classifyWithCorners, Corner, CornersResult } from '@board-recognition/lib/boardRecognition';
import { fromSgf } from '@game/lib/sgf';
import { useSettingsContext } from '@settings/context/SettingsContext';
import { useTranslation } from 'react-i18next';
import { RootNode } from '@/lib/types';
import { CaptureMetadata } from '@board-recognition/components/CaptureMetadataEditor';

interface RecognitionFlowProps {
    imageUri: string | null;
    boardSize: number;
    onSuccess: (rootNode: RootNode, message: string) => void;
    onError: (message: string) => void;
    setImageUri: (uri: string | null) => void;
}

export const useRecognitionFlow = ({
    imageUri,
    boardSize,
    onSuccess,
    onError,
    setImageUri
}: RecognitionFlowProps) => {
    const { t } = useTranslation();
    const { backendConfig } = useSettingsContext();
    const [isProcessing, setIsProcessing] = useState(false);

    // Corner editing state
    const [cornersData, setCornersData] = useState<CornersResult | null>(null);
    const [showCornerEditor, setShowCornerEditor] = useState(false);

    // Stone editing state
    const [classifiedBoard, setClassifiedBoard] = useState<number[][] | null>(null);
    const [warpedImageBase64, setWarpedImageBase64] = useState<string | null>(null);
    const [showStoneEditor, setShowStoneEditor] = useState(false);

    // Metadata editing state
    const [confirmedBoard, setConfirmedBoard] = useState<number[][] | null>(null);
    const [showMetadataEditor, setShowMetadataEditor] = useState(false);

    const getBackendParams = useCallback(() => {
        const backendUrl = backendConfig.mode === 'domain'
            ? backendConfig.domainUrl
            : backendConfig.runpodEndpoint;

        const apiKey = backendConfig.mode === 'domain'
            ? backendConfig.domainApiKey || ''
            : backendConfig.runpodWorkerKey || '';

        if (!backendUrl) {
            throw new Error(t('capture.noBackend'));
        }
        return { backendUrl, apiKey };
    }, [backendConfig, t]);

    const detectAndEditCorners = useCallback(async () => {
        if (!imageUri) return;

        setIsProcessing(true);
        try {
            const { backendUrl, apiKey } = getBackendParams();
            const corners = await detectCorners(imageUri, backendUrl, apiKey);
            setCornersData(corners);
            setShowCornerEditor(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('capture.error');
            onError(message);
        } finally {
            setIsProcessing(false);
        }
    }, [imageUri, getBackendParams, onError, t]);

    const handleCornersConfirmed = useCallback(async (adjustedCorners: Corner[]) => {
        if (!imageUri) return;

        setShowCornerEditor(false);
        setIsProcessing(true);

        try {
            const { backendUrl, apiKey } = getBackendParams();

            // Classify with confirmed corners
            const result = await classifyWithCorners(imageUri, adjustedCorners, backendUrl, apiKey, boardSize);

            if (result.board) {
                // Show stone editor for corrections
                setClassifiedBoard(result.board);
                setWarpedImageBase64(result.warpedImageBase64 || null);
                setShowStoneEditor(true);
            } else {
                // Fallback: load SGF directly if no board data
                const rootNode = fromSgf(result.sgf);

                const message = `${t('capture.success')}: ${result.blackStones} ${t('capture.black')}, ${result.whiteStones} ${t('capture.white')}`;

                // Reset state
                setImageUri(null);
                setCornersData(null);

                onSuccess(rootNode, message);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : t('capture.error');
            onError(message);
        } finally {
            setIsProcessing(false);
        }
    }, [imageUri, boardSize, getBackendParams, onError, onSuccess, t, setImageUri]);

    const handleCornersCancel = useCallback(() => {
        setShowCornerEditor(false);
        setCornersData(null);
    }, []);

    const handleStonesConfirmed = useCallback((correctedBoard: number[][]) => {
        // Save the confirmed board and show metadata editor
        setConfirmedBoard(correctedBoard);
        setShowStoneEditor(false);
        setShowMetadataEditor(true);
    }, []);

    const handleStonesCancel = useCallback(() => {
        setShowStoneEditor(false);
        // Go back to corner editor
        setShowCornerEditor(true);
    }, []);

    const handleMetadataConfirmed = useCallback((metadata: CaptureMetadata) => {
        if (!confirmedBoard) return;

        // Build SGF with metadata
        const blackCount = confirmedBoard.flat().filter(c => c === 1).length;
        const whiteCount = confirmedBoard.flat().filter(c => c === 2).length;

        // Generate SGF with metadata
        let sgf = `(;GM[1]FF[4]SZ[${boardSize}]`;
        if (metadata.komi !== undefined) sgf += `KM[${metadata.komi}]`;
        if (metadata.nextPlayer) sgf += `PL[${metadata.nextPlayer}]`;
        if (metadata.blackName) sgf += `PB[${metadata.blackName}]`;
        if (metadata.whiteName) sgf += `PW[${metadata.whiteName}]`;

        // Add setup stones
        const blackStones: string[] = [];
        const whiteStones: string[] = [];
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = confirmedBoard[row]?.[col];
                if (cell === 1) {
                    blackStones.push(String.fromCharCode(97 + col) + String.fromCharCode(97 + row));
                } else if (cell === 2) {
                    whiteStones.push(String.fromCharCode(97 + col) + String.fromCharCode(97 + row));
                }
            }
        }
        if (blackStones.length > 0) {
            sgf += 'AB' + blackStones.map(s => `[${s}]`).join('');
        }
        if (whiteStones.length > 0) {
            sgf += 'AW' + whiteStones.map(s => `[${s}]`).join('');
        }
        sgf += ')';

        const rootNode = fromSgf(sgf);

        const message = `${t('capture.success')}: ${blackCount} ${t('capture.black')}, ${whiteCount} ${t('capture.white')}`;

        // Clear all state
        setShowMetadataEditor(false);
        setConfirmedBoard(null);
        setClassifiedBoard(null);
        setImageUri(null);
        setCornersData(null);

        onSuccess(rootNode, message);
    }, [confirmedBoard, boardSize, onSuccess, t, setImageUri]);

    const handleMetadataCancel = useCallback(() => {
        setShowMetadataEditor(false);
        // Go back to stone editor
        setShowStoneEditor(true);
    }, []);

    // Calculate stone counts for metadata editor
    const blackStoneCount = confirmedBoard?.flat().filter(c => c === 1).length ?? 0;
    const whiteStoneCount = confirmedBoard?.flat().filter(c => c === 2).length ?? 0;

    return {
        isProcessing,
        cornersData,
        showCornerEditor,
        classifiedBoard,
        warpedImageBase64,
        showStoneEditor,
        showMetadataEditor,
        blackStoneCount,
        whiteStoneCount,
        detectAndEditCorners,
        handleCornersConfirmed,
        handleCornersCancel,
        handleStonesConfirmed,
        handleStonesCancel,
        handleMetadataConfirmed,
        handleMetadataCancel
    };
};
