import pytest
import numpy as np
import cv2
from unittest.mock import MagicMock, patch
from services.recognition_service import (
    RecognitionService,
    RecognitionResult,
    get_recognition_service,
)


@pytest.mark.asyncio
async def test_initialize():
    """Test service initialization."""
    service = RecognitionService()

    with patch("services.recognition_service.UniversalGoRecognizer") as mock_class:
        mock_instance = MagicMock()
        mock_class.return_value = mock_instance

        await service.initialize()

        assert service._initialized
        assert service._recognizer is not None


@pytest.mark.asyncio
async def test_initialize_idempotent():
    """Test that initialize can be called multiple times safely."""
    service = RecognitionService()
    service._initialized = True
    service._recognizer = MagicMock()

    original_recognizer = service._recognizer

    await service.initialize()

    # Should not reinitialize
    assert service._recognizer == original_recognizer


def test_is_available_true():
    """Test is_available when recognizer is loaded."""
    service = RecognitionService()
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = True
    service._recognizer = mock_recognizer

    assert service.is_available()


def test_is_available_false_no_recognizer():
    """Test is_available when recognizer is None."""
    service = RecognitionService()
    service._recognizer = None

    assert not service.is_available()


def test_is_available_false_not_available():
    """Test is_available when recognizer not available."""
    service = RecognitionService()
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = False
    service._recognizer = mock_recognizer

    assert not service.is_available()


@pytest.mark.asyncio
async def test_detect_corners_not_available():
    """Test detect_corners raises error when not available."""
    service = RecognitionService()
    service._recognizer = None

    with pytest.raises(RuntimeError, match="Recognition models not loaded"):
        await service.detect_corners(b"fake image")


@pytest.mark.asyncio
async def test_detect_corners_invalid_image():
    """Test detect_corners with invalid image data."""
    service = RecognitionService()
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = True
    service._recognizer = mock_recognizer

    with pytest.raises(ValueError, match="Failed to decode image"):
        await service.detect_corners(b"invalid")


@pytest.mark.asyncio
async def test_detect_corners_success():
    """Test successful corner detection."""
    service = RecognitionService()
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = True

    # Create valid image bytes
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".jpg", img)
    image_bytes = buffer.tobytes()

    corners_np = np.array(
        [[50, 50], [350, 50], [350, 350], [50, 350]], dtype=np.float32
    )
    mock_recognizer.detect_corners.return_value = corners_np
    service._recognizer = mock_recognizer

    result = await service.detect_corners(image_bytes)

    assert result is not None
    assert len(result) == 4
    assert result[0] == [50, 50]


@pytest.mark.asyncio
async def test_detect_corners_none():
    """Test detect_corners when detection fails."""
    service = RecognitionService()
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = True
    mock_recognizer.detect_corners.return_value = None
    service._recognizer = mock_recognizer

    img = np.zeros((400, 400, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".jpg", img)
    image_bytes = buffer.tobytes()

    result = await service.detect_corners(image_bytes)

    assert result is None


@pytest.mark.asyncio
async def test_classify_from_corners_not_available():
    """Test classify_from_corners raises error when not available."""
    service = RecognitionService()
    service._recognizer = None

    with pytest.raises(RuntimeError, match="Recognition models not loaded"):
        await service.classify_from_corners(
            b"fake", [[50, 50], [350, 50], [350, 350], [50, 350]]
        )


@pytest.mark.asyncio
async def test_classify_from_corners_success():
    """Test successful classification from corners."""
    service = RecognitionService()
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = True

    img = np.zeros((400, 400, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".jpg", img)
    image_bytes = buffer.tobytes()

    board = [[0] * 19 for _ in range(19)]
    board[3][3] = 1
    warped = np.zeros((608, 608, 3), dtype=np.uint8)

    mock_recognizer.classify_from_corners.return_value = (board, warped)
    service._recognizer = mock_recognizer

    corners = [[50, 50], [350, 50], [350, 350], [50, 350]]
    result = await service.classify_from_corners(image_bytes, corners)

    assert isinstance(result, RecognitionResult)
    assert result.board[3][3] == 1
    assert "AB[dd]" in result.sgf
    assert result.warped_base64 is not None


@pytest.mark.asyncio
async def test_full_recognition_success():
    """Test full recognition pipeline."""
    service = RecognitionService()
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = True

    img = np.zeros((400, 400, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".jpg", img)
    image_bytes = buffer.tobytes()

    corners_np = np.array(
        [[50, 50], [350, 50], [350, 350], [50, 350]], dtype=np.float32
    )
    mock_recognizer.detect_corners.return_value = corners_np

    board = [[0] * 19 for _ in range(19)]
    warped = np.zeros((608, 608, 3), dtype=np.uint8)
    mock_recognizer.classify_from_corners.return_value = (board, warped)

    service._recognizer = mock_recognizer

    result = await service.full_recognition(image_bytes)

    assert result is not None
    assert isinstance(result, RecognitionResult)


@pytest.mark.asyncio
async def test_full_recognition_no_corners():
    """Test full recognition when corner detection fails."""
    service = RecognitionService()
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = True
    mock_recognizer.detect_corners.return_value = None
    service._recognizer = mock_recognizer

    img = np.zeros((400, 400, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".jpg", img)
    image_bytes = buffer.tobytes()

    result = await service.full_recognition(image_bytes)

    assert result is None


def test_get_recognition_service_singleton():
    """Test get_recognition_service returns singleton."""
    service1 = get_recognition_service()
    service2 = get_recognition_service()

    assert service1 is service2
