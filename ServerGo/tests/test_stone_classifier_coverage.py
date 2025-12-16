import numpy as np
from services.stone_classifier import StoneClassifier, StoneColor, board_to_sgf


def test_stone_color_enum():
    """Test StoneColor enum values."""
    assert StoneColor.EMPTY == 0
    assert StoneColor.BLACK == 1
    assert StoneColor.WHITE == 2


def test_classifier_init():
    """Test StoneClassifier initialization."""
    classifier = StoneClassifier()

    assert classifier.black_threshold == 80
    assert classifier.white_threshold == 220
    assert classifier.board_low == 140
    assert classifier.board_high == 210


def test_classify_cell_black_stone():
    """Test classification of a black stone."""
    classifier = StoneClassifier()

    # Create a very dark cell (black stone)
    cell = np.zeros((32, 32, 3), dtype=np.uint8)
    cell[:] = [20, 20, 20]  # Very dark

    result = classifier.classify_cell(cell)

    assert result == StoneColor.BLACK


def test_classify_cell_white_stone():
    """Test classification of a white stone."""
    classifier = StoneClassifier()

    # Create a very bright cell (white stone)
    cell = np.zeros((32, 32, 3), dtype=np.uint8)
    cell[:] = [240, 240, 240]  # Very bright

    result = classifier.classify_cell(cell)

    assert result == StoneColor.WHITE


def test_classify_cell_empty():
    """Test classification of an empty cell."""
    classifier = StoneClassifier()

    # Create a mid-brightness cell (board wood)
    cell = np.zeros((32, 32, 3), dtype=np.uint8)
    cell[:] = [180, 150, 120]  # Wood-like color

    result = classifier.classify_cell(cell)

    assert result == StoneColor.EMPTY


def test_classify_cell_small_image():
    """Test classification with very small cell."""
    classifier = StoneClassifier()

    # Very small cell
    cell = np.zeros((4, 4, 3), dtype=np.uint8)
    cell[:] = [180, 150, 120]

    result = classifier.classify_cell(cell)

    # Should not crash
    assert result in [StoneColor.EMPTY, StoneColor.BLACK, StoneColor.WHITE]


def test_classify_cell_high_variance():
    """Test classification with high variance (triggers advanced classification)."""
    classifier = StoneClassifier()

    # Create a cell with high variance (mix of light and dark)
    cell = np.zeros((32, 32, 3), dtype=np.uint8)
    cell[:16, :] = [50, 50, 50]  # Dark half
    cell[16:, :] = [200, 200, 200]  # Bright half

    result = classifier.classify_cell(cell)

    # Should trigger advanced classification
    assert result in [StoneColor.EMPTY, StoneColor.BLACK, StoneColor.WHITE]


def test_classify_cell_exception_handling():
    """Test that classify_cell handles exceptions gracefully."""
    classifier = StoneClassifier()

    # Invalid input (wrong shape)
    cell = np.zeros((32, 32), dtype=np.uint8)  # Missing color dimension

    result = classifier.classify_cell(cell)

    # Should return EMPTY on error
    assert result == StoneColor.EMPTY


def test_advanced_classification_black():
    """Test advanced classification detecting black stone."""
    classifier = StoneClassifier()

    # Create grayscale image with strong dark presence
    gray = np.zeros((32, 32), dtype=np.uint8)
    gray[:] = 30  # Mostly dark

    result = classifier._advanced_classification(gray)

    # Should detect as black due to dark histogram peak
    assert result == StoneColor.BLACK


def test_advanced_classification_white():
    """Test advanced classification detecting white stone."""
    classifier = StoneClassifier()

    # Create grayscale image with strong bright presence
    gray = np.zeros((32, 32), dtype=np.uint8)
    gray[:] = 230  # Mostly bright

    result = classifier._advanced_classification(gray)

    # Should detect as white due to bright histogram peak
    assert result == StoneColor.WHITE


def test_advanced_classification_empty():
    """Test advanced classification detecting empty cell."""
    classifier = StoneClassifier()

    # Create grayscale image with mid-range values
    gray = np.zeros((32, 32), dtype=np.uint8)
    gray[:] = 125  # Mid-range (board wood)

    result = classifier._advanced_classification(gray)

    assert result == StoneColor.EMPTY


def test_classify_board():
    """Test classifying a full board."""
    classifier = StoneClassifier()

    # Create a  3x3 board of cells for testing
    cells = []
    for row in range(3):
        row_cells = []
        for col in range(3):
            cell = np.zeros((32, 32, 3), dtype=np.uint8)
            if row == 0 and col == 0:
                cell[:] = [20, 20, 20]  # Black stone
            elif row == 0 and col == 1:
                cell[:] = [240, 240, 240]  # White stone
            else:
                cell[:] = [180, 150, 120]  # Empty
            row_cells.append(cell)
        cells.append(row_cells)

    board = classifier.classify_board(cells)

    assert len(board) == 3
    assert len(board[0]) == 3
    assert board[0][0] == StoneColor.BLACK
    assert board[0][1] == StoneColor.WHITE
    assert board[0][2] == StoneColor.EMPTY


def test_classify_board_large():
    """Test classifying a 19x19 board."""
    classifier = StoneClassifier()

    # Create 19x19 board
    cells = []
    for row in range(19):
        row_cells = []
        for col in range(19):
            cell = np.zeros((32, 32, 3), dtype=np.uint8)
            cell[:] = [180, 150, 120]  # All empty
            row_cells.append(cell)
        cells.append(row_cells)

    board = classifier.classify_board(cells)

    assert len(board) == 19
    assert all(len(row) == 19 for row in board)


def test_board_to_sgf_empty():
    """Test SGF conversion for empty board."""
    board = [[0] * 19 for _ in range(19)]

    sgf = board_to_sgf(board, 19)

    assert sgf == "(;GM[1]FF[4]SZ[19])"


def test_board_to_sgf_with_stones():
    """Test SGF conversion with stones."""
    board = [[0] * 19 for _ in range(19)]
    board[0][0] = StoneColor.BLACK  # aa
    board[0][1] = StoneColor.WHITE  # ba
    board[3][3] = StoneColor.BLACK  # dd

    sgf = board_to_sgf(board, 19)

    assert "(;GM[1]FF[4]SZ[19]" in sgf
    assert "AB[aa][dd]" in sgf
    assert "AW[ba]" in sgf
    assert sgf.endswith(")")


def test_board_to_sgf_different_sizes():
    """Test SGF conversion for different board sizes."""
    # 9x9
    board_9 = [[0] * 9 for _ in range(9)]
    sgf_9 = board_to_sgf(board_9, 9)
    assert "SZ[9]" in sgf_9

    # 13x13
    board_13 = [[0] * 13 for _ in range(13)]
    sgf_13 = board_to_sgf(board_13, 13)
    assert "SZ[13]" in sgf_13


def test_board_to_sgf_partial_board():
    """Test SGF conversion with incomplete board data."""
    # Board smaller than specified size
    board = [[0] * 5 for _ in range(5)]
    board[0][0] = StoneColor.BLACK

    sgf = board_to_sgf(board, 19)

    assert "AB[aa]" in sgf
    assert "SZ[19]" in sgf
