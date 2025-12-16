import { ApiClient, RunPodApiClient, createDomainApiClient, createRunPodApiClient } from '../../lib/apiClient';
import * as SecureStore from 'expo-secure-store';
import { act } from '@testing-library/react-native';

// Mock fetch
global.fetch = jest.fn();

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
}));

describe('ApiClient', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
    });

    const config = { baseUrl: 'http://test.com', apiKey: 'test-key' };
    const client = new ApiClient(config);

    test('analyzeSgf sends correct request', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'text/plain' },
            text: () => Promise.resolve('analyzed-sgf'),
        });

        const result = await client.analyzeSgf('sgf-content', 500);

        expect(global.fetch).toHaveBeenCalledWith(
            'http://test.com/v1/analyses',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'test-key',
                },
                body: '{"sgf":"sgf-content","visits":500}',
                signal: expect.any(AbortSignal),
            })
        );
        expect(result).toBe('analyzed-sgf');
    });

    test('analyzeSgf retries on 500 error', async () => {
        // Use real timers but mock setTimeout to resolve immediately
        jest.useRealTimers();
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
            cb();
            return 0 as any;
        });

        // Fail twice with 500, then succeed
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({ status: 500, ok: false })
            .mockResolvedValueOnce({ status: 503, ok: false })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: { get: () => 'text/plain' },
                text: () => Promise.resolve('success'),
            });

        const result = await client.analyzeSgf('sgf', 100);

        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(result).toBe('success');

        setTimeoutSpy.mockRestore();
    });

    test('analyzeSgf throws on 400 error without retry', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: () => Promise.resolve(JSON.stringify({ error: 'Bad Request' })),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('Bad Request');
    });

    test('analyzeSgf throws on 401 error', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: () => Promise.resolve('Unauthorized'),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('Unauthorized');
    });

    test('healthCheck returns status', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ status: 'ok', katago_running: true }),
        });

        const result = await client.healthCheck();
        expect(result).toEqual({ status: 'ok', katagoRunning: true });
    });
});

describe('CircuitBreaker', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('trips circuit after failure threshold', async () => {
        const client = new ApiClient({ baseUrl: 'http://test.com', retries: 0 });

        // Mock 5 failures
        for (let i = 0; i < 5; i++) {
            (global.fetch as jest.Mock).mockResolvedValue({ status: 500, ok: false });
        }

        // Trigger failures
        for (let i = 0; i < 5; i++) {
            try {
                await client.healthCheck();
            } catch { }
        }

        expect(client.getCircuitState()).toBe('OPEN');

        // Next request should fail immediately without fetching
        (global.fetch as jest.Mock).mockClear();

        await expect(client.healthCheck()).rejects.toThrow('circuit breaker open');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('allows one request in HALF_OPEN state after timeout', async () => {
        const client = new ApiClient({ baseUrl: 'http://test.com', retries: 0 });

        // Trip circuit
        for (let i = 0; i < 5; i++) {
            (global.fetch as jest.Mock).mockResolvedValue({ status: 500, ok: false });
            try { await client.healthCheck(); } catch { }
        }

        expect(client.getCircuitState()).toBe('OPEN');

        // Advance time
        await act(async () => { jest.advanceTimersByTime(60000); });

        // Next request should trigger fetch (HALF_OPEN)
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ status: 'ok' }),
        });

        await client.healthCheck();

        expect(global.fetch).toHaveBeenCalled();
        expect(client.getCircuitState()).toBe('CLOSED');
    });
});

describe('RunPodApiClient', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
    });

    const config = {
        endpoint: 'http://runpod.io/v2/test',
        bearerToken: 'bearer-token',
        workerKey: 'worker-key'
    };
    const client = new RunPodApiClient(config);

    test('analyzeSgf sends correct request with headers', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ status: 'COMPLETED', output: { analyzed_sgf: 'analyzed' } }),
        });

        const result = await client.analyzeSgf('sgf', 1000);

        expect(global.fetch).toHaveBeenCalledWith(
            'http://runpod.io/v2/test',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer bearer-token',
                    'X-Worker-Key': 'worker-key'
                },
                body: JSON.stringify({
                    input: {
                        sgf_data: 'sgf',
                        steps: 1000
                    }
                }),
            })
        );
        expect(result).toBe('analyzed');
    });
});

describe('Factory Functions', () => {
    test('createDomainApiClient retrieves key from storage', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-key');

        await createDomainApiClient('http://domain.com');

        expect(SecureStore.getItemAsync).toHaveBeenCalledWith('domainApiKey');
    });

    test('createRunPodApiClient retrieves credentials', async () => {
        (SecureStore.getItemAsync as jest.Mock)
            .mockImplementation((key) => {
                if (key === 'runpodBearer') return Promise.resolve('bearer');
                if (key === 'runpodWorkerKey') return Promise.resolve('worker');
                return Promise.resolve(null);
            });

        await createRunPodApiClient('http://endpoint');
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith('runpodBearer');
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith('runpodWorkerKey');
    });

    test('createDomainApiClient handles missing key', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

        const client = await createDomainApiClient('http://domain.com');
        expect(client).toBeDefined();
    });

    test('createDomainApiClient handles SecureStore error', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));

        const client = await createDomainApiClient('http://domain.com');
        expect(client).toBeDefined();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('createRunPodApiClient handles SecureStore error', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));

        const client = await createRunPodApiClient('http://endpoint');
        expect(client).toBeDefined();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

describe('ApiClient - Additional Coverage', () => {
    let client: ApiClient;

    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
        client = new ApiClient({ baseUrl: 'http://test.com', apiKey: 'test-key', retries: 0 });
    });

    test('analyzeSgf with turn range options', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ data: { sgf: 'analyzed-sgf' } }),
        });

        const result = await client.analyzeSgf('sgf-content', 500, { startTurn: 10, endTurn: 50 });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://test.com/v1/analyses',
            expect.objectContaining({
                body: expect.stringContaining('"start_turn":10'),
            })
        );
        expect(result).toBe('analyzed-sgf');
    });

    test('analyzeSgf unwraps envelope with data.sgf', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ data: { sgf: 'unwrapped-sgf' } }),
        });

        const result = await client.analyzeSgf('sgf', 100);
        expect(result).toBe('unwrapped-sgf');
    });

    test('parseErrorResponse handles error object format', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: () => Promise.resolve(JSON.stringify({ error: { code: 400, message: 'Custom error' } })),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow();
    });

    test('parseErrorResponse handles message field', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: 'Unprocessable',
            text: () => Promise.resolve(JSON.stringify({ message: 'Validation failed' })),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('Validation failed');
    });

    test('parseErrorResponse handles plain text error', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Server Error',
            text: () => Promise.resolve('Plain text error'),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('Plain text error');
    });

    test('parseErrorResponse handles empty body', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Server Error',
            text: () => Promise.resolve(''),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('Server Error');
    });

    test('handleResponse returns JSON for JSON content type', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json; charset=utf-8' },
            json: () => Promise.resolve({ status: 'ok' }),
        });

        const result = await client.healthCheck();
        expect(result.status).toBe('ok');
    });
});

describe('RunPodApiClient - Additional Coverage', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
    });

    test('analyzeSgf with options', async () => {
        const client = new RunPodApiClient({
            endpoint: 'http://runpod.io/test',
            bearerToken: 'bearer',
            workerKey: 'worker'
        });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ status: 'COMPLETED', output: { analyzed_sgf: 'result' } }),
        });

        await client.analyzeSgf('sgf', 1000, { startTurn: 5, endTurn: 20 });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://runpod.io/test',
            expect.objectContaining({
                body: expect.stringContaining('"start_turn":5'),
            })
        );
    });

    test('analyzeSgf handles FAILED status', async () => {
        const client = new RunPodApiClient({ endpoint: 'http://runpod.io/test' });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ status: 'FAILED' }),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('RunPod job failed');
    });

    test('analyzeSgf handles IN_PROGRESS status', async () => {
        const client = new RunPodApiClient({ endpoint: 'http://runpod.io/test' });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ status: 'IN_PROGRESS', output: { analyzed_sgf: 'result' } }),
        });

        const result = await client.analyzeSgf('sgf');
        expect(result).toBe('result');
    });

    test('analyzeSgf handles error in response data', async () => {
        const client = new RunPodApiClient({ endpoint: 'http://runpod.io/test' });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ error: 'Job failed internally' }),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('RunPod job error: Job failed internally');
    });

    test('analyzeSgf handles missing output', async () => {
        const client = new RunPodApiClient({ endpoint: 'http://runpod.io/test' });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ status: 'COMPLETED' }),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('No output from RunPod');
    });

    test('analyzeSgf handles HTTP error', async () => {
        const client = new RunPodApiClient({ endpoint: 'http://runpod.io/test' });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () => Promise.resolve('Auth required'),
        });

        await expect(client.analyzeSgf('sgf')).rejects.toThrow('RunPod error');
    });

    test('getHeaders without tokens', async () => {
        const client = new RunPodApiClient({ endpoint: 'http://runpod.io/test' });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ status: 'COMPLETED', output: { analyzed_sgf: 'result' } }),
        });

        await client.analyzeSgf('sgf');

        expect(global.fetch).toHaveBeenCalledWith(
            'http://runpod.io/test',
            expect.objectContaining({
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        );
    });
});
