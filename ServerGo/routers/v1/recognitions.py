"""
V1 Recognitions Router
Handles Board Recognition requests.
"""

import logging
import base64
import numpy as np
import cv2

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends

from middleware.auth import verify_api_key
from services.board_detector import BoardDetector
from services.stone_classifier import StoneClassifier, board_to_sgf
from schemas.v1 import (
    RecognitionResponse,
    RecognitionData,
    CornersResponse,
    CornersData,
)
from core.image_utils import decode_image
from services.recognition_provider import get_universal_recognizer, UNIVERSAL_AVAILABLE

# Import board_to_sgf from ML module if available
if UNIVERSAL_AVAILABLE:
    from services.universal_go_recognizer import board_to_sgf as ml_board_to_sgf
else:
    ml_board_to_sgf = board_to_sgf  # type: ignore

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=RecognitionResponse)
async def recognize_board(
    image: UploadFile = File(..., description="Go board image"),
    board_size: int = Query(19, ge=9, le=19),
    use_ml: bool = Query(True),
    api_key: str = Depends(verify_api_key),
):
    """
    Recognize a Go board from an image.
    """
    cv_image = await decode_image(image)

    # Try ML
    universal = get_universal_recognizer()
    if use_ml and universal and universal.is_available():
        try:
            warped, board, corners = universal.recognize_board(cv_image)
            if board is not None:
                sgf = ml_board_to_sgf(board, board_size)

                # Simple confidence metric
                black = sum(r.count(1) for r in board)
                white = sum(r.count(2) for r in board)
                conf = (
                    min(1.0, 0.8 + ((black + white) / 100) * 0.2)
                    if (black + white) > 0
                    else 0.6
                )

                return RecognitionResponse(
                    data=RecognitionData(
                        sgf=sgf,
                        boardSize=board_size,
                        confidence=conf,
                        blackStones=black,
                        whiteStones=white,
                        method="universal",
                        board=board,
                        corners=corners,
                        warpedImageBase64=None,
                    )
                )
        except Exception as e:
            logger.warning(f"ML recognition failed: {e}")

    # Fallback OpenCV
    detector = BoardDetector(board_size=board_size)
    warped = detector.detect_board(cv_image)
    if warped is None:
        raise HTTPException(status_code=422, detail="Board detection failed")

    cells = detector.extract_grid_cells(warped)
    classifier = StoneClassifier()
    board = classifier.classify_board(cells)
    sgf = board_to_sgf(board, board_size)

    return RecognitionResponse(
        data=RecognitionData(
            sgf=sgf,
            boardSize=board_size,
            confidence=0.5,
            blackStones=sum(r.count(1) for r in board),
            whiteStones=sum(r.count(2) for r in board),
            method="opencv",
            board=board,
            warpedImageBase64=None,
        )
    )


@router.post("/corners", response_model=CornersResponse)
async def detect_corners_only(
    image: UploadFile = File(...), api_key: str = Depends(verify_api_key)
):
    """Return recognized corners for manual adjustment."""
    cv_image = await decode_image(image)
    h, w = cv_image.shape[:2]

    universal = get_universal_recognizer()
    corners = None
    if universal and universal.is_available():
        corners = universal.detect_corners(cv_image)

    if corners is None:
        # Default fallback corners
        corners = np.array(
            [[50, 50], [w - 50, 50], [w - 50, h - 50], [50, h - 50]], dtype=np.float32
        )
    else:
        # Ensure corners is numpy array with correct dtype
        if not isinstance(corners, np.ndarray):
            corners = np.array(corners, dtype=np.float32)
        corners = corners.astype(np.float32)

    # Generate preview
    preview = cv_image.copy()
    max_dim = max(preview.shape[:2])
    scale = 800 / max_dim if max_dim > 800 else 1.0
    if scale < 1.0:
        preview = cv2.resize(preview, None, fx=scale, fy=scale)

    preview_corners = (corners * scale).astype(np.int32)
    # Reshape to required format for polylines: (1, n_points, 2)
    preview_corners = preview_corners.reshape((-1, 1, 2))
    cv2.polylines(preview, [preview_corners], True, (0, 255, 0), 3)

    _, buf = cv2.imencode(".jpg", preview, [cv2.IMWRITE_JPEG_QUALITY, 80])
    b64 = base64.b64encode(buf.tobytes()).decode("utf-8")

    return CornersResponse(
        data=CornersData(
            corners=corners.tolist(), imageWidth=w, imageHeight=h, previewBase64=b64
        )
    )


@router.post("/classify", response_model=RecognitionResponse)
async def classify_with_corners(
    image: UploadFile = File(..., description="Go board image"),
    corners: str = Query(
        ..., description="JSON array of 4 corner coordinates [[x,y],...]"
    ),
    board_size: int = Query(19, ge=9, le=19),
    api_key: str = Depends(verify_api_key),
):
    """
    Classify stones using user-provided corners (Step 2 of manual recognition).
    Corners should be in order: top-left, top-right, bottom-right, bottom-left.
    """
    import json

    try:
        corner_points = json.loads(corners)
        if len(corner_points) != 4:
            raise HTTPException(status_code=400, detail="Exactly 4 corners required")
        corner_array = np.array(corner_points, dtype=np.float32)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid corners JSON format")

    cv_image = await decode_image(image)
    h, w = cv_image.shape[:2]

    # Warp image using provided corners
    # Use 608x608 with 16px margin to match UniversalGoRecognizer standard
    output_size = 608
    margin = 16
    dst_corners = np.array(
        [
            [margin, margin],
            [output_size - 1 - margin, margin],
            [output_size - 1 - margin, output_size - 1 - margin],
            [margin, output_size - 1 - margin],
        ],
        dtype=np.float32,
    )

    M = cv2.getPerspectiveTransform(corner_array, dst_corners)
    warped = cv2.warpPerspective(cv_image, M, (output_size, output_size))

    # Use UniversalGoRecognizer's classifier (includes ResNet9 if available)
    universal = get_universal_recognizer()
    board = None
    method = "opencv"

    if universal and universal.is_available() and universal.classifier_instance:
        try:
            logger.info("Using ResNet9 CNN classifier via UniversalGoRecognizer")
            board = universal.classifier_instance.classify(warped, margin=margin)
            method = "resnet9"
        except Exception as e:
            logger.warning(f"ML classification failed: {e}")

    # Fallback to OpenCV-based classifier
    if board is None:
        logger.info("Falling back to OpenCV classifier")
        detector = BoardDetector(board_size=board_size)
        cells = detector.extract_grid_cells(warped)
        opencv_classifier = StoneClassifier()
        board = opencv_classifier.classify_board(cells)
        method = "opencv"

    sgf = board_to_sgf(board, board_size)

    # Encode warped image for frontend editing
    _, buf = cv2.imencode(".jpg", warped, [cv2.IMWRITE_JPEG_QUALITY, 85])
    warped_b64 = base64.b64encode(buf.tobytes()).decode("utf-8")

    return RecognitionResponse(
        data=RecognitionData(
            sgf=sgf,
            boardSize=board_size,
            confidence=0.8 if method == "resnet9" else 0.5,
            blackStones=sum(r.count(1) for r in board),
            whiteStones=sum(r.count(2) for r in board),
            method=method,
            board=board,
            warpedImageBase64=warped_b64,
        )
    )
