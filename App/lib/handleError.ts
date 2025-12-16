import { ApiClientError } from './apiClient';
import { TFunction } from 'i18next';

/**
 * Maps an error to a user-friendly localized message.
 * Centralizes error interpretation for consistent UX.
 */
export function getErrorMessage(
    error: unknown,
    t: TFunction,
    defaultKey: string = 'alerts.failed'
): string {
    // ApiClientError from our API layer (code is HTTP status number)
    if (error instanceof ApiClientError || (error as any).name === 'ApiClientError') {
        const apiError = error as ApiClientError;
        // Network or timeout errors are usually code 0 or custom values
        if (apiError.code === 0) {
            return t('alerts.networkError');
        }
        if (apiError.code >= 500) {
            return t('alerts.serverError');
        }
        if (apiError.code === 401 || apiError.code === 403) {
            return t('alerts.unauthorized');
        }
        if (apiError.code === 400) {
            return t('alerts.badRequest');
        }
        return apiError.message || t(defaultKey);
    }

    // Standard Error with message parsing
    if (error instanceof Error) {
        if (error.message.includes('parse') || error.message.includes('SGF')) {
            return t('alerts.invalidSgf');
        }
        if (error.message.includes('permission') || error.message.includes('access')) {
            return t('alerts.fileAccessError');
        }
        if (error.message.includes('network') || error.message.includes('Network')) {
            return t('alerts.networkError');
        }
        return error.message;
    }

    // Fallback
    return t(defaultKey);
}
