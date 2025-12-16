/**
 * Validates backend configuration before making API calls.
 * @param backendConfig - The backend configuration object
 * @param t - Translation function for error messages
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateBackendConfig(
    backendConfig: {
        mode: 'domain' | 'runpod';
        domainUrl: string;
        runpodEndpoint: string;
    },
    t: (key: string) => string
): { isValid: boolean; errorMessage?: string } {
    if (backendConfig.mode === 'domain') {
        if (!backendConfig.domainUrl || backendConfig.domainUrl.trim() === '') {
            return {
                isValid: false,
                errorMessage: t('settings.noBackendUrl') || 'Backend URL is not configured',
            };
        }
        // Basic URL validation
        try {
            new URL(backendConfig.domainUrl);
        } catch {
            return {
                isValid: false,
                errorMessage: t('settings.invalidUrl') || 'Invalid backend URL format',
            };
        }
    }

    if (backendConfig.mode === 'runpod') {
        if (!backendConfig.runpodEndpoint || backendConfig.runpodEndpoint.trim() === '') {
            return {
                isValid: false,
                errorMessage: t('settings.noRunpodEndpoint') || 'RunPod endpoint is not configured',
            };
        }
    }

    return { isValid: true };
}
