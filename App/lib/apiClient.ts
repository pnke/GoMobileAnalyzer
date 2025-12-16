/**
 * Secure API Client
 * Handles all API communication with proper error handling, security, and retries.
 */

import * as SecureStore from 'expo-secure-store';
// Import centralized settings
import { CircuitBreakerSettings, ApiSettings } from '../config/settings';

export interface ApiClientConfig {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
    retries?: number;
}

export interface ApiError {
    code: number;
    message: string;
    requestId?: string;
}

export class ApiClientError extends Error {
    public readonly code: number;
    public readonly requestId?: string;

    constructor(error: ApiError) {
        super(error.message);
        this.name = 'ApiClientError';
        this.code = error.code;
        this.requestId = error.requestId;
    }
}

/**
 * Circuit Breaker State
 * Prevents cascading failures by stopping requests when service is unhealthy.
 */
enum CircuitState {
    CLOSED = 'CLOSED',     // Normal operation
    OPEN = 'OPEN',         // Service down, reject requests
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

interface CircuitBreakerConfig {
    failureThreshold: number;  // Failures before opening circuit
    resetTimeout: number;      // ms before trying again (half-open)
}



const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: CircuitBreakerSettings.failureThreshold,
    resetTimeout: CircuitBreakerSettings.resetTimeout,
};

/**
 * Base API Client with common functionality
 */
abstract class BaseApiClient {
    protected timeout: number;
    protected retries: number;

    // Circuit breaker state
    protected circuitState: CircuitState = CircuitState.CLOSED;
    protected failureCount: number = 0;
    protected lastFailureTime: number = 0;
    protected circuitConfig: CircuitBreakerConfig;

    constructor(timeout: number = ApiSettings.timeout, retries: number = ApiSettings.retries) {
        this.timeout = timeout;
        this.retries = retries;
        this.circuitConfig = DEFAULT_CIRCUIT_CONFIG;
    }

    protected abstract getHeaders(contentType?: string): HeadersInit;

    /**
     * Check if circuit breaker allows request.
     * Returns true if request should proceed, false if circuit is open.
     */
    protected checkCircuit(): boolean {
        if (this.circuitState === CircuitState.CLOSED) {
            return true;
        }

        if (this.circuitState === CircuitState.OPEN) {
            // Check if reset timeout has passed
            const now = Date.now();
            if (now - this.lastFailureTime >= this.circuitConfig.resetTimeout) {
                this.circuitState = CircuitState.HALF_OPEN;
                return true; // Allow one test request
            }
            return false; // Still open, reject
        }

        // HALF_OPEN - allow request to test service
        return true;
    }

    /**
     * Record successful request - close circuit if half-open.
     */
    protected recordSuccess(): void {
        this.failureCount = 0;
        this.circuitState = CircuitState.CLOSED;
    }

    /**
     * Record failed request - may open circuit.
     */
    protected recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.circuitConfig.failureThreshold) {
            this.circuitState = CircuitState.OPEN;
        }
    }

    /**
     * Get current circuit state for diagnostics.
     */
    public getCircuitState(): string {
        return this.circuitState;
    }

    /**
     * Make a request with timeout and exponential backoff retry support.
     * Respects circuit breaker state.
     */
    protected async fetchWithRetry(
        url: string,
        options: RequestInit
    ): Promise<Response> {
        // Check circuit breaker first
        if (!this.checkCircuit()) {
            throw new ApiClientError({
                code: 503,
                message: 'Service temporarily unavailable (circuit breaker open)',
            });
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.retries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });

                // If 5xx error, throw to trigger retry
                if (response.status >= 500 && response.status < 600) {
                    throw new Error(`Server error: ${response.status}`);
                }

                // Success - reset circuit breaker
                this.recordSuccess();
                return response;
            } catch (error: any) {
                lastError = error;

                // Don't retry if aborted by user (not timeout) or if it's the last attempt
                if (error.name === 'AbortError' && !controller.signal.aborted) {
                    // Real user abort
                    throw error;
                }

                if (attempt === this.retries) break;

                // Exponential backoff: 1s, 2s, 4s...
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // All retries failed - record failure for circuit breaker
        this.recordFailure();
        throw lastError || new Error('Request failed after retries');
    }

    /**
     * Parse error response from API.
     */
    protected async parseErrorResponse(response: Response): Promise<ApiError> {
        try {
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                if (data.error) {
                    // Handle both string errors and object errors
                    if (typeof data.error === 'string') {
                        return { code: response.status, message: data.error };
                    }
                    return data.error;
                }
                return {
                    code: response.status,
                    message: data.message || response.statusText,
                };
            } catch (e) {
                // If JSON parse fails, use text
                console.warn('Failed to parse error JSON:', e);
                return {
                    code: response.status,
                    message: text || response.statusText || 'Unknown error',
                };
            }
        } catch (e) {
            console.error('Failed to parse error response:', e);
            return {
                code: response.status,
                message: response.statusText || 'Unknown error',
            };
        }
    }

    protected async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const error = await this.parseErrorResponse(response);
            throw new ApiClientError(error);
        }
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text() as unknown as T;
    }
}

export class ApiClient extends BaseApiClient {
    private config: ApiClientConfig;

    constructor(config: ApiClientConfig) {
        super(config.timeout, config.retries);
        this.config = config;
    }

    protected getHeaders(contentType: string = 'application/json'): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': contentType,
        };

        if (this.config.apiKey) {
            headers['X-API-Key'] = this.config.apiKey;
        }

        return headers;
    }

    /**
     * Analyze SGF content.
     * V1 API: POST /v1/analyses
     */
    async analyzeSgf(sgfContent: string, steps: number = 1000, options?: { startTurn?: number, endTurn?: number }): Promise<string> {
        // V1 Endpoint - matches backend router prefix /v1/analyses
        const url = `${this.config.baseUrl}/v1/analyses`;

        const payload = {
            sgf: sgfContent,
            visits: steps,
            start_turn: options?.startTurn,
            end_turn: options?.endTurn
        };

        const response = await this.fetchWithRetry(url, {
            method: 'POST',
            headers: this.getHeaders('application/json'),
            body: JSON.stringify(payload),
        });

        const envelope = await this.handleResponse<any>(response);
        // Unwrap V1 envelope
        if (envelope.data && envelope.data.sgf) {
            return envelope.data.sgf;
        }
        // Fallback for legacy or direct text (unlikely in V1)
        return envelope;
    }

    /**
     * Check API health.
     * V1 API: GET /health (Global) or /api/v1/health (if moved, but usually global)
     */
    async healthCheck(): Promise<{
        status: string;
        katagoRunning: boolean;
    }> {
        // Keep global health check or move to V1 if implemented
        const url = `${this.config.baseUrl}/health`;

        const response = await this.fetchWithRetry(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        const data = await this.handleResponse<any>(response);
        return {
            status: data.status,
            katagoRunning: data.katago_running,
        };
    }
}

/**
 * Create API client for domain-based backend.
 */
export async function createDomainApiClient(
    baseUrl: string
): Promise<ApiClient> {
    let apiKey: string | null = null;

    try {
        apiKey = await SecureStore.getItemAsync('domainApiKey');
    } catch (error) {
        console.warn('Could not retrieve API key from SecureStore:', error);
    }

    return new ApiClient({
        baseUrl,
        apiKey: apiKey || undefined,
    });
}

/**
 * RunPod-specific API client.
 */
export class RunPodApiClient extends BaseApiClient {
    private endpoint: string;
    private bearerToken?: string;
    private workerKey?: string;

    constructor(config: {
        endpoint: string;
        bearerToken?: string;
        workerKey?: string;
        timeout?: number;
        retries?: number;
    }) {
        super(config.timeout, config.retries);
        this.endpoint = config.endpoint;
        this.bearerToken = config.bearerToken;
        this.workerKey = config.workerKey;
    }

    protected getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // Bearer token for RunPod API authentication
        if (this.bearerToken) {
            headers['Authorization'] = `Bearer ${this.bearerToken}`;
        }

        // Worker key as custom header (not in body!)
        if (this.workerKey) {
            headers['X-Worker-Key'] = this.workerKey;
        }

        return headers;
    }

    async analyzeSgf(sgfContent: string, steps: number = 1000, options?: { startTurn?: number, endTurn?: number }): Promise<string> {
        const response = await this.fetchWithRetry(this.endpoint, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                input: {
                    sgf_data: sgfContent,
                    steps: steps,
                    // NOTE: api_key is now passed via X-Worker-Key header
                    start_turn: options?.startTurn,
                    end_turn: options?.endTurn,
                },
            }),
        });

        // RunPod specific response handling
        if (!response.ok) {
            const error = await this.parseErrorResponse(response);
            // RunPod might return text error
            throw new ApiClientError({
                code: response.status,
                message: `RunPod error: ${error.message}`,
            });
        }

        const data = await response.json();

        if (data.error) {
            throw new ApiClientError({
                code: 500,
                message: `RunPod job error: ${data.error}`,
            });
        }

        if (data.status && data.status !== 'COMPLETED' && data.status !== 'IN_PROGRESS') {
            // Note: RunPod sync endpoint usually returns completed or error.
            // If async, it might be different, but we assume sync here as per previous code.
            throw new ApiClientError({
                code: 500,
                message: `RunPod job failed: status ${data.status}`,
            });
        }

        // Handle case where output is directly returned or wrapped
        if (!data.output) {
            // Fallback or error?
            throw new ApiClientError({ code: 500, message: 'No output from RunPod' });
        }

        return data.output.analyzed_sgf;
    }
}

/**
 * Create RunPod API client with credentials from SecureStore.
 */
export async function createRunPodApiClient(
    endpoint: string
): Promise<RunPodApiClient> {
    let bearerToken: string | null = null;
    let workerKey: string | null = null;

    try {
        bearerToken = await SecureStore.getItemAsync('runpodBearer');
        workerKey = await SecureStore.getItemAsync('runpodWorkerKey');
    } catch (error) {
        console.warn('Could not retrieve RunPod credentials from SecureStore:', error);
    }

    return new RunPodApiClient({
        endpoint,
        bearerToken: bearerToken || undefined,
        workerKey: workerKey || undefined,
    });
}
