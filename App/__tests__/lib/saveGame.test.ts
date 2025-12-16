import { saveSgfWithPicker, saveSgfFile, exportSgfFile, listSavedGames, loadSavedGame, deleteSavedGame } from '../../lib/saveGame';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Mocks
jest.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///data/user/0/com.app/files/',
    cacheDirectory: 'file:///data/user/0/com.app/cache/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
    StorageAccessFramework: {
        requestDirectoryPermissionsAsync: jest.fn(),
        createFileAsync: jest.fn(),
    },
}));

jest.mock('expo-sharing', () => ({
    shareAsync: jest.fn(),
    isAvailableAsync: jest.fn(),
}));

jest.mock('@game/lib/sgf', () => ({
    toSgf: jest.fn(() => '(;GM[1])'),
}));

const mockRootNode: any = { id: 0, children: [] };

describe('saveGame', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('saveSgfWithPicker', () => {
        it('handles Android permission granted', async () => {
            Platform.OS = 'android';
            (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValue({
                granted: true,
                directoryUri: 'content://uri',
            });
            (FileSystem.StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://uri/file.sgf');

            const result = await saveSgfWithPicker(mockRootNode);

            expect(result.success).toBe(true);
            expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('content://uri/file.sgf', '(;GM[1])');
        });

        it('handles Android permission denied', async () => {
            Platform.OS = 'android';
            (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValue({
                granted: false,
            });

            const result = await saveSgfWithPicker(mockRootNode);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission denied');
        });

        it('handles iOS sharing', async () => {
            Platform.OS = 'ios';

            const result = await saveSgfWithPicker(mockRootNode);

            expect(result.success).toBe(true);
            expect(Sharing.shareAsync).toHaveBeenCalled();
            expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
        });

        it('handles errors gracefully', async () => {
            Platform.OS = 'android';
            (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockRejectedValue(new Error('System Error'));

            const result = await saveSgfWithPicker(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('System Error');
        });
    });

    describe('saveSgfFile (Internal)', () => {
        it('saves file successfully', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

            const result = await saveSgfFile(mockRootNode, 'test.sgf');

            expect(result.success).toBe(true);
            expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
                expect.stringContaining('saved_games/test.sgf'),
                '(;GM[1])'
            );
        });

        it('creates directory if missing', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

            await saveSgfFile(mockRootNode);

            expect(FileSystem.makeDirectoryAsync).toHaveBeenCalled();
        });
    });

    describe('exportSgfFile', () => {
        it('shares file if available', async () => {
            (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);

            const result = await exportSgfFile(mockRootNode);

            expect(result.success).toBe(true);
            expect(Sharing.shareAsync).toHaveBeenCalled();
        });

        it('fails if sharing unavailable', async () => {
            (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

            const result = await exportSgfFile(mockRootNode);

            expect(result.success).toBe(false);
            expect(result.error).toContain('available');
        });
    });

    describe('File Operations', () => {
        it('lists saved games', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(['game1.sgf', 'config.json']);

            const files = await listSavedGames();

            expect(files).toEqual(['game1.sgf']);
        });

        it('loads saved game', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('sgf-content');

            const content = await loadSavedGame('game1.sgf');
            expect(content).toBe('sgf-content');
        });

        it('deletes saved game', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

            const success = await deleteSavedGame('game1.sgf');
            expect(success).toBe(true);
            expect(FileSystem.deleteAsync).toHaveBeenCalled();
        });

        it('handles list error gracefully', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readDirectoryAsync as jest.Mock).mockRejectedValue(new Error('Read error'));

            const files = await listSavedGames();
            expect(files).toEqual([]);
        });

        it('handles load error gracefully', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('Read failed'));

            const content = await loadSavedGame('game1.sgf');
            expect(content).toBeNull();
        });

        it('handles delete error gracefully', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('Delete failed'));

            const success = await deleteSavedGame('game1.sgf');
            expect(success).toBe(false);
        });
    });

    describe('saveSgfFile - Error Cases', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('handles write error gracefully', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(new Error('Write failed'));

            const result = await saveSgfFile(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Write failed');
        });

        it('handles generic error', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue('Unknown error');

            const result = await saveSgfFile(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Unknown error');
        });
    });

    describe('exportSgfFile - Error Cases', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('handles write error gracefully', async () => {
            (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(new Error('Write failed'));

            const result = await exportSgfFile(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Write failed');
        });

        it('handles share error gracefully', async () => {
            (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
            (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
            (Sharing.shareAsync as jest.Mock).mockRejectedValue(new Error('Share failed'));

            const result = await exportSgfFile(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Share failed');
        });

        it('handles generic error in export', async () => {
            (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue('Unknown');

            const result = await exportSgfFile(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Unknown error');
        });
    });

    describe('saveSgfWithPicker - Error Cases', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('handles write error on Android gracefully', async () => {
            Platform.OS = 'android';
            (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValue({
                granted: true,
                directoryUri: 'content://uri',
            });
            (FileSystem.StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://uri/file.sgf');
            (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(new Error('Write failed'));

            const result = await saveSgfWithPicker(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Write failed');
        });

        it('handles share error on iOS gracefully', async () => {
            Platform.OS = 'ios';
            (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
            (Sharing.shareAsync as jest.Mock).mockRejectedValue(new Error('Share failed'));

            const result = await saveSgfWithPicker(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Share failed');
        });

        it('handles generic error on picker', async () => {
            Platform.OS = 'android';
            (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockRejectedValue('Unknown');

            const result = await saveSgfWithPicker(mockRootNode);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Unknown error');
        });
    });
});
