# ServerGo/services/stone_classifier.py
"""
Stone Classification for Go Board Recognition
Classifies each cell as empty, black stone, or white stone.
"""

import cv2
import numpy as np
from typing import List
from enum import IntEnum
import logging

logger = logging.getLogger(__name__)


class StoneColor(IntEnum):
    EMPTY = 0
    BLACK = 1
    WHITE = 2


class StoneClassifier:
    """Classifies stones in Go board cells."""

    def __init__(self) -> None:
        # Thresholds for stone detection (adjustable)
        # Board wood is typically 150-210 brightness
        # Black stones are very dark (<80)
        # White stones are very bright (>220)
        self.black_threshold = 80  # Max brightness for black stone
        self.white_threshold = 220  # Min brightness for white stone
        self.board_low = 140  # Board wood min brightness
        self.board_high = 210  # Board wood max brightness

    def classify_cell(self, cell_image: np.ndarray) -> StoneColor:
        """
        Classify a single cell as empty, black, or white.
        Uses brightness analysis.
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(cell_image, cv2.COLOR_BGR2GRAY)

            # Get center region (stones are typically in center)
            h, w = gray.shape
            margin = max(1, min(h, w) // 4)
            center = gray[margin : h - margin, margin : w - margin]

            if center.size == 0:
                return StoneColor.EMPTY

            # Calculate mean brightness
            mean_brightness = np.mean(center)

            # Also check a circular region in the center
            center_y, center_x = h // 2, w // 2
            radius = min(h, w) // 3
            y_coords, x_coords = np.ogrid[:h, :w]
            mask = (x_coords - center_x) ** 2 + (y_coords - center_y) ** 2 <= radius**2

            if np.sum(mask) > 0:
                circular_mean = np.mean(gray[mask])
            else:
                circular_mean = mean_brightness

            # Use circular measurement as primary
            brightness = circular_mean

            # Classification logic:
            # - Black stones: very dark (<80)
            # - White stones: very bright (>220)
            # - Empty board (wood): typically 140-210

            if brightness < self.black_threshold:
                return StoneColor.BLACK
            elif brightness > self.white_threshold:
                return StoneColor.WHITE
            else:
                # In the "board" range - check if there's high contrast (stone edge)
                variance = np.var(center)
                if variance > 1000:
                    # High variance might indicate a stone with shadow
                    return self._advanced_classification(gray)
                return StoneColor.EMPTY

        except Exception as e:
            logger.error(f"Cell classification failed: {e}")
            return StoneColor.EMPTY
            return StoneColor.EMPTY

    def _advanced_classification(self, gray_image: np.ndarray) -> StoneColor:
        """
        More sophisticated classification for ambiguous cases.
        Uses histogram analysis.
        """
        # Analyze histogram
        hist = cv2.calcHist([gray_image], [0], None, [256], [0, 256])
        hist = hist.flatten()

        # Find peaks in dark and bright regions
        dark_sum = np.sum(hist[:100])
        bright_sum = np.sum(hist[150:])
        mid_sum = np.sum(hist[100:150])

        # Strong dark presence = black stone
        if dark_sum > bright_sum * 1.5 and dark_sum > mid_sum:
            return StoneColor.BLACK
        # Strong bright presence = white stone
        elif bright_sum > dark_sum * 1.5 and bright_sum > mid_sum:
            return StoneColor.WHITE

        return StoneColor.EMPTY

    def classify_board(self, cells: List[List[np.ndarray]]) -> List[List[int]]:
        """
        Classify all cells on the board.

        Args:
            cells: 2D list of cell images

        Returns:
            2D list of stone colors (0=empty, 1=black, 2=white)
        """
        board = []
        stats = {"black": 0, "white": 0, "empty": 0}
        brightness_samples = []

        for row_idx, row in enumerate(cells):
            board_row = []
            for col_idx, cell in enumerate(row):
                color = self.classify_cell(cell)
                board_row.append(int(color))

                # Track stats
                if color == StoneColor.BLACK:
                    stats["black"] += 1
                elif color == StoneColor.WHITE:
                    stats["white"] += 1
                else:
                    stats["empty"] += 1

                # Sample brightness from a few cells for debugging
                if row_idx < 3 and col_idx < 3:
                    try:
                        gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
                        brightness_samples.append(int(np.mean(gray)))
                    except Exception:
                        pass

            board.append(board_row)

        logger.info(
            f"Classification stats: {stats}, sample brightness: {brightness_samples}"
        )

        return board


def board_to_sgf(board: List[List[int]], board_size: int = 19) -> str:
    """
    Convert detected board state to SGF format.

    Args:
        board: 2D list of stone colors
        board_size: Size of the board (9, 13, or 19)

    Returns:
        SGF string representing the board position
    """
    black_stones = []
    white_stones = []

    for row in range(board_size):
        for col in range(board_size):
            if row < len(board) and col < len(board[row]):
                stone = board[row][col]
                coord = chr(ord("a") + col) + chr(ord("a") + row)

                if stone == StoneColor.BLACK:
                    black_stones.append(coord)
                elif stone == StoneColor.WHITE:
                    white_stones.append(coord)

    # Build SGF
    sgf = f"(;GM[1]FF[4]SZ[{board_size}]"

    if black_stones:
        sgf += "AB" + "".join(f"[{s}]" for s in black_stones)
    if white_stones:
        sgf += "AW" + "".join(f"[{s}]" for s in white_stones)

    sgf += ")"

    return sgf
