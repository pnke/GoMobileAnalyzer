import pytest
import numpy as np
from unittest.mock import MagicMock, patch
from core.recognition.corners import find_corners, order_corners
from core.recognition.warp import warp_board
from core.recognition.classifier import StoneClassifier
import torch


@pytest.fixture
def mock_model():
    return MagicMock()


def test_find_corners_simple():
    # Create an image with a filled square representing board mask
    # 100x100
    mask = np.zeros((100, 100), dtype=np.uint8)
    # Draw filled square from (10,10) to (90,90)
    mask[10:90, 10:90] = 255

    corners = find_corners(mask)
    assert corners is not None
    # Should find 4 corners
    assert len(corners) == 4
    # Approximate locations
    corners = sorted(corners.tolist(), key=lambda p: (p[1], p[0]))
    # TL ~ (10, 10)
    assert 5 <= corners[0][0] <= 15
    assert 5 <= corners[0][1] <= 15


def test_find_corners_empty():
    mask = np.zeros((100, 100), dtype=np.uint8)
    corners = find_corners(mask)
    assert corners is None


def test_order_corners_logic():
    # Test checking if corners are ordered clockwise from top-left
    pts = np.array(
        [
            [100, 100],  # BR
            [0, 0],  # TL
            [0, 100],  # BL
            [100, 0],  # TR
        ],
        dtype=np.float32,
    )

    ordered = order_corners(pts)
    assert np.allclose(ordered[0], [0, 0])
    assert np.allclose(ordered[1], [100, 0])
    assert np.allclose(ordered[2], [100, 100])
    assert np.allclose(ordered[3], [0, 100])


def test_warp_board():
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img[10:90, 10:90] = 255  # White square in middle

    corners = np.array([[10, 10], [90, 10], [90, 90], [10, 90]], dtype=np.float32)

    # Warp to 200x200
    warped = warp_board(img, corners, output_size=200, margin=10)

    assert warped is not None
    assert warped.shape[0] == 200
    assert warped.shape[1] == 200
    assert warped.shape[2] == 3


@patch("torch.load")
def test_stone_classifier(mock_load):
    # Mock model
    mock_model = MagicMock()
    # Init classifier with mock model
    classifier = StoneClassifier(model=mock_model)
    assert classifier.model is not None

    # _classify_cnn takes an image (numpy array)
    img = np.zeros((800, 800, 3), dtype=np.uint8)

    # Mock output
    # batch size will depend on patches extracted.
    # 19x19 = 361 patches.
    mock_model.eval.return_value = None
    mock_model.return_value = torch.randn(361, 3)

    # We need to mock transforms too otherwise it tries to run real transforms
    classifier.transform = MagicMock(return_value=torch.randn(3, 32, 32))

    result = classifier._classify_cnn(img, margin=0)
    assert len(result) == 19
    assert len(result[0]) == 19
    mock_model.eval.assert_called()


def test_stone_classifier_fallback(mock_model):
    # Test fallback logic: CNN fail -> Adaptive
    classifier = StoneClassifier(model=mock_model)
    classifier._classify_cnn = MagicMock(side_effect=Exception("CNN Error"))
    classifier._classify_adaptive = MagicMock(return_value=[[1] * 19] * 19)

    res = classifier.classify(np.zeros((100, 100, 3), np.uint8))
    assert res[0][0] == 1
    classifier._classify_adaptive.assert_called_once()

    # Test fallback: CNN -> Adaptive Fail -> Heuristic
    classifier._classify_adaptive.side_effect = Exception("Adaptive Error")
    classifier._classify_heuristic = MagicMock(return_value=[[2] * 19] * 19)

    res = classifier.classify(np.zeros((100, 100, 3), np.uint8))
    assert res[0][0] == 2
    classifier._classify_heuristic.assert_called_once()


def test_heuristic_classification():
    # Test heuristic logic directly with dummy image
    classifier = StoneClassifier()
    # Heuristic uses HSV. Saturation > threshold -> empty (board).
    # Low Saturation + High Brightness -> White
    # Low Saturation + Low Brightness -> Black

    img = np.zeros((100, 100, 3), dtype=np.uint8)

    # Make a patch highly saturated (blue) -> Empty
    img[:] = [255, 0, 0]  # Blue in BGR
    res = classifier._classify_heuristic(img)
    # Blue is high saturation in HSV.
    assert res[0][0] == 0

    # Make a patch White (High Val, Low Sat)
    img[:] = [255, 255, 255]
    res = classifier._classify_heuristic(img)
    assert res[0][0] == 2

    # Make a patch Black (Low Val, Low Sat)
    img[:] = [0, 0, 0]
    res = classifier._classify_heuristic(img)
    assert res[0][0] == 1
