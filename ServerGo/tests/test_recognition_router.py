import io
import pytest

pytest.importorskip("fastapi", reason="FastAPI not installed")
pytest.importorskip("cv2", reason="OpenCV not installed")

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from unittest.mock import MagicMock, patch  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from middleware.auth import verify_api_key  # noqa: E402


# Setup auth override at module level
@pytest.fixture(scope="module", autouse=True)
def setup_auth():
    """Setup auth override for this test module."""
    app.dependency_overrides[verify_api_key] = lambda: "valid-key"
    yield
    # Cleanup
    if verify_api_key in app.dependency_overrides:
        del app.dependency_overrides[verify_api_key]


@pytest.fixture(scope="module")
def test_client():
    """Test client with auth override."""
    return TestClient(app)


def create_valid_image():
    # 100x100 green image
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img[:] = (0, 255, 0)
    _, buf = cv2.imencode(".jpg", img)
    return io.BytesIO(buf.tobytes())


@patch("routers.v1.recognitions.get_universal_recognizer")
def test_detect_corners_success(mock_get_recognizer, test_client):
    # Mock Service
    mock_service = MagicMock()
    mock_service.is_available.return_value = True
    # Return 4 corners as numpy array
    corners_array = np.array(
        [[10.0, 10.0], [90.0, 10.0], [90.0, 90.0], [10.0, 90.0]], dtype=np.float32
    )
    mock_service.detect_corners.return_value = corners_array
    mock_get_recognizer.return_value = mock_service

    files = {"image": ("test.jpg", create_valid_image(), "image/jpeg")}

    response = test_client.post(
        "/v1/recognitions/corners", files=files, params={"api_key": "test_key"}
    )

    if response.status_code != 200:
        print(f"Corner Detect Failed: {response.text}")

    assert response.status_code == 200
    json_resp = response.json()
    assert "data" in json_resp
    data = json_resp["data"]

    assert "corners" in data
    assert (
        len(data["corners"]) == 4
    ), f"Expected 4 corners, got {len(data['corners'])}: {data['corners']}"
    assert "previewBase64" in data
    assert "imageWidth" in data
    assert data["imageWidth"] == 100
