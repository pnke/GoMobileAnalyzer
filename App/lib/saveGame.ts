// GoAnalysisApp/lib/saveGame.ts
// SGF file save and export functionality

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { RootNode } from './types';
import { toSgf } from '@game/lib/sgf';

// Directory for saved games (internal storage)
const SAVED_GAMES_DIR = 'saved_games/';

/**
 * Generate a filename for the SGF export
 */
const generateFilename = (): string => {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `go-game-${timestamp}.sgf`;
};

/**
 * Ensure saved games directory exists
 */
const ensureSavedGamesDir = async (): Promise<string> => {
    const dirPath = `${FileSystem.documentDirectory}${SAVED_GAMES_DIR}`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    return dirPath;
};

/**
 * Save SGF file using Storage Access Framework (Android) or Share (iOS)
 * This allows user to choose where to save
 */
export const saveSgfWithPicker = async (
    root: RootNode,
    filename?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const sgfContent = toSgf(root);
        const actualFilename = filename ?? generateFilename();

        if (Platform.OS === 'android') {
            // Use Storage Access Framework on Android
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

            if (!permissions.granted) {
                return { success: false, error: 'Permission denied' };
            }

            // Create the file in the selected directory
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                actualFilename,
                'application/x-go-sgf'
            );

            await FileSystem.writeAsStringAsync(fileUri, sgfContent);

            return { success: true };
        } else {
            // On iOS, use share sheet which includes "Save to Files"
            const tempPath = `${FileSystem.cacheDirectory}${actualFilename}`;
            await FileSystem.writeAsStringAsync(tempPath, sgfContent);

            await Sharing.shareAsync(tempPath, {
                mimeType: 'application/x-go-sgf',
                dialogTitle: 'Save SGF File',
                UTI: 'com.smartgo.sgf',
            });

            return { success: true };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to save SGF:', errorMessage);
        return { success: false, error: errorMessage };
    }
};

/**
 * Save SGF file to internal app storage (quick save)
 */
export const saveSgfFile = async (
    root: RootNode,
    filename?: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
    try {
        const sgfContent = toSgf(root);
        const actualFilename = filename ?? generateFilename();

        const directory = await ensureSavedGamesDir();
        const filePath = `${directory}${actualFilename}`;

        await FileSystem.writeAsStringAsync(filePath, sgfContent);

        return { success: true, path: filePath };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to save SGF:', errorMessage);
        return { success: false, error: errorMessage };
    }
};

/**
 * Export the current game tree as an SGF file and open share dialog
 */
export const exportSgfFile = async (
    root: RootNode,
    filename?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const sgfContent = toSgf(root);
        const actualFilename = filename ?? generateFilename();

        const directory = FileSystem.cacheDirectory ?? '';
        const filePath = `${directory}${actualFilename}`;

        await FileSystem.writeAsStringAsync(filePath, sgfContent);

        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            return { success: false, error: 'Sharing is not available on this device' };
        }

        await Sharing.shareAsync(filePath, {
            mimeType: 'application/x-go-sgf',
            dialogTitle: 'Export SGF File',
            UTI: 'com.smartgo.sgf',
        });

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to export SGF:', errorMessage);
        return { success: false, error: errorMessage };
    }
};

/**
 * List all saved SGF files
 */
export const listSavedGames = async (): Promise<string[]> => {
    try {
        const directory = await ensureSavedGamesDir();
        const files = await FileSystem.readDirectoryAsync(directory);
        return files.filter(f => f.endsWith('.sgf'));
    } catch (e) {
        console.error('Failed to save SGF to file:', e);
        return [];
    }
};

/**
 * Load a saved SGF file
 */
export const loadSavedGame = async (filename: string): Promise<string | null> => {
    try {
        const directory = await ensureSavedGamesDir();
        const filePath = `${directory}${filename}`;
        return await FileSystem.readAsStringAsync(filePath);
    } catch (e) {
        console.error('Failed to pick directory:', e);
        return null;
    }
};

/**
 * Delete a saved SGF file
 */
export const deleteSavedGame = async (filename: string): Promise<boolean> => {
    try {
        const directory = await ensureSavedGamesDir();
        const filePath = `${directory}${filename}`;
        await FileSystem.deleteAsync(filePath);
        return true;
    } catch {
        return false;
    }
};
