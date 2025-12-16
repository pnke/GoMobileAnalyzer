import sys
from pathlib import Path
from core.sgf.parser import SGF

# Add ServerGo to path
server_path = Path(__file__).parent.parent
sys.path.insert(0, str(server_path))


def test_sgf_parsing(sample_sgf_content):
    """Test SGF parsing functionality using the internal parser"""
    # Test that we can parse a basic SGF string
    root = SGF.parse_sgf(sample_sgf_content)
    assert root is not None
    assert root.get_property("SZ") == "19"

    # Test that we can extract moves
    # The sample SGF has: ;B[aa];W[sa];B[as];W[ss]
    # Root -> B[aa] -> W[sa] -> B[as] -> W[ss]

    # Root itself might contain properties but usually the first move is a child if it's a game tree
    # In the sample: (;GM[1]...;B[aa]...)
    # SGF parser usually puts properties in root, and moves in children or same node if ; is used
    # Let's traverse

    node = root
    moves = []

    # Traverse the main line
    while node.children:
        node = node.children[0]
        if node.move:
            moves.append(node.move)

    assert len(moves) == 4

    # Check first move B[aa] -> A19 (SGF coordinates 'aa' is top-left 0,0)
    # common.sgf_parser.Move.from_sgf('aa', (19,19)) -> (0, 0) which is A19 in GTP?
    # Let's check the Move object properties
    first_move = moves[0]
    assert first_move.player == "B"
    # 'aa' in SGF is (0,0).
    # In GTP A19 is (0, 18) if 0-indexed from bottom-left? Or top-left?
    # Let's just check the sgf string representation or coordinates
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


def test_sgf_with_variations():
    """Test SGF with game variations"""
    sgf_variations = "(;GM[1]FF[4]SZ[19];B[aa](;W[ab])(;W[ba]))"
    root = SGF.parse_sgf(sgf_variations)

    # First move should have 2 children (variations)
    node = root
    while node.children and not node.move:
        node = node.children[0]

    # After B[aa], there should be 2 variations
    assert len(node.children) == 2


def test_sgf_with_comments():
    """Test SGF with comments containing special characters"""
    sgf_with_comments = (
        "(;GM[1]FF[4]SZ[19];B[aa]C[Test comment with \\] escaped bracket])"
    )
    root = SGF.parse_sgf(sgf_with_comments)

    node = root
    while node.children:
        node = node.children[0]

    comment = node.get_property("C")
    assert "]" in comment  # Escaped bracket should be in comment


def test_large_sgf_parsing():
    """Test parsing a larger SGF with many moves"""
    moves = ";".join(
        [
            f"{'B' if i % 2 == 0 else 'W'}[{chr(97 + i % 19)}{chr(97 + i // 19)}]"
            for i in range(50)
        ]
    )
    large_sgf = f"(;GM[1]FF[4]SZ[19]{moves})"

    root = SGF.parse_sgf(large_sgf)

    # Count moves
    move_count = 0
    node = root
    while node.children:
        node = node.children[0]
        if node.move:
            move_count += 1

    assert (
        move_count == 49
    )  # First move starts at index 0, 50 iterations create 49 child nodes


def test_sgf_different_board_sizes():
    """Test SGF with different board sizes"""
    for size in [9, 13, 19]:
        sgf = f"(;GM[1]FF[4]SZ[{size}];B[aa])"
        root = SGF.parse_sgf(sgf)
        assert root.get_property("SZ") == str(size)
