import sys
from pathlib import Path

# Add ServerGo to path
server_path = Path(__file__).parent.parent
sys.path.insert(0, str(server_path))

from core.sgf.parser import SGF  # noqa: E402


def test_sgf_parsing(sample_sgf_content):
    """Test SGF parsing functionality using the internal parser"""
    # Test that we can parse a basic SGF string
    root = SGF.parse_sgf(sample_sgf_content)
    assert root is not None
    assert root.get_property("SZ") == "19"

    # Test that we can extract moves
    # The sample SGF has: ;B[aa];W[sa];B[as];W[ss]
    # Root -> B[aa] -> W[sa] -> B[as] -> W[ss]

    node = root
    moves = []

    # Traverse the main line
    while node.children:
        node = node.children[0]
        if node.move:
            moves.append(node.move)

    assert len(moves) == 4

    # Check first move B[aa] -> A19 (SGF coordinates 'aa' is top-left 0,0)
    first_move = moves[0]
    assert first_move.player == "B"
    assert first_move.sgf((19, 19)) == "aa"


def test_empty_sgf():
    """Test handling of empty SGF content"""
    empty_sgf = "(;GM[1]FF[4]CA[UTF-8]SZ[19])"
    root = SGF.parse_sgf(empty_sgf)
    assert root is not None
    assert root.get_property("SZ") == "19"
    assert len(root.children) == 0


def test_sgf_with_pass_moves():
    """Test SGF with pass moves"""
    # tt is pass for 19x19
    sgf_with_pass = "(;GM[1]FF[4]CA[UTF-8]SZ[19];B[aa];W[];B[tt])"
    root = SGF.parse_sgf(sgf_with_pass)

    moves = []
    node = root
    while node.children:
        node = node.children[0]
        if node.move:
            moves.append(node.move)

    assert len(moves) == 3
    assert moves[0].player == "B"
    assert not moves[0].is_pass

    assert moves[1].player == "W"
    assert moves[1].is_pass  # [] is pass

    assert moves[2].player == "B"
    assert moves[2].is_pass  # tt is pass
