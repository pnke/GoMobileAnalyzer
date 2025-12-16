/**
 * Performance Budget Hook
 *
 * Monitors component render performance and warns when budgets are exceeded.
 * Use in performance-critical components like GoBoard, GameChart.
 */
import { useRef, useEffect, useCallback } from 'react';

// Performance budget configuration
const PERFORMANCE_BUDGETS = {
    /** Maximum render time in ms (16ms = 60fps target) */
    maxRenderTimeMs: 16,
    /** Maximum re-renders per second before warning */
    maxRendersPerSecond: 10,
    /** Minimum interval between warnings (prevent spam) */
    warningThrottleMs: 5000,
} as const;

interface RenderMetrics {
    renderCount: number;
    lastRenderTime: number;
    lastWarningTime: number;
    renderTimes: number[];
}

interface PerformanceWarning {
    type: 'slow_render' | 'excessive_renders';
    componentName: string;
    value: number;
    budget: number;
}

type WarningCallback = (warning: PerformanceWarning) => void;

/**
 * Hook to monitor component render performance.
 *
 * @param componentName - Name of the component for logging
 * @param onWarning - Optional callback when budget exceeded (default: console.warn)
 *
 * @example
 * ```tsx
 * const GoBoard = () => {
 *   const { measureRender } = useRenderBudget('GoBoard');
 *
 *   useEffect(() => {
 *     return measureRender();
 *   });
 *
 *   return <View>...</View>;
 * };
 * ```
 */
export const useRenderBudget = (
    componentName: string,
    onWarning?: WarningCallback
) => {
    const metricsRef = useRef<RenderMetrics>({
        renderCount: 0,
        lastRenderTime: 0,
        lastWarningTime: 0,
        renderTimes: [],
    });

    const handleWarning = useCallback((warning: PerformanceWarning) => {
        if (onWarning) {
            onWarning(warning);
        } else if (__DEV__) {
            // Only log in development
            const message = warning.type === 'slow_render'
                ? `⚠️ [Performance] ${warning.componentName}: Slow render ${warning.value.toFixed(1)}ms (budget: ${warning.budget}ms)`
                : `⚠️ [Performance] ${warning.componentName}: ${warning.value} renders/sec (budget: ${warning.budget}/sec)`;
            console.warn(message);
        }
    }, [onWarning]);

    /**
     * Start measuring a render. Call at the beginning of render.
     * Returns a cleanup function to call when render completes.
     */
    const measureRender = useCallback(() => {
        const startTime = performance.now();
        const metrics = metricsRef.current;

        return () => {
            const endTime = performance.now();
            const renderTime = endTime - startTime;
            const now = Date.now();

            // Track render times (keep last 10)
            metrics.renderTimes.push(renderTime);
            if (metrics.renderTimes.length > 10) {
                metrics.renderTimes.shift();
            }

            // Check for slow render
            if (renderTime > PERFORMANCE_BUDGETS.maxRenderTimeMs) {
                if (now - metrics.lastWarningTime > PERFORMANCE_BUDGETS.warningThrottleMs) {
                    handleWarning({
                        type: 'slow_render',
                        componentName,
                        value: renderTime,
                        budget: PERFORMANCE_BUDGETS.maxRenderTimeMs,
                    });
                    metrics.lastWarningTime = now;
                }
            }

            // Track render rate
            metrics.renderCount++;
            const timeSinceLastRender = now - metrics.lastRenderTime;
            metrics.lastRenderTime = now;

            // Check for excessive re-renders (if renders happening < 100ms apart)
            if (timeSinceLastRender < 100 && timeSinceLastRender > 0) {
                const rendersPerSecond = 1000 / timeSinceLastRender;
                if (rendersPerSecond > PERFORMANCE_BUDGETS.maxRendersPerSecond) {
                    if (now - metrics.lastWarningTime > PERFORMANCE_BUDGETS.warningThrottleMs) {
                        handleWarning({
                            type: 'excessive_renders',
                            componentName,
                            value: Math.round(rendersPerSecond),
                            budget: PERFORMANCE_BUDGETS.maxRendersPerSecond,
                        });
                        metrics.lastWarningTime = now;
                    }
                }
            }
        };
    }, [componentName, handleWarning]);

    /**
     * Get average render time from recent renders.
     */
    const getAverageRenderTime = useCallback(() => {
        const times = metricsRef.current.renderTimes;
        if (times.length === 0) return 0;
        return times.reduce((a, b) => a + b, 0) / times.length;
    }, []);

    /**
     * Get total render count since mount.
     */
    const getRenderCount = useCallback(() => {
        return metricsRef.current.renderCount;
    }, []);

    // Reset on unmount
    useEffect(() => {
        return () => {
            metricsRef.current = {
                renderCount: 0,
                lastRenderTime: 0,
                lastWarningTime: 0,
                renderTimes: [],
            };
        };
    }, []);

    return {
        measureRender,
        getAverageRenderTime,
        getRenderCount,
        budgets: PERFORMANCE_BUDGETS,
    };
};

/**
 * Performance budgets for the application.
 * Can be used for CI/CD checks or runtime validation.
 */
export const APP_PERFORMANCE_BUDGETS = {
    /** Bundle size limits in KB */
    bundleSize: {
        javascript: 500,
        assets: 2000,
        total: 3000,
    },
    /** Initial load time targets in ms */
    loadTime: {
        firstContentfulPaint: 1500,
        timeToInteractive: 3000,
    },
    /** Component-specific budgets */
    components: {
        GoBoard: { maxRenderMs: 32 }, // 30fps ok for board
        GameChart: { maxRenderMs: 16 }, // 60fps for smooth scrolling
    },
} as const;
