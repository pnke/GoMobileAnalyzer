import pytest
from core.sgf.parser import SGF, Move, ParseError


def test_sgf_empty_input():
    with pytest.raises(ParseError):
        SGF.parse_sgf("")
    with pytest.raises(ParseError):
        SGF.parse_sgf("   ")


def test_sgf_no_nodes():
    # () parses to an empty root node in this implementation
    root = SGF.parse_sgf("()")
    assert root.empty


def test_sgf_single_empty_node():
    root = SGF.parse_sgf("(;)")
    assert root is not None
    assert len(root.nodes_in_tree) == 1


def test_sgf_property_parsing():
    # Test standard properties
    sgf = "(;GM[1]SZ[19]KM[6.5]PB[Black]PW[White])"
    root = SGF.parse_sgf(sgf)
    assert root.get_property("GM") == "1"  # Parser stores as strings
    assert root.get_property("SZ") == "19"
    assert root.get_property("KM") == "6.5"
    assert root.get_property("PB") == "Black"
    # Note: Properties are strings by default in parser unless typed accessors used.
    # checking board_size property:
    assert root.board_size == (19, 19)
    assert root.komi == 6.5


def test_sgf_list_properties():
    # AB/AW allow lists
    sgf = "(;AB[dd][pp]AW[dp][pd])"
    root = SGF.parse_sgf(sgf)
    root.get_property("AB")
    # Parser stores raw values as list of strings or single string?
    # get_property returns first value. get_list_property returns list.
    ab_list = root.get_list_property("AB")
    assert isinstance(ab_list, list)
    assert len(ab_list) == 2
    # Check typing if we used typed accessors
    placements = root.placements
    assert len(placements) > 0  # Includes AB and AW


def test_sgf_escaped_characters():
    # ] must be escaped as \]
    sgf = r"(;C[Comment with escaped \] bracket])"
    root = SGF.parse_sgf(sgf)
    comment = root.get_property("C")
    assert "Comment with escaped ] bracket" in comment


def test_sgf_nested_variations():
    sgf = "(;GM[1];B[pd](;W[dp];B[pp])(;W[dq];B[pq]))"
    root = SGF.parse_sgf(sgf)
    # Root -> Node 1 (B pd)
    node1 = root.children[0]
    assert node1.move.gtp() == "Q16"

    # Node 1 has 2 children (Variations)
    assert len(node1.children) == 2

    var1 = node1.children[0]  # W dp
    var2 = node1.children[1]  # W dq

    assert var1.move.gtp() == "D4"
    assert var2.move.gtp() == "D3"

    # Each variation continues
    assert len(var1.children) == 1
    assert var1.children[0].move.gtp() == "Q4"


def test_sgf_move_conversion():
    m = Move(coords=(0, 0))  # Internal (0,0) -> GTP A1 -> SGF as (on 19x19)
    assert m.gtp() == "A1"
    assert m.sgf((19, 19)) == "as"

    m2 = Move(coords=(18, 18))  # Internal (18,18) -> GTP T19 -> SGF sa
    assert m2.gtp() == "T19"
    assert m2.sgf((19, 19)) == "sa"

    pass_move = Move(None, None)
    assert pass_move.is_pass
    assert pass_move.sgf((19, 19)) == ""
    assert pass_move.gtp() == "pass"


def test_sgf_incomplete_property():
    # Prop without values
    with pytest.raises(ParseError):
        SGF.parse_sgf("(;GM)")


def test_sgf_mismatched_brackets():
    with pytest.raises(ParseError):
        SGF.parse_sgf("(;GM[1]")  # Missing closing )

    with pytest.raises(ParseError):
        SGF.parse_sgf("(;GM[1))")  # Wrong bracket
