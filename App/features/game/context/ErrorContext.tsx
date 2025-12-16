import React, {
    createContext,
    useContext,
    useCallback,
    useRef,
    useEffect,
    ReactNode,
    useReducer,
} from 'react';
import { ErrorSettings } from '@/config/settings';
import {
    errorReducer,
    initialErrorState,
    ErrorType,
    AppError,
    generateFingerprint,
} from '../errorReducer';

// Re-export types for compatibility
export type { ErrorType, AppError, ErrorStats } from '../errorReducer';

/**
 * Sentry/Analytics integration callback type.
 * Implement this to send errors to Sentry or other analytics services.
 */
export type ErrorReportCallback = (error: {
    message: string;
    type: ErrorType;
    fingerprint: string;
    count: number;
    metadata?: Record<string, unknown>;
}) => void;

interface ErrorContextType {
    /** Current visible error */
    error: AppError | null;
    /** Number of queued errors */
    queueLength: number;
    /** Show an error message */
    showError: (message: string, type?: ErrorType, duration?: number) => void;
    /** Clear the current error */
    clearError: () => void;
    /** Clear all errors including queue */
    clearAllErrors: () => void;
    /** Set a callback for error reporting (e.g., Sentry) */
    setErrorReporter: (callback: ErrorReportCallback | null) => void;
    /** Get error statistics for debugging */
    getErrorStats: () => Map<string, { count: number; lastSeen: number }>;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(errorReducer, initialErrorState);

    // External error reporter (e.g., Sentry)
    const errorReporterRef = useRef<ErrorReportCallback | null>(null);

    // Auto-dismiss expired errors
    useEffect(() => {
        if (!state.currentError) return;

        const now = Date.now();
        const timeUntilExpiry = state.currentError.expiresAt - now;

        if (timeUntilExpiry <= 0) {
            dispatch({ type: 'DISMISS_CURRENT' });
            return;
        }

        if (timeUntilExpiry < Infinity) {
            const timer = setTimeout(() => {
                dispatch({ type: 'CLEAR_EXPIRED' });
            }, timeUntilExpiry);
            return () => clearTimeout(timer);
        }
    }, [state.currentError]);

    const showError = useCallback((
        message: string,
        type: ErrorType = 'error',
        duration: number = ErrorSettings.toastDuration
    ) => {
        dispatch({
            type: 'SHOW_ERROR',
            payload: { message, errorType: type, duration },
        });

        // Report to external service
        if (errorReporterRef.current) {
            const fingerprint = generateFingerprint(message, type);
            const stats = state.stats.get(fingerprint);
            errorReporterRef.current({
                message,
                type,
                fingerprint,
                count: stats?.count ?? 1,
            });
        }
    }, [state.stats]);

    const clearError = useCallback(() => {
        dispatch({ type: 'DISMISS_CURRENT' });
    }, []);

    const clearAllErrors = useCallback(() => {
        dispatch({ type: 'CLEAR_ALL' });
    }, []);

    const setErrorReporter = useCallback((callback: ErrorReportCallback | null) => {
        errorReporterRef.current = callback;
    }, []);

    const getErrorStats = useCallback(() => {
        // Convert to the expected format
        const result = new Map<string, { count: number; lastSeen: number }>();
        state.stats.forEach((value, key) => {
            result.set(key, { count: value.count, lastSeen: value.lastSeen });
        });
        return result;
    }, [state.stats]);

    const value = React.useMemo(() => ({
        error: state.currentError,
        queueLength: state.errorQueue.length,
        showError,
        clearError,
        clearAllErrors,
        setErrorReporter,
        getErrorStats,
    }), [state.currentError, state.errorQueue.length, showError, clearError, clearAllErrors, setErrorReporter, getErrorStats]);

    return (
        <ErrorContext.Provider value={value}>
            {children}
        </ErrorContext.Provider>
    );
};

export const useError = () => {
    const context = useContext(ErrorContext);
    if (!context) {
        throw new Error('useError must be used within an ErrorProvider');
    }
    return context;
};

// ============================================================================
// Sentry Integration Helper
// ============================================================================

/**
 * Example Sentry integration.
 *
 * Usage:
 * ```tsx
 * import * as Sentry from '@sentry/react-native';
 * import { initSentryErrorReporting, useError } from './context/ErrorContext';
 *
 * // In your App component:
 * const { setErrorReporter } = useError();
 *
 * useEffect(() => {
 *   if (ErrorSettings.sentryEnabled) {
 *     setErrorReporter(initSentryErrorReporting(Sentry));
 *   }
 * }, []);
 * ```
 */
export function initSentryErrorReporting(Sentry: {
    captureMessage: (message: string, options?: unknown) => void;
}): ErrorReportCallback {
    return ({ message, type, fingerprint, count, metadata }) => {
        // Only report actual errors to Sentry, not warnings/info
        if (type !== 'error') return;

        Sentry.captureMessage(message, {
            level: 'error',
            fingerprint: [fingerprint],
            extra: {
                errorCount: count,
                errorType: type,
                ...metadata,
            },
        });
    };
}
