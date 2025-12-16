"""
Stone classifier module for Go board recognition.
Supports CNN (ResNet9), Adaptive K-Means, and Heuristic classification.
"""

import cv2
import numpy as np
import torch
from torchvision import transforms
from typing import List, Dict
import logging
from ..config import RecognitionConfig

logger = logging.getLogger(__name__)


class StoneClassifier:
    """Classifies stones on a warped Go board image."""

    def __init__(self, model=None, device=None, board_size: int = 19):
        self.model = model
        self.device = device or torch.device("cpu")
        self.board_size = board_size
        self.transform = None

        if model is not None:
            self.transform = transforms.Compose(
                [
                    transforms.ToPILImage(),
                    transforms.Resize(RecognitionConfig.TARGET_SIZE),
                    transforms.ToTensor(),
                    transforms.Normalize(
                        RecognitionConfig.NORMALIZATION_MEAN,
                        RecognitionConfig.NORMALIZATION_STD,
                    ),
                ]
            )

    def classify(self, warped_image: np.ndarray, margin: int = 0) -> List[List[int]]:
        """
        Classify stones on warped board image.

        Tries CNN first, falls back to adaptive K-means, then heuristic.

        Args:
            warped_image: Warped board image (BGR)
            margin: Margin around the board grid

        Returns:
            19x19 board state (0=empty, 1=black, 2=white)
        """
        if self.model is not None:
            try:
                logger.info("TRACE: Attempting CNN classification...")
                result = self._classify_cnn(warped_image, margin)
                black = sum(row.count(1) for row in result)
                white = sum(row.count(2) for row in result)
                logger.info(f"TRACE: CNN Success. B={black}, W={white}")
                return result
            except Exception as e:
                logger.error(f"CNN classification failed: {e}", exc_info=True)
                logger.info("TRACE: Falling back to Adaptive/Heuristic")
        else:
            logger.info("TRACE: Classifier is None! Skipping CNN.")

        try:
            return self._classify_adaptive(warped_image, margin)
        except Exception as e:
            logger.error(f"Adaptive failed: {e}")
            return self._classify_heuristic(warped_image, margin)

    def _classify_cnn(
        self, warped_image: np.ndarray, margin: int = 0
    ) -> List[List[int]]:
        """CNN-based classification using ResNet9."""
        h, w = warped_image.shape[:2]
        board_w = w - 2 * margin
        cell_size = board_w / (self.board_size - 1)

        patches = []
        coords = []
        target_w, target_h = RecognitionConfig.TARGET_SIZE
        half_w = target_w // 2
        half_h = target_h // 2

        for row in range(self.board_size):
            for col in range(self.board_size):
                cx = int(margin + col * cell_size)
                cy = int(margin + row * cell_size)

                y1, y2 = cy - half_h, cy + half_h
                x1, x2 = cx - half_w, cx + half_w

                if y1 < 0 or x1 < 0 or y2 > h or x2 > w:
                    pad = RecognitionConfig.PATCH_PADDING
                    padded = cv2.copyMakeBorder(
                        warped_image, pad, pad, pad, pad, cv2.BORDER_REPLICATE
                    )
                    px, py = cx + pad, cy + pad
                    patch = padded[py - half_h : py + half_h, px - half_w : px + half_w]
                else:
                    patch = warped_image[y1:y2, x1:x2]

                if patch.shape[:2] != RecognitionConfig.TARGET_SIZE:
                    patch = cv2.resize(patch, RecognitionConfig.TARGET_SIZE)

                patch_rgb = cv2.cvtColor(patch, cv2.COLOR_BGR2RGB)
                if self.transform:
                    tensor = self.transform(patch_rgb)
                    patches.append(tensor)
                    coords.append((row, col))

        if not patches:
            return [[0] * 19 for _ in range(19)]

        batch = torch.stack(patches).to(self.device)
        self.model.eval()
        with torch.no_grad():
            outputs = self.model(batch)
            _, preds = torch.max(outputs, 1)

        board = [[0] * 19 for _ in range(19)]
        preds_np = preds.cpu().numpy()

        # Mapping: 0=Black, 1=Empty, 2=White -> System: 1=Black, 0=Empty, 2=White
        mapping = {0: 1, 1: 0, 2: 2}

        for i, (r, c) in enumerate(coords):
            board[r][c] = mapping.get(int(preds_np[i]), 0)

        return board

    def _classify_adaptive(
        self, warped_image: np.ndarray, margin: int = 0
    ) -> List[List[int]]:
        """Adaptive K-Means classification with safety overrides."""
        h, w = warped_image.shape[:2]
        board_w = w - 2 * margin
        cell_size = board_w / (self.board_size - 1)
        radius = int(cell_size * RecognitionConfig.RADIUS_RATIO)

        samples = []
        coords = []

        for row in range(self.board_size):
            for col in range(self.board_size):
                cx = int(margin + col * cell_size)
                cy = int(margin + row * cell_size)

                if 0 <= cx < w and 0 <= cy < h:
                    y1, y2 = max(0, cy - radius), min(h, cy + radius)
                    x1, x2 = max(0, cx - radius), min(w, cx + radius)
                    patch = warped_image[y1:y2, x1:x2]

                    if patch.size > 0:
                        mean_bgr = cv2.mean(patch)[:3]
                        lum = (
                            0.299 * mean_bgr[2]
                            + 0.587 * mean_bgr[1]
                            + 0.114 * mean_bgr[0]
                        )
                        c_max, c_min = max(mean_bgr), min(mean_bgr)
                        sat = (c_max - c_min) / c_max if c_max > 0 else 0
                        samples.append([lum, sat * 255])
                        coords.append((row, col))

        if len(samples) < RecognitionConfig.KMEANS_CLUSTERS:
            return [[0] * 19 for _ in range(19)]

        # K-Means
        data = np.array(samples, dtype=np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        data = np.array(samples, dtype=np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        # Type ignore for legacy cv2 stub issues with None
        _, labels, centers = cv2.kmeans(
            data,
            RecognitionConfig.KMEANS_CLUSTERS,
            None,
            criteria,
            10,
            cv2.KMEANS_PP_CENTERS,
        )  # type: ignore

        cluster_props = []
        for i, center in enumerate(centers):
            lum, sat_scaled = center
            cluster_props.append({"id": i, "lum": lum, "sat": sat_scaled / 255.0})

        sorted_by_sat = sorted(cluster_props, key=lambda x: x["sat"])

        # Find largest jump in saturation to split stone/board groups
        sats = [c["sat"] for c in sorted_by_sat]
        diffs = np.diff(sats)
        max_diff_idx = np.argmax(diffs)

        stones_group = sorted_by_sat[: max_diff_idx + 1]
        board_group = sorted_by_sat[max_diff_idx + 1 :]

        cluster_map: Dict[int, int] = {}
        for c in board_group:
            cluster_map[c["id"]] = 0

        stones_sorted_lum = sorted(stones_group, key=lambda x: x["lum"])

        if not stones_sorted_lum:
            pass
        elif len(stones_sorted_lum) == 1:
            c = stones_sorted_lum[0]
            cluster_map[c["id"]] = 2 if c["lum"] > RecognitionConfig.LUM_MIDPOINT else 1
        else:
            cluster_map[stones_sorted_lum[0]["id"]] = 1  # Darkest = Black
            cluster_map[stones_sorted_lum[-1]["id"]] = 2  # Brightest = White

            for mid in stones_sorted_lum[1:-1]:
                d_black = abs(mid["lum"] - stones_sorted_lum[0]["lum"])
                d_white = abs(mid["lum"] - stones_sorted_lum[-1]["lum"])

                if mid["lum"] > RecognitionConfig.LUM_WHITE_MIN:
                    cluster_map[mid["id"]] = 2
                elif mid["lum"] < RecognitionConfig.LUM_BLACK_MAX:
                    cluster_map[mid["id"]] = 1
                else:
                    cluster_map[mid["id"]] = 1 if d_black < d_white else 2

        # Safety override for dark board clusters
        for c_id in list(cluster_map.keys()):
            if cluster_map[c_id] == 0:
                props = next(p for p in cluster_props if p["id"] == c_id)
                if (
                    props["lum"] < RecognitionConfig.SAFETY_LUM_MAX
                    and props["sat"] < RecognitionConfig.SAFETY_SAT_MAX
                ):
                    logger.info(f"  Override Cluster {c_id} -> Black (Safety)")
                    cluster_map[c_id] = 1

        result_board: List[List[int]] = [[0] * 19 for _ in range(19)]
        labels_flat = labels.flatten()
        for i, (row, col) in enumerate(coords):
            val = cluster_map[labels_flat[i]]
            result_board[row][col] = val

        return result_board

    def _classify_heuristic(
        self, warped_image: np.ndarray, margin: int = 0
    ) -> List[List[int]]:
        """Simple HSV-based heuristic classification."""
        h, w = warped_image.shape[:2]
        board_w = w - 2 * margin
        cell_size = board_w / (self.board_size - 1)
        stone_radius = int(cell_size * RecognitionConfig.RADIUS_RATIO)
        board = [[0] * 19 for _ in range(19)]
        hsv = cv2.cvtColor(warped_image, cv2.COLOR_BGR2HSV)

        for row in range(self.board_size):
            for col in range(self.board_size):
                cx = int(margin + col * cell_size)
                cy = int(margin + row * cell_size)
                y1, y2 = max(0, cy - stone_radius), min(h, cy + stone_radius)
                x1, x2 = max(0, cx - stone_radius), min(w, cx + stone_radius)
                patch_bgr = warped_image[y1:y2, x1:x2]
                patch_hsv = hsv[y1:y2, x1:x2]
                if patch_bgr.size == 0:
                    continue

                mean_s = np.mean(patch_hsv[:, :, 1])
                mean_bgr = cv2.mean(patch_bgr)[:3]
                mean_brightness = sum(mean_bgr) / 3

                if mean_s > RecognitionConfig.HEURISTIC_SAT_THRESHOLD:
                    board[row][col] = 0
                else:
                    board[row][col] = (
                        2
                        if mean_brightness > RecognitionConfig.HEURISTIC_LUM_WHITE
                        else 1
                    )

        return board
