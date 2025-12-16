import { ErrorSettings } from '@/config/settings';

// =============================================================================
// Types
// =============================================================================

export type ErrorType = 'error' | 'warning' | 'info' | 'success';

export interface AppError {
    id: number;
    message: string;
    type: ErrorType;
    fingerprint: string;
    count: number;
    createdAt: number;
    expiresAt: number;
}

export interface ErrorStats {
    fingerprint: string;
    count: number;
    lastSeen: number;
}

// =============================================================================
// State
// =============================================================================

export interface ErrorState {
    /** Current visible error (first in queue) */
    currentError: AppError | null;
    /** Queue of pending errors */
    errorQueue: AppError[];
    /** Statistics for deduplication */
    stats: Map<string, ErrorStats>;
}

export const initialErrorState: ErrorState = {
    currentError: null,
    errorQueue: [],
    stats: new Map(),
};

// =============================================================================
// Actions
// =============================================================================

export type ErrorAction =
    | { type: 'SHOW_ERROR'; payload: { message: string; errorType: ErrorType; duration: number } }
    | { type: 'QUEUE_ERROR'; payload: AppError }
    | { type: 'DISMISS_CURRENT' }
    | { type: 'CLEAR_ALL' }
    | { type: 'CLEAR_EXPIRED' }
    | { type: 'UPDATE_STATS'; payload: { fingerprint: string; count: number } };

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a fingerprint for error deduplication.
 * Same message + type = same fingerprint.
 */
export function generateFingerprint(message: string, type: ErrorType): string {
    let hash = 0;
    const str = `${type}:${message}`;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
}

/**
 * Check if an error with this fingerprint was recently shown
 */
function isDuplicate(stats: Map<string, ErrorStats>, fingerprint: string): boolean {
    const existing = stats.get(fingerprint);
    if (!existing) return false;

    const now = Date.now();
    const timeSinceLastError = now - existing.lastSeen;
    return timeSinceLastError < ErrorSettings.deduplicationWindow;
}

// =============================================================================
// Reducer
// =============================================================================

export const errorReducer = (state: ErrorState, action: ErrorAction): ErrorState => {
    switch (action.type) {
        case 'SHOW_ERROR': {
            const { message, errorType, duration } = action.payload;
            const now = Date.now();
            const fingerprint = generateFingerprint(message, errorType);

            // Check for duplicate
            if (isDuplicate(state.stats, fingerprint)) {
                // Update stats but don't show
                const newStats = new Map(state.stats);
                const existing = newStats.get(fingerprint)!;
                newStats.set(fingerprint, {
                    ...existing,
                    count: existing.count + 1,
                    lastSeen: now,
                });
                return { ...state, stats: newStats };
            }

            // Create new error
            const newError: AppError = {
                id: now,
                message,
                type: errorType,
                fingerprint,
                count: 1,
                createdAt: now,
                expiresAt: duration > 0 ? now + duration : Infinity,
            };

            // Update stats
            const newStats = new Map(state.stats);
            newStats.set(fingerprint, { fingerprint, count: 1, lastSeen: now });

            // If no current error, show immediately
            if (!state.currentError) {
                return {
                    ...state,
                    currentError: newError,
                    stats: newStats,
                };
            }

            // Otherwise queue it
            return {
                ...state,
                errorQueue: [...state.errorQueue, newError],
                stats: newStats,
            };
        }

        case 'QUEUE_ERROR': {
            const { payload: error } = action;
            if (!state.currentError) {
                return { ...state, currentError: error };
            }
            return {
                ...state,
                errorQueue: [...state.errorQueue, error],
            };
        }

        case 'DISMISS_CURRENT': {
            // Remove current error and promote next from queue
            const [nextError, ...remainingQueue] = state.errorQueue;
            return {
                ...state,
                currentError: nextError || null,
                errorQueue: remainingQueue,
            };
        }

        case 'CLEAR_ALL': {
            return {
                ...state,
                currentError: null,
                errorQueue: [],
            };
        }

        case 'CLEAR_EXPIRED': {
            const now = Date.now();

            // Check if current error expired
            let newCurrentError = state.currentError;
            let newQueue = state.errorQueue;

            if (newCurrentError && newCurrentError.expiresAt <= now) {
                // Promote next from queue
                const [nextError, ...remainingQueue] = newQueue;
                newCurrentError = nextError || null;
                newQueue = remainingQueue;
            }

            // Filter expired from queue
            newQueue = newQueue.filter(e => e.expiresAt > now);

            return {
                ...state,
                currentError: newCurrentError,
                errorQueue: newQueue,
            };
        }

        case 'UPDATE_STATS': {
            const newStats = new Map(state.stats);
            const existing = newStats.get(action.payload.fingerprint);
            if (existing) {
                newStats.set(action.payload.fingerprint, {
                    ...existing,
                    count: action.payload.count,
                    lastSeen: Date.now(),
                });
            }
            return { ...state, stats: newStats };
        }

        default:
            return state;
    }
};
