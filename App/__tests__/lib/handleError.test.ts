import { getErrorMessage } from '../../lib/handleError';
import { ApiClientError } from '../../lib/apiClient';

describe('handleError', () => {
    const t = jest.fn((key) => key) as any;

    beforeEach(() => {
        t.mockClear();
    });

    describe('ApiClientError', () => {
        test('handles code 0 as network error', () => {
            const error = new ApiClientError({ message: 'Network Error', code: 0 });
            expect(getErrorMessage(error, t)).toBe('alerts.networkError');
        });

        test('handles code 500 as server error', () => {
            const error = new ApiClientError({ message: 'Server Error', code: 500 });
            expect(getErrorMessage(error, t)).toBe('alerts.serverError');
        });

        test('handles code 503 as server error', () => {
            const error = new ApiClientError({ message: 'Service Unavailable', code: 503 });
            expect(getErrorMessage(error, t)).toBe('alerts.serverError');
        });

        test('handles code 401 as unauthorized', () => {
            const error = new ApiClientError({ message: 'Unauthorized', code: 401 });
            expect(getErrorMessage(error, t)).toBe('alerts.unauthorized');
        });

        test('handles code 403 as unauthorized', () => {
            const error = new ApiClientError({ message: 'Forbidden', code: 403 });
            expect(getErrorMessage(error, t)).toBe('alerts.unauthorized');
        });

        test('handles code 400 as bad request', () => {
            const error = new ApiClientError({ message: 'Bad Request', code: 400 });
            expect(getErrorMessage(error, t)).toBe('alerts.badRequest');
        });

        test('handles unknown code by falling back to message', () => {
            const error = new ApiClientError({ message: 'Custom Message', code: 418 });
            expect(getErrorMessage(error, t)).toBe('Custom Message');
        });

        test('handles unknown code with empty message by falling back to default key', () => {
            const error = new ApiClientError({ message: '', code: 418 });
            expect(getErrorMessage(error, t)).toBe('alerts.failed');
        });
    });

    describe('Standard Error', () => {
        test('handles SGF parsing errors', () => {
            const error = new Error('Failed to parse SGF');
            expect(getErrorMessage(error, t)).toBe('alerts.invalidSgf');
        });

        test('handles file permission errors', () => {
            const error = new Error('EACCES: permission denied');
            expect(getErrorMessage(error, t)).toBe('alerts.fileAccessError');
        });

        test('handles network errors in message', () => {
            const error = new Error('Network request failed');
            expect(getErrorMessage(error, t)).toBe('alerts.networkError');
        });

        test('returns message for unknown errors', () => {
            const error = new Error('Something went wrong');
            expect(getErrorMessage(error, t)).toBe('Something went wrong');
        });
    });

    describe('Unknown Object', () => {
        test('returns default key for unknown objects', () => {
            expect(getErrorMessage({}, t)).toBe('alerts.failed');
        });

        test('returns custom default key', () => {
            expect(getErrorMessage({}, t, 'custom.key')).toBe('custom.key');
        });
    });
});
