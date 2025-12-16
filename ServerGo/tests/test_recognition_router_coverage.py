import pytest
import numpy as np
import cv2
import json
from io import BytesIO
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from main import app
from middleware.auth import verify_api_key


# Use session-scoped fixture to set auth override once and preserve it
@pytest.fixture(scope="session", autouse=True)
def setup_auth_override():
    """Setup auth override for the entire test session."""

    def mock_verify_api_key():
        return "test-key"

    # Store original overrides
    original_overrides = app.dependency_overrides.copy()

    # Set our override
    app.dependency_overrides[verify_api_key] = mock_verify_api_key

    yield

    # Restore original overrides
    app.dependency_overrides.clear()
    app.dependency_overrides.update(original_overrides)


@pytest.fixture(scope="module")
def test_client():
    """Create test client."""

    # Re-apply auth override in case it was cleared
    def mock_verify_api_key():
        return "test-key"

    app.dependency_overrides[verify_api_key] = mock_verify_api_key
    return TestClient(app)


@pytest.fixture
def mock_image():
    """Create a mock image file."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    cv2.rectangle(img, (50, 50), (350, 350), (255, 255, 255), -1)
    _, buffer = cv2.imencode(".jpg", img)
    return BytesIO(buffer.tobytes())


def test_recognize_board_ml_success(test_client, mock_image):
    """Test recognition with ML (universal recognizer) succeeding."""
    with (
        patch("routers.v1.recognitions.get_universal_recognizer") as mock_get_univ,
        patch("routers.v1.recognitions.UNIVERSAL_AVAILABLE", True),
    ):
        mock_recognizer = MagicMock()
        mock_recognizer.is_available.return_value = True

        board = [[0] * 19 for _ in range(19)]
        board[3][3] = 1
        board[15][15] = 2
        corners = [[50, 50], [350, 50], [350, 350], [50, 350]]
        warped = np.zeros((608, 608, 3), dtype=np.uint8)

        mock_recognizer.recognize_board.return_value = (warped, board, corners)
        mock_get_univ.return_value = mock_recognizer

        response = test_client.post(
            "/v1/recognitions",
            files={"image": ("test.jpg", mock_image, "image/jpeg")},
            params={"use_ml": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["method"] == "universal"
        assert data["data"]["blackStones"] == 1
        assert data["data"]["whiteStones"] == 1


def test_recognize_board_ml_fails_fallback_opencv(test_client, mock_image):
    """Test ML failing, falling back to OpenCV."""
    with (
        patch("routers.v1.recognitions.get_universal_recognizer") as mock_get_univ,
        patch("routers.v1.recognitions.BoardDetector") as mock_detector_cls,
        patch("routers.v1.recognitions.StoneClassifier") as mock_classifier_cls,
    ):
        mock_recognizer = MagicMock()
        mock_recognizer.is_available.return_value = True
        mock_recognizer.recognize_board.side_effect = Exception("ML Error")
        mock_get_univ.return_value = mock_recognizer

        mock_detector = MagicMock()
        warped = np.zeros((608, 608, 3), dtype=np.uint8)
        mock_detector.detect_board.return_value = warped
        mock_detector.extract_grid_cells.return_value = [np.zeros((32, 32, 3))] * 361
        mock_detector_cls.return_value = mock_detector

        mock_classifier = MagicMock()
        board = [[0] * 19 for _ in range(19)]
        mock_classifier.classify_board.return_value = board
        mock_classifier_cls.return_value = mock_classifier

        response = test_client.post(
            "/v1/recognitions",
            files={"image": ("test.jpg", mock_image, "image/jpeg")},
            params={"use_ml": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["method"] == "opencv"


def test_recognize_board_detection_fails(test_client, mock_image):
    """Test board detection failure (422 error)."""
    with (
        patch("routers.v1.recognitions.get_universal_recognizer") as mock_get_univ,
        patch("routers.v1.recognitions.BoardDetector") as mock_detector_cls,
    ):
        mock_get_univ.return_value = None

        mock_detector = MagicMock()
        mock_detector.detect_board.return_value = None
        mock_detector_cls.return_value = mock_detector

        response = test_client.post(
            "/v1/recognitions",
            files={"image": ("test.jpg", mock_image, "image/jpeg")},
            params={"use_ml": False},
        )

        assert response.status_code == 422
        resp_data = response.json()
        assert "Board detection failed" in str(resp_data)


def test_detect_corners_only_ml_success(test_client, mock_image):
    """Test corners endpoint with ML."""
    with patch("routers.v1.recognitions.get_universal_recognizer") as mock_get_univ:
        mock_recognizer = MagicMock()
        mock_recognizer.is_available.return_value = True
        corners = np.array(
            [[50, 50], [350, 50], [350, 350], [50, 350]], dtype=np.float32
        )
        mock_recognizer.detect_corners.return_value = corners
        mock_get_univ.return_value = mock_recognizer

        response = test_client.post(
            "/v1/recognitions/corners",
            files={"image": ("test.jpg", mock_image, "image/jpeg")},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["corners"]) == 4
        assert "previewBase64" in data["data"]


def test_classify_with_corners_resnet9(test_client, mock_image):
    """Test classify endpoint with ResNet9 classifier."""
    corners_json = json.dumps([[50, 50], [350, 50], [350, 350], [50, 350]])

    with patch("routers.v1.recognitions.get_universal_recognizer") as mock_get_univ:
        mock_recognizer = MagicMock()
        mock_recognizer.is_available.return_value = True

        mock_classifier = MagicMock()
        board = [[0] * 19 for _ in range(19)]
        board[5][5] = 1
        mock_classifier.classify.return_value = board
        mock_recognizer.classifier_instance = mock_classifier
        mock_get_univ.return_value = mock_recognizer

        response = test_client.post(
            "/v1/recognitions/classify",
            files={"image": ("test.jpg", mock_image, "image/jpeg")},
            params={"corners": corners_json, "board_size": 19},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["method"] == "resnet9"
        assert data["data"]["blackStones"] == 1
        assert data["data"]["warpedImageBase64"] is not None


def test_classify_invalid_corners_json(test_client, mock_image):
    """Test classify with invalid JSON corners."""
    response = test_client.post(
        "/v1/recognitions/classify",
        files={"image": ("test.jpg", mock_image, "image/jpeg")},
        params={"corners": "invalid json", "board_size": 19},
    )

    assert response.status_code == 400
    resp_data = response.json()
    assert "Invalid corners JSON format" in str(resp_data)


def test_universal_available_import_branch():
    """Test the UNIVERSAL_AVAILABLE import branch."""
    from routers.v1.recognitions import ml_board_to_sgf

    assert callable(ml_board_to_sgf)
