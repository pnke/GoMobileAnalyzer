import unittest
from unittest.mock import patch, mock_open
from core.sgf.parser import SGF, SGFNode, Move


class TestSGFParserAdvanced(unittest.TestCase):
    def test_parse_file_sgf_utf8(self):
        """Test parsing an SGF file with UTF-8 encoding."""
        mock_content = b"(;GM[1]SZ[19];B[aa]C[Test])"
        with patch("builtins.open", mock_open(read_data=mock_content)):
            # Mock chardet if needed, but simple utf8 usually works without it if we don't mock it to return weirdness
            # However parser uses chardet if no CA property.
            with patch("chardet.detect", return_value={"encoding": "utf-8"}):
                root = SGF.parse_file("game.sgf")
                self.assertEqual(root.get_property("SZ"), "19")
                self.assertEqual(root.children[0].get_property("C"), "Test")

    def test_parse_file_sgf_ca_property(self):
        """Test parsing an SGF file with CA (charset) property."""
        # CA[ISO-8859-1]
        mock_content = b"(;GM[1]CA[ISO-8859-1]SZ[19];B[aa])"
        with patch("builtins.open", mock_open(read_data=mock_content)):
            root = SGF.parse_file("game.sgf")
            self.assertEqual(root.get_property("SZ"), "19")

    def test_parse_file_gib(self):
        """Test parsing a GIB file."""
        mock_content = b"\\[GAMEBLACKNAME=BlackPlayer(7d)\\]\n\\[GAMEWHITENAME=WhitePlayer(8d)\\]\nINIB 1 1 0 0\nSTO 0 0 1 10 10"
        with patch("builtins.open", mock_open(read_data=mock_content)):
            root = SGF.parse_file("game.gib")
            self.assertEqual(root.get_property("PB"), "BlackPlayer")
            self.assertEqual(root.get_property("PW"), "WhitePlayer")
            self.assertEqual(len(root.children), 1)

    def test_compressed_point_lists(self):
        """Test expansion of compressed point lists (e.g. AB[aa:ac])."""
        sgf_content = "(;GM[1]SZ[19]AB[aa:ac])"
        root = SGF.parse_sgf(sgf_content)

        placements = root.placements
        self.assertEqual(len(placements), 3)

    def test_parse_file_ngf(self):
        """Test parsing an NGF file."""
        # Line 11+ must contain moves like "PM  B  BB"
        mock_content = (
            b"19\n19\nWhite\nBlack\n0\n0\n0\n6.5\n20231212\n\nWhite win\nPM  B  BB\n"
        )

        with patch("builtins.open", mock_open(read_data=mock_content)):
            root = SGF.parse_file("game.ngf")
            self.assertEqual(root.get_property("SZ"), 19)
            self.assertEqual(root.get_property("RE"), "W+")
            self.assertEqual(root.get_property("DT"), "2023-12-12")
            self.assertTrue(len(root.children) > 0)

    def test_place_handicap_stones(self):
        """Test handicap stone placement."""
        root = SGFNode()
        root.set_property("SZ", 19)
        root.place_handicap_stones(3)

        placements = root.get_list_property("AB")
        self.assertEqual(len(placements), 3)
        # Check standard 3 stone placement (D4, Q4, Q16) -> dd, pd, pp?
        # 19x19: 4th line is index 3. 19-1-3 = 15.
        # dd (3,3), pd (15,3), dp (3,15), pp (15,15).
        # standard 3: dd, pd, dp. (or q4 etc).
        self.assertTrue(
            any("dd" in p for p in placements) or any("pd" in p for p in placements)
        )

    def test_sgf_serialization(self):
        """Test generating SGF string from node."""
        root = SGFNode()
        root.set_property("SZ", 19)
        root.set_property("KM", 6.5)
        move_node = SGFNode(parent=root)
        move_node.set_property("B", "aa")

        sgf_str = root.sgf()
        self.assertIn(";SZ[19]", sgf_str)
        self.assertIn(
            "KM[6.5]", sgf_str
        )  # KM is in the same node as SZ, likely (;SZ[19]KM[6.5]...)
        self.assertIn(";B[aa]", sgf_str)

    def test_tygem_handicap_ordering(self):
        """Test tygem swap in handicap."""
        root = SGFNode()
        root.set_property("SZ", 19)
        root.place_handicap_stones(4, tygem=True)
        placements = root.get_list_property("AB")
        self.assertEqual(len(placements), 4)

    def test_move_properties(self):
        """Test Move object properties (is_pass, opponent, gtp)."""
        m = Move(coords=(3, 3), player="B")
        self.assertEqual(m.gtp(), "D4")
        self.assertEqual(m.opponent, "W")
        self.assertFalse(m.is_pass)

        pass_move = Move(coords=None, player="W")
        self.assertTrue(pass_move.is_pass)
        self.assertEqual(pass_move.gtp(), "pass")


if __name__ == "__main__":
    unittest.main()
