"""
Tests for SGF validator
"""

import pytest
from core.sgf.validator import validate_sgf, SGFValidationError, SGFValidator


class TestSGFValidator:
    """Test suite for SGF validation."""

    def test_valid_simple_sgf(self):
        """Test that valid simple SGF passes validation."""
        sgf = "(;GM[1]FF[4]SZ[19];B[pd];W[dp])"
        result = validate_sgf(sgf)
        assert result == sgf

    def test_valid_sgf_with_whitespace(self):
        """Test that SGF with surrounding whitespace is trimmed."""
        sgf = "  (;GM[1]FF[4]SZ[19];B[pd])  \n"
        result = validate_sgf(sgf)
        assert result == "(;GM[1]FF[4]SZ[19];B[pd])"

    def test_empty_content_fails(self):
        """Test that empty content raises error."""
        with pytest.raises(SGFValidationError, match="Empty SGF"):
            validate_sgf("")

    def test_missing_opening_paren_fails(self):
        """Test that SGF without opening paren fails."""
        with pytest.raises(SGFValidationError, match="must start with"):
            validate_sgf(";GM[1])")

    def test_missing_closing_paren_fails(self):
        """Test that SGF without closing paren fails."""
        with pytest.raises(SGFValidationError, match="must end with"):
            validate_sgf("(;GM[1]")

    def test_unbalanced_parens_fails(self):
        """Test that unbalanced parentheses fail."""
        with pytest.raises(SGFValidationError, match="Unbalanced"):
            validate_sgf("(;GM[1](;B[pd])")

    def test_unbalanced_brackets_fails(self):
        """Test that unbalanced brackets fail."""
        with pytest.raises(SGFValidationError, match="bracket"):
            validate_sgf("(;GM[1]B[pd)")

    def test_script_injection_blocked(self):
        """Test that script tags are blocked."""
        sgf = "(;GM[1]C[<script>alert('xss')</script>])"
        with pytest.raises(SGFValidationError, match="suspicious"):
            validate_sgf(sgf)

    def test_javascript_blocked(self):
        """Test that javascript: is blocked."""
        sgf = "(;GM[1]C[javascript:void(0)])"
        with pytest.raises(SGFValidationError, match="suspicious"):
            validate_sgf(sgf)

    def test_path_traversal_blocked(self):
        """Test that path traversal is blocked."""
        sgf = "(;GM[1]C[../../etc/passwd])"
        with pytest.raises(SGFValidationError, match="suspicious"):
            validate_sgf(sgf)

    def test_file_size_limit(self):
        """Test that oversized SGF is rejected."""
        # Create SGF larger than limit
        large_comment = "x" * (SGFValidator.MAX_FILE_SIZE + 1000)
        sgf = f"(;GM[1]C[{large_comment}])"
        with pytest.raises(SGFValidationError, match="too large"):
            validate_sgf(sgf)

    def test_move_count_limit(self):
        """Test that SGF with too many moves is rejected."""
        # Create SGF with many moves
        moves = ";B[aa]" * (SGFValidator.MAX_MOVES + 10)
        sgf = f"(;GM[1]{moves})"
        with pytest.raises(SGFValidationError, match="Too many moves"):
            validate_sgf(sgf)

    def test_escaped_brackets_allowed(self):
        """Test that escaped brackets in comments are allowed."""
        sgf = r"(;GM[1]C[This has \] escaped bracket])"
        result = validate_sgf(sgf)
        assert result == sgf

    def test_variations_allowed(self):
        """Test that valid variations pass."""
        sgf = "(;GM[1](;B[pd];W[dp])(;B[dd];W[pp]))"
        result = validate_sgf(sgf)
        assert result == sgf
