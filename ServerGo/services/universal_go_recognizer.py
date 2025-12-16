import cv2
import numpy as np
import logging
from pathlib import Path
from typing import Optional, Tuple, List
import torch
import torch.nn as nn

from torchvision.models.segmentation import deeplabv3_resnet50

from core.recognition.classifier import StoneClassifier
from core.recognition.models import ResNet9
from core.recognition.segmentation import predict_mask, cleanup_mask

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UniversalGoRecognizer:
    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.board_size = 19
        self.model: Optional[nn.Module] = None
        self.classifier: Optional[nn.Module] = None
        self.classifier_instance: Optional[StoneClassifier] = None
        self._load_models()

    def _load_models(self) -> None:
        # 1. Segmentation Model (DeepLabV3+ ResNet50)
        try:
            model_path = Path(__file__).parent.parent / "ml" / "deeplab_resnet50.pth"
            model = deeplabv3_resnet50(weights=None, num_classes=21, aux_loss=True)
            model.classifier[4] = nn.Conv2d(256, 1, kernel_size=(1, 1), stride=(1, 1))
            if model.aux_classifier is not None:
                model.aux_classifier[4] = nn.Conv2d(
                    256, 1, kernel_size=(1, 1), stride=(1, 1)
                )

            self.model = model

            if model_path.exists():
                state = torch.load(model_path, map_location=self.device)
                self.model.load_state_dict(state)
                self.model.to(self.device).eval()
                logger.info(f"Loaded segmentation model from {model_path}")
            else:
                logger.warning(f"Segmentation model not found at {model_path}")
                self.model = None
        except Exception as e:
            logger.error(f"Failed to load segmentation model: {e}")
            self.model = None

        # 2. Stone Classifier (ResNet9)
        try:
            finetuned_path = (
                Path(__file__).parent.parent / "ml" / "stone_classifier_finetuned.pth"
            )
            base_path = Path(__file__).parent.parent / "ml" / "stone_classifier.pth"

            cls_path = None
            if finetuned_path.exists():
                cls_path = finetuned_path
            elif base_path.exists():
                cls_path = base_path

            if cls_path:
                self.classifier = ResNet9(3, 3)
                self.classifier.load_state_dict(
                    torch.load(cls_path, map_location=self.device)
                )
                self.classifier.to(self.device).eval()
                logger.info(f"Loaded classifier from {cls_path}")
            else:
                logger.warning("Stone classifier not found, using heuristics")
                self.classifier = None
        except Exception as e:
            logger.error(f"Failed to load classifier: {e}")
            self.classifier = None

        # Initialize shared StoneClassifier
        self.classifier_instance = StoneClassifier(
            model=self.classifier, device=self.device, board_size=self.board_size
        )

        if self.model is not None and self.classifier is not None:
            logger.info(
                "Universal Go Models loaded successfully (Segmentation + ResNet9)"
            )

    def is_available(self) -> bool:
        return self.model is not None

    def _intersect_lines(
        self, rho1: float, theta1: float, rho2: float, theta2: float
    ) -> Optional[List[float]]:
        A = np.array(
            [[np.cos(theta1), np.sin(theta1)], [np.cos(theta2), np.sin(theta2)]]
        )
        b = np.array([[rho1], [rho2]])
        try:
            x0, y0 = np.linalg.solve(A, b)
            return [x0[0], y0[0]]
        except Exception:
            return None

    def _find_corners(self, mask: np.ndarray) -> Optional[np.ndarray]:
        # 1. Hough Lines
        try:
            edges = cv2.Canny(mask, 50, 150)
            lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=50)

            if lines is not None:
                strong_lines: List[Tuple[float, float]] = []
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
                                pt = self._intersect_lines(rho1, theta1, rho2, theta2)
                                if pt:
                                    h, w = mask.shape
                                    if (
                                        -100 < pt[0] < w + 100
                                        and -100 < pt[1] < h + 100
                                    ):
                                        intersections.append(pt)
                    pts = np.array(intersections, dtype=np.float32)
                    if len(pts) >= 4:
                        hull = cv2.convexHull(pts)
                        peri = cv2.arcLength(hull, True)
                        approx = cv2.approxPolyDP(hull, 0.02 * peri, True)
                        if len(approx) == 4:
                            return self._order_corners(approx.reshape(4, 2))
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
            return self._order_corners(approx.reshape(4, 2))
        rect = cv2.minAreaRect(largest)
        box = cv2.boxPoints(rect)
        return self._order_corners(box)

    def _order_corners(self, pts: np.ndarray) -> np.ndarray:
        # Centroid-Angle Ordering
        center = np.mean(pts, axis=0)

        def get_angle(pt):
            return np.arctan2(pt[1] - center[1], pt[0] - center[0])

        sorted_pts = sorted(pts, key=get_angle)
        return np.array(sorted_pts, dtype=np.float32)

    def _warp_board(
        self,
        image: np.ndarray,
        corners: np.ndarray,
        output_size: int = 600,
        margin: int = 20,
    ) -> np.ndarray:
        """Warp board to square image."""
        if corners is None or len(corners) != 4:
            # Return dummy black image if failed? Or raise? Use safe fallback.
            return np.zeros((output_size, output_size, 3), dtype=np.uint8)

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

    def detect_corners(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Public API: Detect grid corners in an image.
        Returns: 4x2 numpy array of corners [[x,y],...], or None if failed.
        """
        if self.model is None:
            return None

        # Resize for consistent processing (matches training resolution ~800px)
        h, w = image.shape[:2]
        inference_size = 800

        img_resized = cv2.resize(image, (inference_size, inference_size))
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)

        if self.model is None:
            return None

        # Predict Mask
        mask_small = predict_mask(self.model, img_rgb, self.device)
        mask_clean = cleanup_mask(mask_small, (inference_size, inference_size))

        # Find Corners on 800x800
        corners_800 = self._find_corners(mask_clean)

        if corners_800 is None:
            return None

        # Scale corners back to original image size
        scale_x = w / inference_size
        scale_y = h / inference_size

        corners_original = corners_800.copy()
        corners_original[:, 0] *= scale_x
        corners_original[:, 1] *= scale_y

        return corners_original

    def classify_from_corners(
        self, image: np.ndarray, corners: np.ndarray
    ) -> Tuple[List[List[int]], np.ndarray]:
        """
        Public API: Classify stones given specified corners.
        Returns: (board_state, warped_image)
        """
        # Warp board using provided corners
        # Use 608x608 with 16px margin (Standard for this system)
        output_size = 608
        margin = 16

        # image is BGR, _warp_board returns BGR
        warped = self._warp_board(
            image, corners, output_size=output_size, margin=margin
        )

        # Classify (Expects BGR if using adaptive/heuristic, or RGB if using CNN?
        # _classify_stones dispatch logic handles it. _classify_stones_adaptive expects BGR.)
        board = self._classify_stones(warped, margin=margin)

        return board, warped

    def recognize_board(
        self, image: np.ndarray
    ) -> Tuple[
        Optional[np.ndarray], Optional[List[List[int]]], Optional[List[List[float]]]
    ]:
        """Wrapper for full pipeline: Detect -> Warp -> Classify."""
        if not self.is_available():
            return None, None, None
        try:
            corners = self.detect_corners(image)
            if corners is None:
                return None, None, None

            board, warped = self.classify_from_corners(image, corners)

            return warped, board, corners.tolist()
        except Exception as e:
            logger.error(f"Recognition failed: {e}")
            return None, None, None

    def _classify_stones(
        self, warped_image: np.ndarray, margin: int = 0
    ) -> List[List[int]]:
        """Delegates to StoneClassifier."""
        if self.classifier_instance:
            return self.classifier_instance.classify(warped_image, margin)
        # Fallback if classifier instance missing (shouldn't happen if initialized correctly)
        return [[0] * 19 for _ in range(19)]


def board_to_sgf(board: Optional[List[List[int]]], board_size: int = 19) -> str:
    if board is None:
        return ""
    black_stones = []
    white_stones = []
    for row in range(board_size):
        for col in range(board_size):
            if row < len(board) and col < len(board[row]):
                stone = board[row][col]
                coord = chr(ord("a") + col) + chr(ord("a") + row)
                if stone == 1:
                    black_stones.append(coord)
                elif stone == 2:
                    white_stones.append(coord)
    sgf = f"(;GM[1]FF[4]SZ[{board_size}]"
    if black_stones:
        sgf += "AB" + "".join(f"[{s}]" for s in black_stones)
    if white_stones:
        sgf += "AW" + "".join(f"[{s}]" for s in white_stones)
    sgf += ")"
    return sgf
