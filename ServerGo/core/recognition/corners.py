"""
Corner detection module for Go board recognition.
Handles Hough lines, contour detection, and corner ordering.
"""

import cv2
import numpy as np
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def intersect_lines(rho1, theta1, rho2, theta2):
    """Find intersection point of two lines in polar coordinates."""
    A = np.array([[np.cos(theta1), np.sin(theta1)], [np.cos(theta2), np.sin(theta2)]])
    b = np.array([[rho1], [rho2]])
    try:
        x0, y0 = np.linalg.solve(A, b)
        return [x0[0], y0[0]]
    except Exception:
        return None


def order_corners(pts: np.ndarray) -> np.ndarray:
    """
    Order corners in consistent order using centroid-angle sorting.

    Args:
        pts: 4x2 array of corner points

    Returns:
        Ordered 4x2 array (top-left first, clockwise)
    """
    center = np.mean(pts, axis=0)

    def get_angle(pt):
        return np.arctan2(pt[1] - center[1], pt[0] - center[0])

    sorted_pts = sorted(pts, key=get_angle)
    return np.array(sorted_pts, dtype=np.float32)


def find_corners(mask: np.ndarray) -> Optional[np.ndarray]:
    """
    Find 4 corner points of the Go board from a binary mask.

    Uses Hough lines first, falls back to contour detection.

    Args:
        mask: Binary mask (0/255)

    Returns:
        4x2 array of corner points, or None
    """
    # 1. Hough Lines
    try:
        edges = cv2.Canny(mask, 50, 150)
        lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=50)

        if lines is not None:
            strong_lines: list[tuple[float, float]] = []
            for line in lines:
                rho, theta = line[0]
                is_new = True
                for r2, t2 in strong_lines:
                    if abs(rho - r2) < 30 and (
                        abs(theta - t2) < 0.2 or abs(abs(theta - t2) - np.pi) < 0.2
                    ):
                        is_new = False
                        break
                if is_new:
                    strong_lines.append((rho, theta))
                    if len(strong_lines) >= 4:
                        break

            if len(strong_lines) >= 4:
                intersections = []
                for i in range(len(strong_lines)):
                    for j in range(i + 1, len(strong_lines)):
                        rho1, theta1 = strong_lines[i]
                        rho2, theta2 = strong_lines[j]
                        angle_diff = abs(theta1 - theta2)
                        angle_diff = min(angle_diff, abs(angle_diff - np.pi))
                        if angle_diff > 0.2:
                            pt = intersect_lines(rho1, theta1, rho2, theta2)
                            if pt:
                                h, w = mask.shape
                                if -100 < pt[0] < w + 100 and -100 < pt[1] < h + 100:
                                    intersections.append(pt)
                pts = np.array(intersections, dtype=np.float32)
                if len(pts) >= 4:
                    hull = cv2.convexHull(pts)
                    peri = cv2.arcLength(hull, True)
                    approx = cv2.approxPolyDP(hull, 0.02 * peri, True)
                    if len(approx) == 4:
                        return order_corners(approx.reshape(4, 2))
    except Exception as e:
        logger.warning(f"Hough failed: {e}")

    # 2. Contour Fallback
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    peri = cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, 0.02 * peri, True)
    if len(approx) == 4:
        return order_corners(approx.reshape(4, 2))
    rect = cv2.minAreaRect(largest)
    box = cv2.boxPoints(rect)
    return order_corners(box)
