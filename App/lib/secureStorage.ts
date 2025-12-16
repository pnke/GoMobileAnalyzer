/**
 * Secure Storage Wrapper
 * Provides a consistent interface for secure storage with fallbacks.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface SecureStorageOptions {
    /**
     * iOS: When the keychain item is accessible.
     * Default: WHEN_UNLOCKED
     */
    keychainAccessible?: SecureStore.SecureStoreOptions['keychainAccessible'];
}

const DEFAULT_OPTIONS: SecureStorageOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

/**
 * Check if SecureStore is available on this platform.
 */
export async function isSecureStorageAvailable(): Promise<boolean> {
    // SecureStore is not available on web
    if (Platform.OS === 'web') {
        return false;
    }

    try {
        return await SecureStore.isAvailableAsync();
    } catch (e) {
        console.error('Failed to delete secure item:', e);
        return false;
    }
}

/**
 * Securely store a value.
 *
 * @param key - Storage key
 * @param value - Value to store (will be deleted if empty/null)
 * @param options - Storage options
 * @returns true if stored successfully
 */
export async function setSecureItem(
    key: string,
    value: string | null | undefined,
    options: SecureStorageOptions = DEFAULT_OPTIONS
): Promise<boolean> {
    // Validate key
    if (!key || typeof key !== 'string') {
        console.error('SecureStorage: Invalid key');
        return false;
    }

    const isAvailable = await isSecureStorageAvailable();
    if (!isAvailable) {
        console.warn(`SecureStorage: Not available, skipping storage of ${key}`);
        return false;
    }

    try {
        if (!value) {
            // Delete if value is empty
            await SecureStore.deleteItemAsync(key);
        } else {
            await SecureStore.setItemAsync(key, value, {
                keychainAccessible: options.keychainAccessible,
            });
        }
        return true;
    } catch (error) {
        console.error(`SecureStorage: Failed to store ${key}:`, error);
        return false;
    }
}

/**
 * Retrieve a securely stored value.
 *
 * @param key - Storage key
 * @returns The stored value or null
 */
export async function getSecureItem(key: string): Promise<string | null> {
    if (!key || typeof key !== 'string') {
        console.error('SecureStorage: Invalid key');
        return null;
    }

    const isAvailable = await isSecureStorageAvailable();
    if (!isAvailable) {
        console.warn(`SecureStorage: Not available, cannot retrieve ${key}`);
        return null;
    }

    try {
        return await SecureStore.getItemAsync(key);
    } catch (error) {
        console.error(`SecureStorage: Failed to retrieve ${key}:`, error);
        return null;
    }
}

/**
 * Delete a securely stored value.
 *
 * @param key - Storage key
 * @returns true if deleted successfully
 */
export async function deleteSecureItem(key: string): Promise<boolean> {
    if (!key || typeof key !== 'string') {
        console.error('SecureStorage: Invalid key');
        return false;
    }

    const isAvailable = await isSecureStorageAvailable();
    if (!isAvailable) {
        return true; // Nothing to delete if not available
    }

    try {
        await SecureStore.deleteItemAsync(key);
        return true;
    } catch (error) {
        console.error(`SecureStorage: Failed to delete ${key}:`, error);
        return false;
    }
}

/**
 * Storage keys used in the app.
 * Centralizing these prevents typos and makes refactoring easier.
 */
export const STORAGE_KEYS = {
    DOMAIN_API_KEY: 'domainApiKey',
    RUNPOD_BEARER: 'runpodBearer',
    RUNPOD_WORKER_KEY: 'runpodWorkerKey',
} as const;

/**
 * Clear all stored credentials.
 */
export async function clearAllCredentials(): Promise<void> {
    await Promise.all([
        deleteSecureItem(STORAGE_KEYS.DOMAIN_API_KEY),
        deleteSecureItem(STORAGE_KEYS.RUNPOD_BEARER),
        deleteSecureItem(STORAGE_KEYS.RUNPOD_WORKER_KEY),
    ]);
}
