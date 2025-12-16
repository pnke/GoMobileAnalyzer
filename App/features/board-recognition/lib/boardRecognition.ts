// lib/boardRecognition.ts
// API client for board recognition service

import * as FileSystem from 'expo-file-system/legacy';

export type RecognitionResult = {
    sgf: string;
    boardSize: number;
    confidence: number;
    blackStones: number;
    whiteStones: number;
    board?: number[][];  // 2D array for stone editing
    warpedImageBase64?: string;  // Warped board image for stone editor
};

export type RecognitionError = {
    error: string;
    message: string;
    code: string;
};

/**
 * Recognize Go board from an image file
 * @param imageUri - Local URI of the image file
 * @param backendUrl - Backend URL (e.g., http://192.168.1.x:8000)
 * @param apiKey - API key for authentication
 * @param boardSize - Expected board size (9, 13, or 19)
 */
export async function recognizeBoard(
    imageUri: string,
    backendUrl: string,
    apiKey: string,
    boardSize: number = 19
): Promise<RecognitionResult> {
    // Backend route: POST /v1/recognitions with query param
    const endpoint = `${backendUrl}/v1/recognitions?board_size=${boardSize}`;

    // Read file as base64 for upload
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
        throw new Error('Image file not found');
    }

    // Create FormData with the image
    const formData = new FormData();

    // Extract filename from URI
    const filename = imageUri.split('/').pop() || 'board.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    // Append file to FormData
    formData.append('image', {
        uri: imageUri,
        name: filename,
        type: type,
    } as unknown as Blob);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                // Don't set Content-Type for FormData - browser/RN sets it with boundary
            },
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            const error = data as RecognitionError;
            throw new Error(error.message || `Recognition failed: ${response.status}`);
        }

        // V1 API returns envelope with data wrapper
        const payload = data.data || data;
        return {
            sgf: payload.sgf,
            boardSize: payload.boardSize ?? payload.board_size,
            confidence: payload.confidence,
            blackStones: payload.blackStones ?? payload.black_stones,
            whiteStones: payload.whiteStones ?? payload.white_stones,
            board: payload.board,
            warpedImageBase64: payload.warpedImageBase64 ?? payload.warped_image_base64,
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error during board recognition');
    }
}

// Types for two-step recognition
export type Corner = [number, number];  // [x, y]

export type CornersResult = {
    corners: Corner[];  // 4 corners: top-left, top-right, bottom-right, bottom-left
    imageWidth: number;
    imageHeight: number;
    previewBase64: string;  // Base64 encoded preview image
};

/**
 * Detect board corners from an image (Step 1 of manual recognition)
 */
export async function detectCorners(
    imageUri: string,
    backendUrl: string,
    apiKey: string
): Promise<CornersResult> {
    // Backend route: POST /v1/recognitions/corners
    const endpoint = `${backendUrl}/v1/recognitions/corners`;

    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'board.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('image', {
        uri: imageUri,
        name: filename,
        type: type,
    } as unknown as Blob);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey },
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `Corner detection failed: ${response.status}`);
        }

        // V1 API returns envelope with data wrapper
        const payload = data.data || data;
        return {
            corners: payload.corners,
            imageWidth: payload.imageWidth ?? payload.image_width,
            imageHeight: payload.imageHeight ?? payload.image_height,
            previewBase64: payload.previewBase64 ?? payload.preview_base64,
        };
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Network error during corner detection');
    }
}

/**
 * Classify stones using provided corners (Step 2 of manual recognition)
 */
export async function classifyWithCorners(
    imageUri: string,
    corners: Corner[],
    backendUrl: string,
    apiKey: string,
    boardSize: number = 19
): Promise<RecognitionResult> {
    const cornersJson = JSON.stringify(corners);
    // Backend route: POST /v1/recognitions/classify with query params
    const endpoint = `${backendUrl}/v1/recognitions/classify?corners=${encodeURIComponent(cornersJson)}&board_size=${boardSize}`;

    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'board.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('image', {
        uri: imageUri,
        name: filename,
        type: type,
    } as unknown as Blob);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey },
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `Classification failed: ${response.status}`);
        }

        // V1 API returns envelope with data wrapper
        const payload = data.data || data;
        return {
            sgf: payload.sgf,
            boardSize: payload.boardSize ?? payload.board_size,
            confidence: payload.confidence,
            blackStones: payload.blackStones ?? payload.black_stones,
            whiteStones: payload.whiteStones ?? payload.white_stones,
            board: payload.board,
            warpedImageBase64: payload.warpedImageBase64 ?? payload.warped_image_base64,
        };
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Network error during classification');
    }
}

/**
 * Convert board array to SGF string (client-side)
 */
export function boardToSgf(board: number[][], boardSize: number = 19): string {
    const blackStones: string[] = [];
    const whiteStones: string[] = [];

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const cell = board[row]?.[col];
            if (cell === 1) {
                blackStones.push(String.fromCharCode(97 + col) + String.fromCharCode(97 + row));
            } else if (cell === 2) {
                whiteStones.push(String.fromCharCode(97 + col) + String.fromCharCode(97 + row));
            }
        }
    }

    let sgf = `(;GM[1]FF[4]SZ[${boardSize}]`;
    if (blackStones.length > 0) {
        sgf += 'AB' + blackStones.map(s => `[${s}]`).join('');
    }
    if (whiteStones.length > 0) {
        sgf += 'AW' + whiteStones.map(s => `[${s}]`).join('');
    }
    sgf += ')';

    return sgf;
}
