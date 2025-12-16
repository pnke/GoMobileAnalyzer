/**
 * Application Settings
 *
 * Centralized configuration with environment variable support.
 * All hardcoded values should be moved here for easy configuration.
 */

import Constants from 'expo-constants';

// Environment detection
const isDev = __DEV__;

/**
 * Get environment variable with fallback.
 * In React Native/Expo, environment variables are accessed via expo-constants.
 */
function getEnvVar(key: string, fallback: string): string {
    const extra = Constants.expoConfig?.extra ?? {};
    return extra[key] ?? fallback;
}

function getEnvNumber(key: string, fallback: number): number {
    const value = getEnvVar(key, String(fallback));
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * Circuit Breaker Configuration
 * Prevents cascading failures by stopping requests when service is unhealthy.
 */
export const CircuitBreakerSettings = {
    /** Number of failures before circuit opens */
    failureThreshold: getEnvNumber('CIRCUIT_FAILURE_THRESHOLD', 3),
    /** Milliseconds before trying again (half-open state) */
    resetTimeout: getEnvNumber('CIRCUIT_RESET_TIMEOUT', 30000),
} as const;

/**
 * API Client Configuration
 */
export const ApiSettings = {
    /** Request timeout in milliseconds */
    timeout: getEnvNumber('API_TIMEOUT', 120000),
    /** Number of retry attempts for failed requests */
    retries: getEnvNumber('API_RETRIES', 3),
} as const;

/**
 * Error Handling Configuration
 */
export const ErrorSettings = {
    /** Auto-dismiss duration for error toasts (ms) */
    toastDuration: getEnvNumber('ERROR_TOAST_DURATION', 4000),
    /** Minimum interval between showing same error (ms) */
    deduplicationWindow: getEnvNumber('ERROR_DEDUP_WINDOW', 10000),
    /** Enable Sentry error reporting */
    sentryEnabled: getEnvVar('SENTRY_ENABLED', 'false') === 'true',
    /** Sentry DSN for error reporting */
    sentryDsn: getEnvVar('SENTRY_DSN', ''),
} as const;

/**
 * Development/Debug Settings
 */
export const DebugSettings = {
    isDevelopment: isDev,
    /** Log API requests in console */
    logApiRequests: isDev,
    /** Show performance warnings */
    showPerformanceWarnings: isDev,
} as const;

/**
 * All application settings combined
 */
export const AppSettings = {
    circuitBreaker: CircuitBreakerSettings,
    api: ApiSettings,
    error: ErrorSettings,
    debug: DebugSettings,
} as const;

export default AppSettings;
