import {
    errorReducer,
    initialErrorState,
    ErrorState,
    AppError,
    generateFingerprint,
} from '@game/errorReducer';

// Mock ErrorSettings
jest.mock('@/config/settings', () => ({
    ErrorSettings: {
        toastDuration: 3000,
        deduplicationWindow: 5000,
    },
}));

describe('errorReducer', () => {
    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('generateFingerprint', () => {
        it('should generate consistent fingerprint for same message and type', () => {
            const fp1 = generateFingerprint('Error message', 'error');
            const fp2 = generateFingerprint('Error message', 'error');
            expect(fp1).toBe(fp2);
        });

        it('should generate different fingerprints for different messages', () => {
            const fp1 = generateFingerprint('Error 1', 'error');
            const fp2 = generateFingerprint('Error 2', 'error');
            expect(fp1).not.toBe(fp2);
        });

        it('should generate different fingerprints for different types', () => {
            const fp1 = generateFingerprint('Message', 'error');
            const fp2 = generateFingerprint('Message', 'warning');
            expect(fp1).not.toBe(fp2);
        });
    });

    describe('SHOW_ERROR', () => {
        it('should show error when no current error', () => {
            const state = errorReducer(initialErrorState, {
                type: 'SHOW_ERROR',
                payload: { message: 'Test error', errorType: 'error', duration: 3000 },
            });

            expect(state.currentError).not.toBeNull();
            expect(state.currentError?.message).toBe('Test error');
            expect(state.currentError?.type).toBe('error');
            expect(state.errorQueue).toHaveLength(0);
        });

        it('should queue error when current error exists', () => {
            const stateWithError: ErrorState = {
                ...initialErrorState,
                currentError: {
                    id: 999,
                    message: 'Existing error',
                    type: 'error',
                    fingerprint: 'abc',
                    count: 1,
                    createdAt: 500,
                    expiresAt: 3500,
                },
            };

            const state = errorReducer(stateWithError, {
                type: 'SHOW_ERROR',
                payload: { message: 'New error', errorType: 'warning', duration: 3000 },
            });

            expect(state.currentError?.message).toBe('Existing error');
            expect(state.errorQueue).toHaveLength(1);
            expect(state.errorQueue[0]!.message).toBe('New error');
        });

        it('should deduplicate errors within window', () => {
            const fingerprint = generateFingerprint('Duplicate error', 'error');
            const stats = new Map([[fingerprint, { fingerprint, count: 1, lastSeen: 500 }]]);
            const stateWithStats: ErrorState = {
                ...initialErrorState,
                stats,
            };

            const state = errorReducer(stateWithStats, {
                type: 'SHOW_ERROR',
                payload: { message: 'Duplicate error', errorType: 'error', duration: 3000 },
            });

            // Should not show error (deduplicated)
            expect(state.currentError).toBeNull();
            // Should update count
            expect(state.stats.get(fingerprint)?.count).toBe(2);
        });
    });

    describe('DISMISS_CURRENT', () => {
        it('should dismiss current error', () => {
            const stateWithError: ErrorState = {
                ...initialErrorState,
                currentError: {
                    id: 1,
                    message: 'Error',
                    type: 'error',
                    fingerprint: 'abc',
                    count: 1,
                    createdAt: 0,
                    expiresAt: 3000,
                },
            };

            const state = errorReducer(stateWithError, { type: 'DISMISS_CURRENT' });
            expect(state.currentError).toBeNull();
        });

        it('should promote next error from queue', () => {
            const queuedError: AppError = {
                id: 2,
                message: 'Queued error',
                type: 'warning',
                fingerprint: 'def',
                count: 1,
                createdAt: 100,
                expiresAt: 4000,
            };

            const stateWithQueue: ErrorState = {
                ...initialErrorState,
                currentError: {
                    id: 1,
                    message: 'Current',
                    type: 'error',
                    fingerprint: 'abc',
                    count: 1,
                    createdAt: 0,
                    expiresAt: 3000,
                },
                errorQueue: [queuedError],
            };

            const state = errorReducer(stateWithQueue, { type: 'DISMISS_CURRENT' });
            expect(state.currentError?.message).toBe('Queued error');
            expect(state.errorQueue).toHaveLength(0);
        });
    });

    describe('CLEAR_ALL', () => {
        it('should clear current error and queue', () => {
            const stateWithErrors: ErrorState = {
                ...initialErrorState,
                currentError: {
                    id: 1,
                    message: 'Current',
                    type: 'error',
                    fingerprint: 'abc',
                    count: 1,
                    createdAt: 0,
                    expiresAt: 3000,
                },
                errorQueue: [{
                    id: 2,
                    message: 'Queued',
                    type: 'warning',
                    fingerprint: 'def',
                    count: 1,
                    createdAt: 100,
                    expiresAt: 4000,
                }],
            };

            const state = errorReducer(stateWithErrors, { type: 'CLEAR_ALL' });
            expect(state.currentError).toBeNull();
            expect(state.errorQueue).toHaveLength(0);
        });
    });

    describe('CLEAR_EXPIRED', () => {
        it('should dismiss expired current error', () => {
            jest.spyOn(Date, 'now').mockReturnValue(5000);

            const stateWithExpired: ErrorState = {
                ...initialErrorState,
                currentError: {
                    id: 1,
                    message: 'Expired',
                    type: 'error',
                    fingerprint: 'abc',
                    count: 1,
                    createdAt: 0,
                    expiresAt: 3000, // Expired at 3000, now is 5000
                },
            };

            const state = errorReducer(stateWithExpired, { type: 'CLEAR_EXPIRED' });
            expect(state.currentError).toBeNull();
        });

        it('should promote next from queue when current expires', () => {
            jest.spyOn(Date, 'now').mockReturnValue(5000);

            const stateWithQueue: ErrorState = {
                ...initialErrorState,
                currentError: {
                    id: 1,
                    message: 'Expired',
                    type: 'error',
                    fingerprint: 'abc',
                    count: 1,
                    createdAt: 0,
                    expiresAt: 3000,
                },
                errorQueue: [{
                    id: 2,
                    message: 'Not expired',
                    type: 'warning',
                    fingerprint: 'def',
                    count: 1,
                    createdAt: 4000,
                    expiresAt: 7000,
                }],
            };

            const state = errorReducer(stateWithQueue, { type: 'CLEAR_EXPIRED' });
            expect(state.currentError?.message).toBe('Not expired');
            expect(state.errorQueue).toHaveLength(0);
        });
    });

    describe('unknown action', () => {
        it('should return current state', () => {
            const state = errorReducer(initialErrorState, { type: 'UNKNOWN' } as any);
            expect(state).toEqual(initialErrorState);
        });
    });
});
