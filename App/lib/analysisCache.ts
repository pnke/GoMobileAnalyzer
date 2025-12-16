// GoAnalysisApp/lib/analysisCache.ts
// Local caching of analysis results to avoid redundant API calls

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'analysis_cache_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_ENTRIES = 50;

export type CachedAnalysis = {
    winrate: number[];
    score: number[];
    timestamp: number;
};

/**
 * Generate a cache key from SGF content
 * Uses a simple hash function for performance
 */
export const generateCacheKey = (sgfContent: string): string => {
    let hash = 0;
    for (let i = 0; i < sgfContent.length; i++) {
        const char = sgfContent.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `${CACHE_PREFIX}${hash.toString(36)}`;
};

/**
 * Get cached analysis data if available and not expired
 */
export const getCachedAnalysis = async (
    key: string
): Promise<CachedAnalysis | null> => {
    try {
        const cached = await AsyncStorage.getItem(key);
        if (!cached) return null;

        const data: CachedAnalysis = JSON.parse(cached);

        // Check if cache has expired
        if (Date.now() - data.timestamp > CACHE_TTL_MS) {
            await AsyncStorage.removeItem(key);
            return null;
        }

        return data;
    } catch (e) {
        console.error('Failed to load analysis cache:', e);
        return null;
    }
};

/**
 * Store analysis data in cache
 */
export const setCachedAnalysis = async (
    key: string,
    winrate: number[],
    score: number[]
): Promise<void> => {
    try {
        const data: CachedAnalysis = {
            winrate,
            score,
            timestamp: Date.now(),
        };

        await AsyncStorage.setItem(key, JSON.stringify(data));

        // Cleanup old entries if needed
        await cleanupOldCacheEntries();
    } catch (error) {
        console.warn('Failed to cache analysis:', error);
    }
};

/**
 * Remove old cache entries to prevent storage bloat
 */
const cleanupOldCacheEntries = async (): Promise<void> => {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));

        if (cacheKeys.length <= MAX_CACHE_ENTRIES) return;

        // Get all cache entries with timestamps
        const entries: { key: string; timestamp: number }[] = [];

        for (const key of cacheKeys) {
            const value = await AsyncStorage.getItem(key);
            if (value) {
                try {
                    const data = JSON.parse(value) as CachedAnalysis;
                    entries.push({ key, timestamp: data.timestamp });
                } catch (e) {
                    console.error('Failed to parse cached analysis:', e);
                    // Invalid entry, mark for removal
                    entries.push({ key, timestamp: 0 });
                }
            }
        }

        // Sort by timestamp (oldest first) and remove excess
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);

        await AsyncStorage.multiRemove(toRemove.map((e) => e.key));
    } catch (e) {
        console.error('Failed to clear old analysis cache:', e);
        // Ignore cleanup errors
    }
};

/**
 * Clear all analysis cache
 */
export const clearAnalysisCache = async (): Promise<void> => {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
        await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
        console.warn('Failed to clear analysis cache:', error);
    }
};
