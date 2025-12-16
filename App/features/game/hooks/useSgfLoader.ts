/**
 * Hook for SGF file loading operations.
 * Extracted from GameContext for modularity.
 */
import { useCallback, useRef, useEffect } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';

import { fromSgf, getInitialDisplayNode } from '@game/lib/sgf';
import { RootNode, MoveNode } from '@/lib/types';
import { useError } from '@game/context/ErrorContext';
import { getErrorMessage } from '@/lib/handleError';

type UseSgfLoaderParams = {
    setRootNode: React.Dispatch<React.SetStateAction<RootNode>>;
    setCurrentNode: React.Dispatch<React.SetStateAction<MoveNode | RootNode>>;
};

/**
 * Hook providing SGF file loading functionality.
 */
export function useSgfLoader({ setRootNode, setCurrentNode }: UseSgfLoaderParams) {
    const { t } = useTranslation();
    const { showError } = useError();

    // Store setters in refs for stable reference
    const settersRef = useRef({ setRootNode, setCurrentNode });
    useEffect(() => {
        settersRef.current = { setRootNode, setCurrentNode };
    });

    /**
     * Opens a file picker and loads the selected SGF file.
     */
    const handleLoadSgf = useCallback(async () => {
        const { setRootNode, setCurrentNode } = settersRef.current;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/x-go-sgf',
            });

            if (!result.canceled && result.assets?.[0]) {
                const sgf = await FileSystem.readAsStringAsync(result.assets[0].uri);
                const newRoot = fromSgf(sgf);
                setRootNode(newRoot);
                setCurrentNode(getInitialDisplayNode(newRoot));
                showError(t('alerts.successLoad'), 'success');
            }
        } catch (error) {
            console.error('Error loading SGF:', error);
            showError(getErrorMessage(error, t, 'alerts.errorLoad'), 'error');
        }
    }, [t, showError]);

    /**
     * Loads an SGF from a string directly.
     */
    const loadSgfFromString = useCallback((sgfString: string) => {
        const { setRootNode, setCurrentNode } = settersRef.current;
        try {
            const newRoot = fromSgf(sgfString);
            setRootNode(newRoot);
            setCurrentNode(getInitialDisplayNode(newRoot));
            return newRoot;
        } catch (error) {
            console.error('Error parsing SGF:', error);
            showError(getErrorMessage(error, t, 'alerts.invalidSgf'), 'error');
            return null;
        }
    }, [t, showError]);

    return {
        handleLoadSgf,
        loadSgfFromString,
    };
}
