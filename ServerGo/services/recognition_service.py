"""
Recognition Service - Async wrapper for board recognition.
Used by both FastAPI routers and serverless handler.
"""

import asyncio
import logging
import base64
import cv2
import numpy as np
from typing import Optional, List
from dataclasses import dataclass

from services.universal_go_recognizer import UniversalGoRecognizer, board_to_sgf

logger = logging.getLogger(__name__)


@dataclass
class RecognitionResult:
    """Result of board recognition."""

    board: List[List[int]]
    sgf: str
    corners: List[List[float]]
    warped_base64: Optional[str] = None


class RecognitionService:
    """Async service for Go board recognition."""

    def __init__(self):
        self._recognizer: Optional[UniversalGoRecognizer] = None
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize the recognition models."""
        if self._initialized:
            return

        loop = asyncio.get_event_loop()
        self._recognizer = await loop.run_in_executor(None, UniversalGoRecognizer)
        self._initialized = True
        logger.info("Recognition service initialized")

    def is_available(self) -> bool:
        """Check if recognition models are loaded."""
        return self._recognizer is not None and self._recognizer.is_available()

    async def detect_corners(self, image_bytes: bytes) -> Optional[List[List[float]]]:
        """
        Detect board corners from image bytes.

        Args:
            image_bytes: Raw image bytes (JPEG/PNG)

        Returns:
            List of 4 corner points [[x,y], ...] or None
        """
        if not self.is_available():
            raise RuntimeError("Recognition models not loaded")
        assert self._recognizer is not None

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Failed to decode image")

        loop = asyncio.get_event_loop()
        corners = await loop.run_in_executor(
            None, self._recognizer.detect_corners, image
        )

        if corners is None:
            return None

        return corners.tolist()  # type: ignore

    async def classify_from_corners(
        self, image_bytes: bytes, corners: List[List[float]], board_size: int = 19
    ) -> RecognitionResult:
        """
        Classify stones given corner points.

        Args:
            image_bytes: Raw image bytes
            corners: 4 corner points [[x,y], ...]
            board_size: Board size (9, 13, or 19)

        Returns:
            RecognitionResult with board state and SGF
        """
        if not self.is_available():
            raise RuntimeError("Recognition models not loaded")
        assert self._recognizer is not None

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Failed to decode image")

        corners_np = np.array(corners, dtype=np.float32)

        loop = asyncio.get_event_loop()
        board, warped = await loop.run_in_executor(
            None, self._recognizer.classify_from_corners, image, corners_np
        )

        # Encode warped image
        warped_base64 = None
        if warped is not None:
            _, buffer = cv2.imencode(".jpg", warped, [cv2.IMWRITE_JPEG_QUALITY, 85])
            warped_base64 = base64.b64encode(buffer.tobytes()).decode("utf-8")

        # Generate SGF
        sgf = board_to_sgf(board, board_size)

        return RecognitionResult(
            board=board, sgf=sgf, corners=corners, warped_base64=warped_base64
        )

    async def full_recognition(
        self, image_bytes: bytes, board_size: int = 19
    ) -> Optional[RecognitionResult]:
        """
        Full recognition pipeline: detect corners + classify.

        Args:
            image_bytes: Raw image bytes
            board_size: Board size

        Returns:
            RecognitionResult or None if detection failed
        """
        corners = await self.detect_corners(image_bytes)
        if corners is None:
            return None

        return await self.classify_from_corners(image_bytes, corners, board_size)


# Singleton instance
_recognition_service: Optional[RecognitionService] = None


def get_recognition_service() -> RecognitionService:
    """Get the singleton recognition service instance."""
    global _recognition_service
    if _recognition_service is None:
        _recognition_service = RecognitionService()
    return _recognition_service
