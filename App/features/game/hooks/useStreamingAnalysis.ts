/**
 * useStreamingAnalysis Hook
 * Handles Server-Sent Events for real-time analysis progress.
 */
import { useState, useCallback, useRef } from 'react';
import { useSettingsContext } from '@settings/context/SettingsContext';
import { buildApiHeaders, getStreamingUrl } from '@/lib/apiUtils';

export interface TurnAnalysis {
    turn: number;
    total: number;
    winrate: number;
    score: number;
    currentPlayer: 'B' | 'W';
    topMoves: {
        move: string;
        winrate: number;
        visits: number;
    }[];
}

export interface StreamingState {
    isStreaming: boolean;
    progress: { current: number; total: number };
    results: TurnAnalysis[];
    error: string | null;
}

export function useStreamingAnalysis() {
    const { backendConfig } = useSettingsContext();
    const eventSourceRef = useRef<EventSource | null>(null);

    const [state, setState] = useState<StreamingState>({
        isStreaming: false,
        progress: { current: 0, total: 0 },
        results: [],
        error: null,
    });

    const startStream = useCallback(async (
        sgfContent: string,
        steps: number = 1000,
        options?: { startTurn?: number; endTurn?: number }
    ) => {
        // Close any existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setState({
            isStreaming: true,
            progress: { current: 0, total: 0 },
            results: [],
            error: null,
        });

        const url = getStreamingUrl(backendConfig);

        const payload = {
            sgf: sgfContent,
            visits: steps,
            start_turn: options?.startTurn,
            end_turn: options?.endTurn
        };

        try {
            const headers = buildApiHeaders(backendConfig, { 'Accept': 'text/event-stream' });

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    setState(prev => ({ ...prev, isStreaming: false }));
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;

                        try {
                            const data = JSON.parse(jsonStr);

                            if (data.done) {
                                setState(prev => ({ ...prev, isStreaming: false }));
                                return;
                            }

                            if (data.error) {
                                setState(prev => ({
                                    ...prev,
                                    isStreaming: false,
                                    error: data.error
                                }));
                                return;
                            }

                            // Update state with new turn result
                            setState(prev => ({
                                ...prev,
                                progress: { current: data.turn + 1, total: data.total },
                                results: [...prev.results, data],
                            }));
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', jsonStr, e);
                        }
                    }
                }
            }
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                isStreaming: false,
                error: error.message || 'Connection failed',
            }));
        }
    }, [backendConfig]);

    const stopStream = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setState(prev => ({ ...prev, isStreaming: false }));
    }, []);

    return {
        ...state,
        startStream,
        stopStream,
    };
}
