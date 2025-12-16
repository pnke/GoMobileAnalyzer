/**
 * Shared API utilities for building headers and URLs.
 * Consolidates duplicated code from GameContext, useStreamingAnalysis, and apiClient.
 */
import { BackendConfig } from '@settings/context/SettingsContext';

export const STREAMING_ENDPOINT = '/v1/analyses/stream';

/**
 * Builds the base URL for API requests based on backend configuration.
 */
export const getBaseUrl = (config: BackendConfig): string => {
    return config.mode === 'runpod'
        ? config.runpodEndpoint
        : config.domainUrl;
};

/**
 * Builds authentication headers for API requests.
 */
export const buildApiHeaders = (
    config: BackendConfig,
    additionalHeaders?: Record<string, string>
): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...additionalHeaders,
    };

    if (config.mode === 'runpod') {
        if (config.runpodWorkerKey) {
            headers['X-Worker-Key'] = config.runpodWorkerKey;
        }
        if (config.runpodBearer) {
            headers['Authorization'] = `Bearer ${config.runpodBearer}`;
        }
    } else {
        if (config.domainApiKey) {
            headers['X-API-Key'] = config.domainApiKey;
        }
    }

    return headers;
};

/**
 * Builds the full streaming URL.
 */
export const getStreamingUrl = (config: BackendConfig): string => {
    return `${getBaseUrl(config)}${STREAMING_ENDPOINT}`;
};
