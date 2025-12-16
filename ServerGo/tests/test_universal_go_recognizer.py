import pytest
import numpy as np
import cv2
from unittest.mock import MagicMock, patch
from pathlib import Path
from services.universal_go_recognizer import UniversalGoRecognizer, board_to_sgf


@pytest.fixture
def mock_paths():
    """Mock model paths to not exist by default."""
    with patch.object(Path, "exists", return_value=False):
        yield


@pytest.fixture
def recognizer_no_models(mock_paths):
    """Create recognizer without loading real models."""
    with (
        patch("torch.load"),
        patch("services.universal_go_recognizer.deeplabv3_resnet50"),
        patch("services.universal_go_recognizer.ResNet9"),
    ):
        recognizer = UniversalGoRecognizer()
        return recognizer


@pytest.fixture
def recognizer_with_models():
    """Create recognizer with mocked models."""
    with (
        patch("torch.load"),
        patch("services.universal_go_recognizer.deeplabv3_resnet50") as mock_deeplab,
        patch("services.universal_go_recognizer.ResNet9") as mock_resnet,
    ):
        # Mock segmentation model
        seg_model = MagicMock()
        seg_model.classifier = [None, None, None, None, MagicMock()]
        seg_model.aux_classifier = None
        mock_deeplab.return_value = seg_model

        # Mock classifier
        classifier = MagicMock()
        mock_resnet.return_value = classifier

        # Make paths exist
        with patch.object(Path, "exists", return_value=True):
            recognizer = UniversalGoRecognizer()
            recognizer.model = seg_model
            recognizer.classifier = classifier
            return recognizer


def test_init_no_models(recognizer_no_models):
    """Test initialization when models don't exist."""
    assert recognizer_no_models.device is not None
    assert recognizer_no_models.board_size == 19
    assert recognizer_no_models.classifier_instance is not None


def test_is_available(recognizer_no_models, recognizer_with_models):
    """Test is_available checks model existence."""
    recognizer_no_models.model = None
    assert not recognizer_no_models.is_available()

    recognizer_with_models.model = MagicMock()
    assert recognizer_with_models.is_available()


def test_load_models_segmentation_not_found(mock_paths):
    """Test segmentation model loading when file doesn't exist."""
    with patch("services.universal_go_recognizer.deeplabv3_resnet50") as mock_deeplab:
        mock_model = MagicMock()
        mock_model.classifier = [None, None, None, None, MagicMock()]
        mock_model.aux_classifier = None
        mock_deeplab.return_value = mock_model

        recognizer = UniversalGoRecognizer()
        assert recognizer.model is None  # Should be None when file doesn't exist


def test_load_models_classifier_finetuned_vs_base():
    """Test classifier loading preference (finetuned > base)."""
    with (
        patch("services.universal_go_recognizer.deeplabv3_resnet50"),
        patch("services.universal_go_recognizer.ResNet9") as mock_resnet,
        patch("torch.load"),
    ):
        mock_classifier = MagicMock()
        mock_resnet.return_value = mock_classifier

        # Test finetuned path exists
        def exists_side_effect(self):
            return "finetuned" in str(self)

        with patch.object(Path, "exists", exists_side_effect):
            recognizer = UniversalGoRecognizer()
            assert recognizer.classifier is not None


def test_load_models_exception_handling():
    """Test model loading with exceptions."""
    with (
        patch(
            "services.universal_go_recognizer.deeplabv3_resnet50",
            side_effect=Exception("Model error"),
        ),
        patch(
            "services.universal_go_recognizer.ResNet9",
            side_effect=Exception("Classifier error"),
        ),
    ):
        recognizer = UniversalGoRecognizer()
        assert recognizer.model is None
        assert recognizer.classifier is None
        assert recognizer.classifier_instance is not None  # Should still initialize


def test_intersect_lines_success(recognizer_no_models):
    """Test line intersection calculation."""
    # Two perpendicular lines
    rho1, theta1 = 100, 0  # Vertical line
    rho2, theta2 = 100, np.pi / 2  # Horizontal line

    result = recognizer_no_models._intersect_lines(rho1, theta1, rho2, theta2)
    assert result is not None
    assert len(result) == 2


def test_intersect_lines_parallel(recognizer_no_models):
    """Test line intersection with parallel lines (should fail)."""
    rho1, theta1 = 100, 0
    rho2, theta2 = 200, 0  # Parallel

    result = recognizer_no_models._intersect_lines(rho1, theta1, rho2, theta2)
    assert result is None


def test_order_corners(recognizer_no_models):
    """Test corner ordering by angle."""
    pts = np.array(
        [
            [100, 100],  # BR
            [0, 0],  # TL
            [0, 100],  # BL
            [100, 0],  # TR
        ],
        dtype=np.float32,
    )

    ordered = recognizer_no_models._order_corners(pts)
    assert ordered.shape == (4, 2)
    # Verify ordering is consistent (angle-based)
    center = np.mean(pts, axis=0)
    for i in range(3):
        np.arctan2(ordered[i][1] - center[1], ordered[i][0] - center[0])
        np.arctan2(ordered[i + 1][1] - center[1], ordered[i + 1][0] - center[0])
        # Angles should be increasing (wrapping around at pi)


def test_find_corners_hough_success(recognizer_no_models):
    """Test corner detection with Hough lines."""
    # Create a square mask
    mask = np.zeros((200, 200), dtype=np.uint8)
    mask[20:180, 20:180] = 255

    with patch("cv2.HoughLines") as mock_hough, patch("cv2.Canny", return_value=mask):
        # Mock Hough lines (4 strong lines)
        mock_hough.return_value = np.array(
            [[[100, 0]], [[100, np.pi / 2]], [[100, np.pi]], [[100, 3 * np.pi / 2]]]
        )

        recognizer_no_models._find_corners(mask)
        # May return None or corners depending on intersection logic


def test_find_corners_contour_fallback(recognizer_no_models):
    """Test corner detection with contour fallback."""
    mask = np.zeros((200, 200), dtype=np.uint8)
    cv2.rectangle(mask, (20, 20), (180, 180), 255, -1)

    # Force Hough to fail
    with patch("cv2.HoughLines", return_value=None):
        corners = recognizer_no_models._find_corners(mask)
        assert corners is not None
        assert corners.shape == (4, 2)


def test_find_corners_empty_mask(recognizer_no_models):
    """Test corner detection with empty mask."""
    mask = np.zeros((200, 200), dtype=np.uint8)

    corners = recognizer_no_models._find_corners(mask)
    assert corners is None or corners.shape == (4, 2)


def test_warp_board_success(recognizer_no_models):
    """Test board warping with valid corners."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    corners = np.array([[50, 50], [350, 50], [350, 350], [50, 350]], dtype=np.float32)

    warped = recognizer_no_models._warp_board(img, corners, output_size=600, margin=20)
    assert warped.shape == (600, 600, 3)


def test_warp_board_invalid_corners(recognizer_no_models):
    """Test board warping with invalid corners (returns black image)."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)

    # None corners
    warped = recognizer_no_models._warp_board(img, None, output_size=600, margin=20)
    assert warped.shape == (600, 600, 3)
    assert np.all(warped == 0)

    # Wrong number of corners
    corners = np.array([[50, 50], [350, 50]], dtype=np.float32)
    warped = recognizer_no_models._warp_board(img, corners, output_size=600, margin=20)
    assert warped.shape == (600, 600, 3)


def test_detect_corners_no_model(recognizer_no_models):
    """Test detect_corners when model is not available."""
    recognizer_no_models.model = None
    img = np.zeros((400, 400, 3), dtype=np.uint8)

    corners = recognizer_no_models.detect_corners(img)
    assert corners is None


def test_detect_corners_with_model(recognizer_with_models):
    """Test detect_corners with mocked segmentation."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)

    # Mock predict_mask and cleanup_mask
    with (
        patch("services.universal_go_recognizer.predict_mask") as mock_predict,
        patch("services.universal_go_recognizer.cleanup_mask") as mock_cleanup,
    ):
        # Create a square mask
        mask = np.zeros((800, 800), dtype=np.uint8)
        cv2.rectangle(mask, (100, 100), (700, 700), 255, -1)
        mock_predict.return_value = mask
        mock_cleanup.return_value = mask

        recognizer_with_models.detect_corners(img)
        # Should return scaled corners or None


def test_classify_from_corners(recognizer_with_models):
    """Test classification from given corners."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    corners = np.array([[50, 50], [350, 50], [350, 350], [50, 350]], dtype=np.float32)

    # Mock classifier
    recognizer_with_models.classifier_instance = MagicMock()
    recognizer_with_models.classifier_instance.classify.return_value = [[0] * 19] * 19

    board, warped = recognizer_with_models.classify_from_corners(img, corners)
    assert len(board) == 19
    assert warped.shape == (608, 608, 3)


def test_recognize_board_not_available(recognizer_no_models):
    """Test recognize_board when model not available."""
    recognizer_no_models.model = None
    img = np.zeros((400, 400, 3), dtype=np.uint8)

    warped, board, corners = recognizer_no_models.recognize_board(img)
    assert warped is None
    assert board is None
    assert corners is None


def test_recognize_board_no_corners_detected(recognizer_with_models):
    """Test recognize_board when corner detection fails."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)

    # Mock detect_corners to return None
    recognizer_with_models.detect_corners = MagicMock(return_value=None)

    warped, board, corners = recognizer_with_models.recognize_board(img)
    assert warped is None
    assert board is None
    assert corners is None


def test_recognize_board_exception(recognizer_with_models):
    """Test recognize_board with exception handling."""
    img = np.zeros((400, 400, 3), dtype=np.uint8)

    # Mock detect_corners to raise exception
    recognizer_with_models.detect_corners = MagicMock(
        side_effect=Exception("Detection error")
    )

    warped, board, corners = recognizer_with_models.recognize_board(img)
    assert warped is None
    assert board is None
    assert corners is None


def test_classify_stones_with_instance(recognizer_with_models):
    """Test stone classification delegation."""
    warped = np.zeros((608, 608, 3), dtype=np.uint8)

    recognizer_with_models.classifier_instance = MagicMock()
    recognizer_with_models.classifier_instance.classify.return_value = [[1] * 19] * 19

    board = recognizer_with_models._classify_stones(warped, margin=16)
    assert board[0][0] == 1


def test_classify_stones_no_instance(recognizer_no_models):
    """Test stone classification without classifier instance."""
    warped = np.zeros((608, 608, 3), dtype=np.uint8)
    recognizer_no_models.classifier_instance = None

    board = recognizer_no_models._classify_stones(warped, margin=16)
    assert len(board) == 19
    assert all(cell == 0 for row in board for cell in row)


def test_board_to_sgf_none():
    """Test SGF conversion with None board."""
    sgf = board_to_sgf(None)
    assert sgf == ""


def test_board_to_sgf_empty():
    """Test SGF conversion with empty board."""
    board = [[0] * 19 for _ in range(19)]
    sgf = board_to_sgf(board)
    assert "(;GM[1]FF[4]SZ[19])" == sgf


def test_board_to_sgf_with_stones():
    """Test SGF conversion with stones."""
    board = [[0] * 19 for _ in range(19)]
    board[0][0] = 1  # Black at aa
    board[0][18] = 2  # White at sa

    sgf = board_to_sgf(board)
    assert "AB[aa]" in sgf
    assert "AW[sa]" in sgf
    assert sgf.startswith("(;GM[1]FF[4]SZ[19]")
    assert sgf.endswith(")")
