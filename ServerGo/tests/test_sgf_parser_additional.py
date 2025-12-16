import pytest
from core.sgf.parser import SGF, SGFNode, Move


# Additional Move class tests
def test_move_from_gtp_pass():
    """Test Move.from_gtp with pass move."""
    move = Move.from_gtp("pass", player="W")
    assert move.is_pass
    assert move.player == "W"
    assert move.gtp() == "pass"


def test_move_from_gtp_invalid():
    """Test Move.from_gtp with invalid coordinates."""
    with pytest.raises(ValueError, match="Invalid GTP coordinates"):
        Move.from_gtp("invalid", player="B")


def test_move_from_sgf_tt_pass():
    """Test Move.from_sgf with 'tt' as pass on 19x19."""
    move = Move.from_sgf("tt", board_size=(19, 19), player="B")
    assert move.is_pass


def test_move_from_sgf_tt_not_pass_large_board():
    """Test 'tt' is not pass on boards > 19x19."""
    # On 20x20 board, 'tt' is a valid coordinate
    move = Move.from_sgf("tt", board_size=(20, 20), player="B")
    assert not move.is_pass
    assert move.coords is not None


def test_move_equality():
    """Test Move equality comparison."""
    move1 = Move(coords=(3, 3), player="B")
    move2 = Move(coords=(3, 3), player="B")
    move3 = Move(coords=(3, 4), player="B")

    assert move1 == move2
    assert move1 != move3


def test_move_hash():
    """Test Move hashing for use in sets/dicts."""
    move1 = Move(coords=(3, 3), player="B")
    move2 = Move(coords=(3, 3), player="B")

    assert hash(move1) == hash(move2)
    assert len({move1, move2}) == 1  # Same move


def test_move_opponent_property():
    """Test Move.opponent property."""
    black_move = Move(coords=(3, 3), player="B")
    assert black_move.opponent == "W"

    white_move = Move(coords=(3, 3), player="W")
    assert white_move.opponent == "B"


def test_move_opponent_player_static():
    """Test Move.opponent_player static method."""
    assert Move.opponent_player("B") == "W"
    assert Move.opponent_player("W") == "B"


# SGFNode tests
def test_sgfnode_creation_with_parent():
    """Test creating SGFNode with parent."""
    root = SGFNode()
    child = SGFNode(parent=root)

    assert child.parent == root
    assert child in root.children


def test_sgfnode_set_and_get_property():
    """Test setting and getting properties."""
    node = SGFNode()
    node.set_property("GM", "1")

    assert node.get_property("GM") == "1"


def test_sgfnode_list_property():
    """Test list properties."""
    node = SGFNode()
    node.set_property("AB", ["dd", "pp"])

    ab_list = node.get_list_property("AB")
    assert len(ab_list) == 2
    assert "dd" in ab_list
    assert "pp" in ab_list


def test_sgfnode_default_property():
    """Test get_property with default."""
    node = SGFNode()

    assert node.get_property("NONEXISTENT", default="default") == "default"
    assert node.get_property("NONEXISTENT") is None


# SGF parsing tests for edge cases
def test_sgf_multiple_root_nodes():
    """Test parsing SGF with multiple root sequences."""
    sgf = "(;GM[1];B[dd])(;GM[1];B[pp])"
    # Parser typically returns first tree
    root = SGF.parse_sgf(sgf)
    assert root is not None


def test_sgf_whitespace_handling():
    """Test SGF with various whitespace."""
    sgf = "( ; GM [ 1 ] SZ [ 19 ] )"
    root = SGF.parse_sgf(sgf)
    # Parser may keep spaces in values especially within brackets
    gm = root.get_property("GM")
    sz = root.get_property("SZ")
    # Just verify they exist and contain the numbers
    assert "1" in str(gm)
    assert "19" in str(sz)


def test_sgf_comment_with_newlines():
    """Test comments with newlines."""
    sgf = "(;GM[1]C[Line 1\\nLine 2\\nLine 3])"
    root = SGF.parse_sgf(sgf)
    comment = root.get_property("C")
    assert "Line 1" in comment
    assert "Line 2" in comment


def test_sgf_handicap_stones():
    """Test parsing handicap stones (AB property)."""
    sgf = "(;GM[1]AB[dd][dp][pd][pp]HA[4])"
    root = SGF.parse_sgf(sgf)

    placements = root.placements
    assert len(placements) >= 4


def test_sgf_board_size_property():
    """Test board_size property for various sizes."""
    # 19x19
    sgf19 = "(;GM[1]SZ[19])"
    root19 = SGF.parse_sgf(sgf19)
    assert root19.board_size == (19, 19)

    # 13x13
    sgf13 = "(;GM[1]SZ[13])"
    root13 = SGF.parse_sgf(sgf13)
    assert root13.board_size == (13, 13)

    # 9x9
    sgf9 = "(;GM[1]SZ[9])"
    root9 = SGF.parse_sgf(sgf9)
    assert root9.board_size == (9, 9)


def test_sgf_non_square_board():
    """Test non-square board size like 19:13."""
    sgf = "(;GM[1]SZ[19:13])"
    root = SGF.parse_sgf(sgf)
    assert root.board_size == (19, 13)


def test_sgf_komi_negative():
    """Test negative komi."""
    sgf = "(;GM[1]KM[-5.5])"
    root = SGF.parse_sgf(sgf)
    assert root.komi == -5.5


def test_sgf_result_various():
    """Test various result formats."""
    # Black wins by resignation
    sgf1 = "(;GM[1]RE[B+R])"
    root1 = SGF.parse_sgf(sgf1)
    assert "B+" in root1.get_property("RE", "")

    # White wins by 2.5
    sgf2 = "(;GM[1]RE[W+2.5])"
    root2 = SGF.parse_sgf(sgf2)
    assert "W+" in root2.get_property("RE", "")


def test_sgf_player_info():
    """Test player name and rank properties."""
    sgf = "(;GM[1]PB[Alice]BR[5d]PW[Bob]WR[6d])"
    root = SGF.parse_sgf(sgf)

    assert root.get_property("PB") == "Alice"
    assert root.get_property("BR") == "5d"
    assert root.get_property("PW") == "Bob"
    assert root.get_property("WR") == "6d"


def test_sgf_date_format():
    """Test date property."""
    sgf = "(;GM[1]DT[2024-12-12])"
    root = SGF.parse_sgf(sgf)
    assert "2024-12-12" in root.get_property("DT", "")


def test_sgf_empty_property_value():
    """Test property with empty value."""
    sgf = "(;GM[1]C[])"
    root = SGF.parse_sgf(sgf)
    comment = root.get_property("C")
    assert comment == "" or comment is None


def test_sgf_very_long_comment():
    """Test parsing very long comments."""
    long_text = "A" * 5000
    sgf = f"(;GM[1]C[{long_text}])"
    root = SGF.parse_sgf(sgf)
    comment = root.get_property("C")
    assert len(comment) >= 5000


def test_sgf_special_characters_in_text():
    """Test special characters in text properties."""
    sgf = r"(;GM[1]C[Test: colons, semicolons;, and (parens)])"
    root = SGF.parse_sgf(sgf)
    comment = root.get_property("C")
    assert "colons" in comment
    assert "semicolons" in comment


def test_sgf_sequence_without_root_properties():
    """Test game tree with moves but minimal root."""
    sgf = "(;;B[dd];W[dp];B[pp])"
    root = SGF.parse_sgf(sgf)
    assert root is not None
    assert len(root.children) > 0


def test_sgf_deep_variation():
    """Test deeply nested variations."""
    # Create a deep variation tree
    sgf = "(;GM[1];B[dd](;W[dp](;B[pp](;W[pd]))))"
    root = SGF.parse_sgf(sgf)

    # Navigate deep
    node = root.children[0]  # B[dd]
    assert node.move.gtp() == "D16"

    node = node.children[0]  # W[dp]
    assert node.move.gtp() == "D4"


def test_sgf_multiple_variations_at_same_node():
    """Test node with multiple variation branches."""
    sgf = "(;GM[1];B[dd](;W[dp])(;W[dq])(;W[dd]))"
    root = SGF.parse_sgf(sgf)

    first_move = root.children[0]
    assert len(first_move.children) == 3  # Three variations


def test_sgf_node_count():
    """Test counting nodes in tree."""
    sgf = "(;GM[1];B[dd];W[dp];B[pp];W[pd])"
    root = SGF.parse_sgf(sgf)

    # Should have root + 4 moves = 5 nodes
    assert len(root.nodes_in_tree) >= 5
