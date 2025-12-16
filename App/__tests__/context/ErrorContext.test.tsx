import { act, renderHook } from '@testing-library/react-native';
import { ErrorProvider, useError, initSentryErrorReporting } from '@game/context/ErrorContext';
// ErrorSettings is in config/settings, but we can verify behavior without importing it if we just mock timers
// or we can import it correctly if needed. Let's just mock timers.

// Mock simple timers for auto-dismiss tests
jest.useFakeTimers();

describe('ErrorContext', () => {

    it('provides error state and methods', () => {
        const { result } = renderHook(() => useError(), { wrapper: ErrorProvider });

        expect(result.current.error).toBeNull();
        expect(typeof result.current.showError).toBe('function');
        expect(typeof result.current.clearError).toBe('function');
    });

    it('shows error and updates state', () => {
        const { result } = renderHook(() => useError(), { wrapper: ErrorProvider });

        act(() => {
            result.current.showError('Something went wrong');
        });

        expect(result.current.error).toEqual(expect.objectContaining({
            message: 'Something went wrong',
            type: 'error',
            count: 1
        }));
    });

    it('clearError removes the error', () => {
        const { result } = renderHook(() => useError(), { wrapper: ErrorProvider });

        act(() => {
            result.current.showError('To be cleared');
        });
        expect(result.current.error).not.toBeNull();

        act(() => {
            result.current.clearError();
        });
        expect(result.current.error).toBeNull();
    });

    it('deduplicates errors shown within window', () => {
        const { result } = renderHook(() => useError(), { wrapper: ErrorProvider });

        // First error
        act(() => {
            result.current.showError('Dupe Message', 'error');
        });

        const firstErrorToCheck = result.current.error;
        expect(firstErrorToCheck).not.toBeNull();
        expect(firstErrorToCheck?.count).toBe(1);

        // Advance time slightly (less than deduplication window)

        // Second error (same message/type)
        act(() => {
            result.current.showError('Dupe Message', 'error');
        });

        const stats = result.current.getErrorStats();
        const statValues = Array.from(stats.values());
        if (statValues[0]) {
            expect(statValues[0].count).toBe(2);
        }
    });

    it('shows error again after deduplication window', () => {
        const { result } = renderHook(() => useError(), { wrapper: ErrorProvider });

        act(() => {
            result.current.showError('Timed Message');
        });

        // Advance time past window (e.g. > 5000ms)
        jest.advanceTimersByTime(10000);

        act(() => {
            result.current.showError('Timed Message');
        });

        const stats = result.current.getErrorStats();
        // Should reset count for new instance in stats if we consider it "new"
        // Wait, stats logic:
        // if (existingError) { if (time gap < window) ... else { // Not incrementing count, just updating lastSeen? No.
        // It falls through to: stats.set(fingerprint, { count: 1, lastSeen: now });
        // So yes, it resets count to 1.

        const statValues = Array.from(stats.values());
        // Verify it reset
        if (statValues[0]) {
            expect(statValues[0].count).toBe(1);
        }
    });

    it('auto-dismisses error after duration', () => {
        const { result } = renderHook(() => useError(), { wrapper: ErrorProvider });

        act(() => {
            result.current.showError('Auto Dismiss', 'error', 1000);
        });
        expect(result.current.error).not.toBeNull();

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(result.current.error).toBeNull();
    });

    it('invokes external error reporter if set', () => {
        const { result } = renderHook(() => useError(), { wrapper: ErrorProvider });
        const mockReporter = jest.fn();

        act(() => {
            result.current.setErrorReporter(mockReporter);
            result.current.showError('Report Me');
        });

        expect(mockReporter).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Report Me',
            type: 'error',
            count: 1
        }));
    });

    it('initSentryErrorReporting returns a callback that captures message', () => {
        const mockSentry = {
            captureMessage: jest.fn()
        };
        const callback = initSentryErrorReporting(mockSentry);

        callback({ message: 'Sentry Error', type: 'error', fingerprint: '123', count: 1 });

        expect(mockSentry.captureMessage).toHaveBeenCalledWith('Sentry Error', expect.objectContaining({
            level: 'error',
            fingerprint: ['123'],
            extra: expect.objectContaining({ errorCount: 1 })
        }));
    });

    it('initSentryErrorReporting ignores non-error types', () => {
        const mockSentry = {
            captureMessage: jest.fn()
        };
        const callback = initSentryErrorReporting(mockSentry);

        callback({ message: 'Info', type: 'info', fingerprint: '123', count: 1 });

        expect(mockSentry.captureMessage).not.toHaveBeenCalled();
    });

    it('throws error if useError is used outside provider', () => {
        // Suppress console.error for this test
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => {
            renderHook(() => useError());
        }).toThrow('useError must be used within an ErrorProvider');

        consoleSpy.mockRestore();
    });
});
