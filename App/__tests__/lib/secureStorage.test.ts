import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
    isSecureStorageAvailable,
    setSecureItem,
    getSecureItem,
    deleteSecureItem,
    clearAllCredentials,
    STORAGE_KEYS,
} from '../../lib/secureStorage';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    isAvailableAsync: jest.fn(),
    setItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

// Mock Platform
jest.mock('react-native', () => ({
    Platform: { OS: 'ios' },
}));

describe('secureStorage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    });

    describe('isSecureStorageAvailable', () => {
        it('returns true when SecureStore is available', async () => {
            (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(true);
            const result = await isSecureStorageAvailable();
            expect(result).toBe(true);
        });

        it('returns false on web platform', async () => {
            (Platform as any).OS = 'web';
            const result = await isSecureStorageAvailable();
            expect(result).toBe(false);
            (Platform as any).OS = 'ios'; // Reset
        });

        it('returns false when isAvailableAsync throws', async () => {
            (SecureStore.isAvailableAsync as jest.Mock).mockRejectedValue(new Error('Test error'));
            const result = await isSecureStorageAvailable();
            expect(result).toBe(false);
        });
    });

    describe('setSecureItem', () => {
        it('stores value successfully', async () => {
            (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
            const result = await setSecureItem('testKey', 'testValue');
            expect(result).toBe(true);
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('testKey', 'testValue', {
                keychainAccessible: 'WHEN_UNLOCKED',
            });
        });

        it('deletes item when value is null', async () => {
            (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
            const result = await setSecureItem('testKey', null);
            expect(result).toBe(true);
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('testKey');
        });

        it('returns false for invalid key', async () => {
            const result = await setSecureItem('', 'testValue');
            expect(result).toBe(false);
        });

        it('returns false when storage is unavailable', async () => {
            (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(false);
            const result = await setSecureItem('testKey', 'testValue');
            expect(result).toBe(false);
        });

        it('returns false when setItemAsync throws', async () => {
            (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));
            const result = await setSecureItem('testKey', 'testValue');
            expect(result).toBe(false);
        });
    });

    describe('getSecureItem', () => {
        it('retrieves value successfully', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('storedValue');
            const result = await getSecureItem('testKey');
            expect(result).toBe('storedValue');
        });

        it('returns null for invalid key', async () => {
            const result = await getSecureItem('');
            expect(result).toBeNull();
        });

        it('returns null when storage is unavailable', async () => {
            (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(false);
            const result = await getSecureItem('testKey');
            expect(result).toBeNull();
        });

        it('returns null when getItemAsync throws', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Retrieval error'));
            const result = await getSecureItem('testKey');
            expect(result).toBeNull();
        });
    });

    describe('deleteSecureItem', () => {
        it('deletes item successfully', async () => {
            (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
            const result = await deleteSecureItem('testKey');
            expect(result).toBe(true);
        });

        it('returns false for invalid key', async () => {
            const result = await deleteSecureItem('');
            expect(result).toBe(false);
        });

        it('returns true when storage is unavailable', async () => {
            (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(false);
            const result = await deleteSecureItem('testKey');
            expect(result).toBe(true); // Nothing to delete
        });

        it('returns false when deleteItemAsync throws', async () => {
            (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Delete error'));
            const result = await deleteSecureItem('testKey');
            expect(result).toBe(false);
        });
    });

    describe('clearAllCredentials', () => {
        it('deletes all credential keys', async () => {
            (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
            await clearAllCredentials();
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.DOMAIN_API_KEY);
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.RUNPOD_BEARER);
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.RUNPOD_WORKER_KEY);
        });
    });

    describe('STORAGE_KEYS', () => {
        it('has expected keys', () => {
            expect(STORAGE_KEYS.DOMAIN_API_KEY).toBe('domainApiKey');
            expect(STORAGE_KEYS.RUNPOD_BEARER).toBe('runpodBearer');
            expect(STORAGE_KEYS.RUNPOD_WORKER_KEY).toBe('runpodWorkerKey');
        });
    });
});
