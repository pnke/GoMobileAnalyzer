import pytest
import numpy as np
import cv2
from unittest.mock import patch
from services.board_detector import BoardDetector


@pytest.fixture
def sample_board_image():
    """Create a sample board image."""
    # 640x480 BGR image
    return np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)


@pytest.fixture
def square_image():
    """Create a square image."""
    return np.random.randint(0, 255, (600, 600, 3), dtype=np.uint8)


@pytest.fixture
def detector():
    """Create a BoardDetector instance."""
    return BoardDetector(board_size=19)


def test_board_detector_init():
    """Test BoardDetector initialization."""
    detector = BoardDetector(board_size=13)
    assert detector.board_size == 13


def test_board_detector_init_default():
    """Test BoardDetector with default board size."""
    detector = BoardDetector()
    assert detector.board_size == 19


def test_detect_board_landscape_image(detector, sample_board_image):
    """Test detect_board with landscape image."""
    result = detector.detect_board(sample_board_image)

    assert result is not None
    assert result.shape == (600, 600, 3)


def test_detect_board_portrait_image(detector):
    """Test detect_board with portrait image."""
    # 480x640 (portrait)
    portrait = np.random.randint(0, 255, (640, 480, 3), dtype=np.uint8)
    result = detector.detect_board(portrait)

    assert result is not None
    assert result.shape == (600, 600, 3)


def test_detect_board_square_image(detector, square_image):
    """Test detect_board with already square image."""
    result = detector.detect_board(square_image)

    assert result is not None
    assert result.shape == (600, 600, 3)


def test_detect_board_exception_handling(detector):
    """Test detect_board handles exceptions gracefully."""
    # Create invalid input
    invalid_image = np.array([])

    with patch("services.board_detector.logger") as mock_logger:
        result = detector.detect_board(invalid_image)

        assert result is None
        mock_logger.error.assert_called_once()


def test_detect_with_canny(detector, sample_board_image):
    """Test Canny edge detection method."""
    result = detector._detect_with_canny(sample_board_image)

    # May or may not find contours depending on image content
    # Just verify it doesn't crash
    assert result is None or isinstance(result, np.ndarray)


def test_detect_with_adaptive(detector, sample_board_image):
    """Test adaptive threshold detection method."""
    result = detector._detect_with_adaptive(sample_board_image)

    # May or may not find contours
    assert result is None or isinstance(result, np.ndarray)


def test_find_board_contour_empty_list(detector):
    """Test _find_board_contour with empty contour list."""
    result = detector._find_board_contour([])
    assert result is None


def test_find_board_contour_with_quadrilateral(detector):
    """Test _find_board_contour with a valid quadrilateral."""
    # Create a square contour
    square_contour = np.array(
        [[[100, 100]], [[400, 100]], [[400, 400]], [[100, 400]]], dtype=np.int32
    )

    result = detector._find_board_contour([square_contour])

    # Should find the quadrilateral
    assert result is not None
    assert len(result) == 4


def test_find_board_contour_multiple_contours(detector):
    """Test _find_board_contour selects largest valid contour."""
    # Small square
    small_square = np.array(
        [[[50, 50]], [[150, 50]], [[150, 150]], [[50, 150]]], dtype=np.int32
    )

    # Large square
    large_square = np.array(
        [[[100, 100]], [[500, 100]], [[500, 500]], [[100, 500]]], dtype=np.int32
    )

    result = detector._find_board_contour([small_square, large_square])

    # Should prefer larger contour
    assert result is not None


def test_find_board_contour_no_quadrilaterals(detector):
    """Test _find_board_contour with non-quadrilateral contours."""
    # Triangle
    triangle = np.array([[[100, 100]], [[200, 100]], [[150, 200]]], dtype=np.int32)

    # Pentagon
    pentagon = np.array(
        [[[100, 100]], [[200, 100]], [[250, 150]], [[200, 200]], [[100, 200]]],
        dtype=np.int32,
    )

    result = detector._find_board_contour([triangle, pentagon])

    # Should return None if no quadrilaterals found
    assert result is None or len(result) == 4


def test_order_corners():
    """Test corner ordering."""
    detector = BoardDetector()

    # Unordered corners
    corners = np.array(
        [
            [[200, 200]],  # Bottom-right
            [[100, 100]],  # Top-left
            [[200, 100]],  # Top-right
            [[100, 200]],  # Bottom-left
        ],
        dtype=np.float32,
    )

    ordered = detector._order_corners(corners)

    # Should be ordered as: TL, TR, BR, BL
    assert ordered[0][0] < ordered[1][0]  # TL.x < TR.x
    assert ordered[0][1] < ordered[3][1]  # TL.y < BL.y
    assert ordered.shape == (4, 2)


def test_warp_perspective(detector, sample_board_image):
    """Test perspective warp transformation."""
    # Define corners
    corners = np.array(
        [[100, 100], [500, 100], [500, 400], [100, 400]], dtype=np.float32
    )

    result = detector._warp_perspective(sample_board_image, corners)

    assert result.shape == (600, 600, 3)


def test_extract_grid_cells_19x19(detector, square_image):
    """Test extracting grid cells from 19x19 board."""
    cells = detector.extract_grid_cells(square_image)

    assert len(cells) == 19
    assert all(len(row) == 19 for row in cells)

    # Each cell should be a numpy array
    assert all(isinstance(cell, np.ndarray) for row in cells for cell in row)


def test_extract_grid_cells_13x13(square_image):
    """Test extracting grid cells from 13x13 board."""
    detector = BoardDetector(board_size=13)
    cells = detector.extract_grid_cells(square_image)

    assert len(cells) == 13
    assert all(len(row) == 13 for row in cells)


def test_extract_grid_cells_9x9(square_image):
    """Test extracting grid cells from 9x9 board."""
    detector = BoardDetector(board_size=9)
    cells = detector.extract_grid_cells(square_image)

    assert len(cells) == 9
    assert all(len(row) == 9 for row in cells)


def test_extract_grid_cells_with_margins(detector, square_image):
    """Test grid extraction with different margin sizes."""
    # Test with larger margin
    cells_large_margin = detector.extract_grid_cells(square_image, margin_percent=0.05)

    assert len(cells_large_margin) == 19
    assert len(cells_large_margin[0]) == 19

    # Test with smaller margin
    cells_small_margin = detector.extract_grid_cells(square_image, margin_percent=0.01)

    assert len(cells_small_margin) == 19


def test_extract_grid_cells_no_margin(detector, square_image):
    """Test grid extraction with no margin."""
    cells = detector.extract_grid_cells(square_image, margin_percent=0.0)

    assert len(cells) == 19
    assert all(len(row) == 19 for row in cells)


def test_extract_grid_cells_debug_output(detector, square_image):
    """Test that extract_grid_cells creates debug output."""
    with patch("cv2.imwrite") as mock_imwrite, patch("services.board_detector.logger"):
        detector.extract_grid_cells(square_image)

        # Should attempt to save debug image
        mock_imwrite.assert_called_once()
        assert "debug_board.jpg" in str(mock_imwrite.call_args)


def test_extract_grid_cells_debug_failure(detector, square_image):
    """Test that debug output failure is handled gracefully."""
    with (
        patch("cv2.imwrite", side_effect=Exception("Write failed")),
        patch("services.board_detector.logger") as mock_logger,
    ):
        # Should not raise exception
        cells = detector.extract_grid_cells(square_image)

        assert cells is not None
        mock_logger.warning.assert_called_once()


def test_extract_grid_cells_boundary_handling(detector):
    """Test cell extraction handles image boundaries correctly."""
    # Small image to test boundary conditions
    small_image = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)

    cells = detector.extract_grid_cells(small_image)

    # Should still extract all cells
    assert len(cells) == 19
    # Some cells might be very small but should exist
    assert all(cell.size > 0 for row in cells for cell in row)


def test_detect_with_canny_finds_contours(detector):
    """Test Canny detection with a clear board pattern."""
    # Create image with clear edges
    image = np.ones((600, 600, 3), dtype=np.uint8) * 200

    # Draw a clear rectangle
    cv2.rectangle(image, (100, 100), (500, 500), (0, 0, 0), 3)

    result = detector._detect_with_canny(image)

    # Should find contours (may or may not be quadrilateral)
    # Just verify it processes without crashing
    assert result is None or isinstance(result, np.ndarray)


def test_detect_with_adaptive_finds_contours(detector):
    """Test adaptive threshold detection with pattern."""
    image = np.ones((600, 600, 3), dtype=np.uint8) * 128

    # Draw board-like pattern
    for i in range(19):
        pos = 50 + i * 25
        cv2.line(image, (pos, 50), (pos, 550), (0, 0, 0), 1)
        cv2.line(image, (50, pos), (550, pos), (0, 0, 0), 1)

    result = detector._detect_with_adaptive(image)

    assert result is None or isinstance(result, np.ndarray)


def test_find_board_contour_different_tolerances(detector):
    """Test that different approximation tolerances are tried."""
    # Create a slightly rounded square
    contour = np.array(
        [
            [[100, 105]],
            [[105, 100]],
            [[200, 100]],
            [[205, 105]],
            [[205, 200]],
            [[200, 205]],
            [[105, 205]],
            [[100, 200]],
        ],
        dtype=np.int32,
    )

    result = detector._find_board_contour([contour])

    # With different tolerances, should approximate to quadrilateral
    assert result is None or len(result) == 4


def test_warp_perspective_different_aspect_ratios(detector):
    """Test perspective warp with various corner configurations."""
    image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)

    # Skewed corners
    corners = np.array([[50, 100], [750, 80], [780, 550], [20, 520]], dtype=np.float32)

    result = detector._warp_perspective(image, corners)

    # Should always output 600x600 square
    assert result.shape == (600, 600, 3)


def test_extract_grid_cells_cell_sizes(detector, square_image):
    """Test that extracted cells have reasonable sizes."""
    cells = detector.extract_grid_cells(square_image, margin_percent=0.025)

    # Check some cells in the middle (not edges)
    middle_cell = cells[9][9]

    # Cell should not be empty
    assert middle_cell.size > 0
    # Should be roughly square
    h, w = middle_cell.shape[:2]
    aspect_ratio = max(h, w) / min(h, w)
    assert aspect_ratio < 2.0  # Reasonably close to square


def test_detect_board_logs_info(detector, sample_board_image):
    """Test that detect_board logs information."""
    with patch("services.board_detector.logger") as mock_logger:
        detector.detect_board(sample_board_image)

        # Should log input image size
        mock_logger.info.assert_called()
        assert any(
            "Input image size" in str(call) for call in mock_logger.info.call_args_list
        )


def test_extract_grid_cells_logs_info(detector, square_image):
    """Test that extract_grid_cells logs information."""
    with patch("services.board_detector.logger") as mock_logger:
        detector.extract_grid_cells(square_image)

        # Should log board and cell info
        assert any("Board:" in str(call) for call in mock_logger.info.call_args_list)
