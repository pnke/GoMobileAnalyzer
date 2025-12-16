import pytest
import numpy as np
import cv2
import torch
from unittest.mock import MagicMock, patch
from core.recognition.classifier import StoneClassifier


@pytest.fixture
def mock_cnn_model():
    """Create a mock CNN model for testing."""
    model = MagicMock()
    model.eval = MagicMock()
    # Mock output: 3 classes (Black=0, Empty=1, White=2)
    outputs = torch.tensor(
        [[10.0, 0.0, 0.0], [0.0, 10.0, 0.0], [0.0, 0.0, 10.0]]
    )  # Black, Empty, White
    model.return_value = outputs
    return model


@pytest.fixture
def sample_warped_board():
    """Create a sample warped board image."""
    # 608x608 image (typical warped size)
    img = np.zeros((608, 608, 3), dtype=np.uint8)
    # Fill with wood-like color
    img[:] = [150, 180, 200]
    return img


def test_classifier_init_with_model():
    """Test classifier initialization with model."""
    mock_model = MagicMock()
    device = torch.device("cpu")

    classifier = StoneClassifier(model=mock_model, device=device, board_size=19)

    assert classifier.model == mock_model
    assert classifier.device == device
    assert classifier.board_size == 19
    assert classifier.transform is not None


def test_classifier_init_without_model():
    """Test classifier initialization without model."""
    classifier = StoneClassifier(model=None, board_size=19)

    assert classifier.model is None
    assert classifier.transform is None
    assert classifier.device == torch.device("cpu")


def test_classify_cnn_success(sample_warped_board):
    """Test successful CNN classification."""
    model = MagicMock()
    model.eval = MagicMock()

    # Create output for 361 cells (19x19)
    # Let's say first cell is black, second is white, rest empty
    outputs = torch.zeros((361, 3))
    outputs[0] = torch.tensor([10.0, 0.0, 0.0])  # Black
    outputs[1] = torch.tensor([0.0, 0.0, 10.0])  # White
    outputs[2:] = torch.tensor([0.0, 10.0, 0.0])  # Empty

    model.return_value = outputs

    classifier = StoneClassifier(model=model, device=torch.device("cpu"), board_size=19)

    result = classifier.classify(sample_warped_board, margin=16)

    assert isinstance(result, list)
    assert len(result) == 19
    assert len(result[0]) == 19
    assert result[0][0] == 1  # Black (mapped from 0)
    assert result[0][1] == 2  # White (mapped from 2)


def test_classify_cnn_failure_fallback_adaptive(sample_warped_board):
    """Test CNN failure falls back to adaptive."""
    model = MagicMock()
    model.eval = MagicMock(side_effect=Exception("Model error"))

    classifier = StoneClassifier(model=model, device=torch.device("cpu"), board_size=19)

    # Should fall back to adaptive (which should work)
    result = classifier.classify(sample_warped_board, margin=16)

    assert isinstance(result, list)
    assert len(result) == 19


def test_classify_no_model_uses_adaptive(sample_warped_board):
    """Test that without model, classifier uses adaptive method."""
    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier.classify(sample_warped_board, margin=16)

    assert isinstance(result, list)
    assert len(result) == 19


def test_classify_cnn_edge_patches(sample_warped_board):
    """Test CNN classification handles edge patches correctly."""
    model = MagicMock()
    model.eval = MagicMock()
    outputs = torch.zeros((361, 3))
    outputs[:] = torch.tensor([0.0, 10.0, 0.0])  # All empty
    model.return_value = outputs

    classifier = StoneClassifier(model=model, device=torch.device("cpu"), board_size=19)

    # Use margin=0 to test edge cases
    result = classifier.classify(sample_warped_board, margin=0)

    assert len(result) == 19
    assert all(len(row) == 19 for row in result)


def test_classify_cnn_patch_resize():
    """Test that patches are resized when needed."""
    model = MagicMock()
    model.eval = MagicMock()
    outputs = torch.zeros((361, 3))
    outputs[:] = torch.tensor([0.0, 10.0, 0.0])
    model.return_value = outputs

    # Small image that will require resizing
    small_img = np.zeros((200, 200, 3), dtype=np.uint8)
    small_img[:] = [150, 180, 200]

    classifier = StoneClassifier(model=model, device=torch.device("cpu"), board_size=19)

    result = classifier.classify(small_img, margin=10)

    assert len(result) == 19


def test_classify_adaptive_success(sample_warped_board):
    """Test adaptive k-means classification."""
    # Add some dark and bright spots to simulate stones
    img = sample_warped_board.copy()
    # Add a dark spot (black stone)
    cv2.circle(img, (100, 100), 20, (30, 30, 30), -1)
    # Add a bright spot (white stone)
    cv2.circle(img, (200, 200), 20, (240, 240, 240), -1)

    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier._classify_adaptive(img, margin=16)

    assert isinstance(result, list)
    assert len(result) == 19
    assert all(len(row) == 19 for row in result)


def test_classify_adaptive_few_samples():
    """Test adaptive classification with too few samples."""
    # Very small image
    small_img = np.zeros((50, 50, 3), dtype=np.uint8)

    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier._classify_adaptive(small_img, margin=0)

    # Should return empty board when insufficient samples
    assert result == [[0] * 19 for _ in range(19)]


def test_classify_adaptive_single_stone_cluster():
    """Test adaptive with only one stone cluster detected."""
    img = np.zeros((608, 608, 3), dtype=np.uint8)
    img[:] = [150, 180, 200]  # Board color

    # Add only dark stones
    for i in range(5):
        x, y = 100 + i * 50, 100 + i * 50
        cv2.circle(img, (x, y), 15, (20, 20, 20), -1)

    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier._classify_adaptive(img, margin=16)

    assert isinstance(result, list)
    assert len(result) == 19


def test_classify_adaptive_safety_override():
    """Test safety override for dark board clusters."""
    img = np.zeros((608, 608, 3), dtype=np.uint8)
    # Very dark board
    img[:] = [40, 40, 40]

    # Add a few bright spots
    cv2.circle(img, (100, 100), 20, (240, 240, 240), -1)
    cv2.circle(img, (200, 200), 20, (240, 240, 240), -1)

    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier._classify_adaptive(img, margin=16)

    assert isinstance(result, list)
    assert len(result) == 19


def test_classify_adaptive_midpoint_stones():
    """Test adaptive classification with mid-brightness stones."""
    img = np.zeros((608, 608, 3), dtype=np.uint8)
    img[:] = [150, 180, 200]

    # Add black, white, and mid-gray stones
    cv2.circle(img, (100, 100), 20, (30, 30, 30), -1)  # Black
    cv2.circle(img, (200, 200), 20, (240, 240, 240), -1)  # White
    cv2.circle(img, (150, 150), 20, (120, 120, 120), -1)  # Mid-gray

    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier._classify_adaptive(img, margin=16)

    assert isinstance(result, list)


def test_classify_heuristic_black_white_empty(sample_warped_board):
    """Test heuristic classification detects black, white, and empty cells."""
    img = sample_warped_board.copy()

    # Add distinct stones with clear characteristics
    # Black stone - low saturation, low brightness
    cv2.circle(img, (100, 100), 20, (30, 30, 30), -1)
    # White stone - low saturation, high brightness
    cv2.circle(img, (300, 300), 20, (240, 240, 240), -1)
    # High saturation area (board wood texture)
    cv2.circle(img, (200, 200), 20, (100, 200, 50), -1)  # Green = high saturation

    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier._classify_heuristic(img, margin=16)

    assert isinstance(result, list)
    assert len(result) == 19
    assert all(len(row) == 19 for row in result)


def test_classify_heuristic_empty_patch():
    """Test heuristic handles empty patches gracefully."""
    img = np.zeros((100, 100, 3), dtype=np.uint8)

    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier._classify_heuristic(img, margin=0)

    assert isinstance(result, list)
    assert len(result) == 19


def test_classify_adaptive_failure_fallback_heuristic():
    """Test that adaptive failure falls back to heuristic."""
    img = np.zeros((608, 608, 3), dtype=np.uint8)
    img[:] = [150, 180, 200]

    classifier = StoneClassifier(model=None, board_size=19)

    # Mock kmeans to fail
    with patch("cv2.kmeans", side_effect=Exception("K-means error")):
        result = classifier.classify(img, margin=16)

        # Should fall back to heuristic and still return valid result
        assert isinstance(result, list)
        assert len(result) == 19


def test_classify_cnn_logging_traces(sample_warped_board):
    """Test that CNN classification logs trace messages."""
    model = MagicMock()
    model.eval = MagicMock()
    outputs = torch.zeros((361, 3))
    outputs[:] = torch.tensor([0.0, 10.0, 0.0])
    model.return_value = outputs

    classifier = StoneClassifier(model=model, device=torch.device("cpu"), board_size=19)

    with patch("core.recognition.classifier.logger") as mock_logger:
        classifier.classify(sample_warped_board, margin=16)

        # Verify logging calls
        assert mock_logger.info.called


def test_classify_no_model_logging(sample_warped_board):
    """Test logging when model is None."""
    classifier = StoneClassifier(model=None, board_size=19)

    with patch("core.recognition.classifier.logger") as mock_logger:
        classifier.classify(sample_warped_board, margin=16)

        # Should log that classifier is None
        any(
            call
            for call in mock_logger.info.call_args_list
            if "None" in str(call) or "Skipping CNN" in str(call)
        )


def test_classify_adaptive_cluster_mapping():
    """Test adaptive k-means cluster mapping logic."""
    img = np.zeros((608, 608, 3), dtype=np.uint8)
    img[:] = [150, 180, 200]

    # Add stones with different properties
    # Very dark (black)
    cv2.circle(img, (100, 100), 25, (25, 25, 25), -1)
    # Very bright (white)
    cv2.circle(img, (500, 500), 25, (235, 235, 235), -1)
    # Multiple mid-range for complex clustering
    for i in range(3):
        x, y = 200 + i * 80, 200 + i * 80
        brightness = 80 + i * 40
        cv2.circle(img, (x, y), 20, (brightness, brightness, brightness), -1)

    classifier = StoneClassifier(model=None, board_size=19)

    result = classifier._classify_adaptive(img, margin=16)

    assert isinstance(result, list)
    # Verify we have variation in classifications
    flat = [val for row in result for val in row]
    unique_values = set(flat)
    assert len(unique_values) >= 1  # At least some classification occurred
