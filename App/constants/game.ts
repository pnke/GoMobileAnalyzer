export const BOARD_SIZE = 19;
export const BOARD_PADDING = 20;
export const CORNER_SIZE = 40;
export const MINI_FAB_SIZE = 48; // Increased for better touch target
export const INITIAL_BOARD: number[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(0)
);
export const CAPTURE_QUALITY = 0.5;
export const SUPPORTED_BOARD_SIZES = [9, 13, 19];
