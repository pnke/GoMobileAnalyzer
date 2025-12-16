"""
Perspective warp module for Go board recognition.
Handles homography transformation to create square board image.
"""

import cv2
import numpy as np
from typing import Optional


def warp_board(
    image: np.ndarray, corners: np.ndarray, output_size: int = 600, margin: int = 20
) -> Optional[np.ndarray]:
    """
    Warp board to a square image using perspective transform.

    Args:
        image: Source image (BGR)
        corners: 4x2 array of corner points
        output_size: Output image size (square)
        margin: Padding around the board grid

    Returns:
        Warped square image, or None if invalid corners
    """
    if corners is None or len(corners) != 4:
        return None

    pts1 = np.array(corners, dtype=np.float32)
    pts2 = np.array(
        [
            [margin, margin],
            [output_size - 1 - margin, margin],
            [output_size - 1 - margin, output_size - 1 - margin],
            [margin, output_size - 1 - margin],
        ],
        dtype=np.float32,
    )

    M = cv2.getPerspectiveTransform(pts1, pts2)
    dst = cv2.warpPerspective(image, M, (output_size, output_size))
    return dst
