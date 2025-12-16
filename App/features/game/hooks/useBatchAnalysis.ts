/**
 * Hook for batch (non-streaming) analysis with caching.
 * Extracted from GameContext for modularity.
 */
import { useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { fromSgf } from '@game/lib/sgf';
import { RootNode, MoveNode } from '@/lib/types';
import {
    ApiClientError,
    createDomainApiClient,
    createRunPodApiClient,
} from '@/lib/apiClient';
import { useSettingsContext } from '@settings/context/SettingsContext';
import { useError } from '@game/context/ErrorContext';

// Simple hash function for cache key
const hashSgf = (sgf: string): string => {
    let hash = 0;
    for (let i = 0; i < sgf.length; i++) {
        const char = sgf.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `analysis_${hash.toString(36)}`;
};

type BatchAnalysisParams = {
    setRootNode: React.Dispatch<React.SetStateAction<RootNode>>;
    setCurrentNode: React.Dispatch<React.SetStateAction<MoveNode | RootNode>>;
    setIsAnalyzing: (value: boolean) => void;
};

/**
 * Hook providing batch analysis functionality with caching.
 */
export function useBatchAnalysis({
    setRootNode,
    setCurrentNode,
    setIsAnalyzing,
}: BatchAnalysisParams) {
    const { t } = useTranslation();
    const { backendConfig } = useSettingsContext();
    const { showError } = useError();

    // Store setters in refs for stable reference
    const settersRef = useRef({ setRootNode, setCurrentNode, setIsAnalyzing });
    useEffect(() => {
        settersRef.current = { setRootNode, setCurrentNode, setIsAnalyzing };
    });

    /**
     * Performs batch analysis on SGF data with cache support.
     */
    const handleBatchAnalysis = useCallback(async (
        sgfData: string,
        params: { steps: number, startTurn?: number, endTurn?: number }
    ): Promise<void> => {
        const { setRootNode, setCurrentNode, setIsAnalyzing } = settersRef.current;
        const rangeKey = `${params.startTurn ?? 'all'}-${params.endTurn ?? 'all'}`;
        const cacheKey = hashSgf(sgfData + '_' + params.steps + '_' + rangeKey);

        // Check cache first
        try {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
                console.log('Analysis loaded from cache');
                showError(t('alerts.complete') + ' (cached)', 'success');
                const newRoot = fromSgf(cached);
                setRootNode(newRoot);
                setCurrentNode(newRoot);
                return;
            }
        } catch (e) {
            console.log('Cache search failed or empty:', e);
        }

        setIsAnalyzing(true);
        showError(`${t('alerts.start')}\n${t('alerts.wait')}`, 'info');

        try {
            let analyzedSgf: string;
            const options = { startTurn: params.startTurn, endTurn: params.endTurn };

            if (backendConfig.mode === 'runpod') {
                const client = await createRunPodApiClient(backendConfig.runpodEndpoint);
                analyzedSgf = await client.analyzeSgf(sgfData, params.steps, options);
            } else {
                const client = await createDomainApiClient(backendConfig.domainUrl);
                analyzedSgf = await client.analyzeSgf(sgfData, params.steps, options);
            }

            // Cache result
            try {
                await AsyncStorage.setItem(cacheKey, analyzedSgf);
            } catch (e) {
                console.warn('Failed to cache analysis:', e);
            }

            showError(t('alerts.complete'), 'success');
            const newRoot = fromSgf(analyzedSgf);
            setRootNode(newRoot);
            setCurrentNode(newRoot);
        } catch (error) {
            console.error('Analysis error:', error);
            let errorMessage = t('alerts.failed');

            if (error instanceof ApiClientError) {
                switch (error.code) {
                    case 401: errorMessage = t('alerts.authError'); break;
                    case 400: errorMessage = t('alerts.invalidSgf'); break;
                    case 429: errorMessage = t('alerts.rateLimited'); break;
                    case 504: errorMessage = t('alerts.timeout'); break;
                    default: errorMessage = error.message;
                }
            } else if (error instanceof Error) {
                errorMessage = error.name === 'AbortError' ? t('alerts.timeout') : error.message;
            }

            showError(`${t('alerts.failed')}: ${errorMessage}`, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    }, [backendConfig, t, showError]);

    return { handleBatchAnalysis };
}
