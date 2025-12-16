# ServerGo/services/board_detector.py
"""
Go Board Detection using OpenCV
Detects board corners, applies perspective transform, extracts grid.
"""

import cv2
import numpy as np
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)


class BoardDetector:
    """Detects Go board from image and extracts grid."""

    def __init__(self, board_size: int = 19) -> None:
        self.board_size = board_size

    def detect_board(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Detect board corners and return warped square image.

        For now, just crops the image to a square and resizes.
        Contour-based detection is disabled as it often finds wrong areas.

        Args:
            image: BGR image from OpenCV

        Returns:
            Warped square image of the board, or None if detection failed
        """
        try:
            # Simple approach: crop to square and resize
            # Assumes the board fills most of the image
            h, w = image.shape[:2]

            logger.info(f"Input image size: {w}x{h}")

            # Crop to square from center
            min_dim = min(h, w)
            start_x = (w - min_dim) // 2
            start_y = (h - min_dim) // 2
            cropped = image[start_y : start_y + min_dim, start_x : start_x + min_dim]

            # Resize to standard size for consistent processing
            warped = cv2.resize(cropped, (600, 600))

            return warped

        except Exception as e:
            logger.error(f"Board detection failed: {e}")
            return None

    def _detect_with_canny(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Try detection with Canny edge detection."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(
            edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        return self._find_board_contour(list(contours))

    def _detect_with_adaptive(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Try detection with adaptive thresholding."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        # Adaptive threshold
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        contours, _ = cv2.findContours(
            thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        return self._find_board_contour(list(contours))

    def _find_board_contour(self, contours: List[np.ndarray]) -> Optional[np.ndarray]:
        """Find the contour most likely to be the Go board."""
        if not contours:
            return None

        # Sort by area, largest first
        sorted_contours = sorted(contours, key=cv2.contourArea, reverse=True)

        for contour in sorted_contours[:10]:  # Check top 10 largest
            # Approximate to polygon with different tolerances
            peri = cv2.arcLength(contour, True)
            for tolerance in [0.02, 0.03, 0.05]:
                approx = cv2.approxPolyDP(contour, tolerance * peri, True)
                # Accept quadrilaterals (4 corners)
                if len(approx) == 4:
                    return approx

        return None

    def _order_corners(self, corners: np.ndarray) -> np.ndarray:
        """Order corners as: top-left, top-right, bottom-right, bottom-left."""
        corners = corners.reshape(4, 2)

        # Sum and diff to identify corners
        s = corners.sum(axis=1)
        diff = np.diff(corners, axis=1)

        ordered = np.zeros((4, 2), dtype=np.float32)
        ordered[0] = corners[np.argmin(s)]  # Top-left
        ordered[2] = corners[np.argmax(s)]  # Bottom-right
        ordered[1] = corners[np.argmin(diff)]  # Top-right
        ordered[3] = corners[np.argmax(diff)]  # Bottom-left

        return ordered

    def _warp_perspective(self, image: np.ndarray, corners: np.ndarray) -> np.ndarray:
        """Apply perspective transform to get square board image."""
        # Target size (square)
        size = 600  # Output image size

        dst = np.array(
            [[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]],
            dtype=np.float32,
        )

        matrix = cv2.getPerspectiveTransform(corners, dst)
        warped = cv2.warpPerspective(image, matrix, (size, size))

        return warped

    def extract_grid_cells(
        self, board_image: np.ndarray, margin_percent: float = 0.025
    ) -> List[List[np.ndarray]]:
        """
        Extract individual cells from warped board image.

        Args:
            board_image: Square image of the board
            margin_percent: Estimated margin outside playing area (0.025 = 2.5% on each side)

        Returns:
            2D list of cell images [row][col]
        """
        height, width = board_image.shape[:2]

        # Account for board margins (wood outside the playing grid)
        margin_x = int(width * margin_percent)
        margin_y = int(height * margin_percent)

        # Playing area dimensions (inside the margins)
        play_width = width - 2 * margin_x
        play_height = height - 2 * margin_y

        # Cell size within the playing area
        # For 19x19, we have 18 gaps between 19 lines
        cell_width = play_width / (self.board_size - 1)
        cell_height = play_height / (self.board_size - 1)

        # Log for debugging
        logger.info(
            f"Board: {width}x{height}, margin: {margin_x}, cell: {cell_width:.1f}x{cell_height:.1f}"
        )

        # DEBUG: Save the warped board with grid overlay
        try:
            debug_img = board_image.copy()
            for i in range(self.board_size):
                x = int(margin_x + i * cell_width)
                y = int(margin_y + i * cell_height)
                cv2.line(debug_img, (x, 0), (x, height), (0, 255, 0), 1)
                cv2.line(debug_img, (0, y), (width, y), (0, 255, 0), 1)
            cv2.imwrite("debug_board.jpg", debug_img)
            logger.info("Saved debug board with grid overlay")
        except Exception as e:
            logger.warning(f"Could not save debug image: {e}")

        cells = []
        for row in range(self.board_size):
            row_cells = []
            for col in range(self.board_size):
                # Calculate intersection point
                center_x = int(margin_x + col * cell_width)
                center_y = int(margin_y + row * cell_height)

                # Extract a region around the intersection point
                stone_radius = int(min(cell_width, cell_height) * 0.45)
                y1 = max(0, center_y - stone_radius)
                y2 = min(height, center_y + stone_radius)
                x1 = max(0, center_x - stone_radius)
                x2 = min(width, center_x + stone_radius)

                cell = board_image[y1:y2, x1:x2]
                row_cells.append(cell)
            cells.append(row_cells)

        return cells
