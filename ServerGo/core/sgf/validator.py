"""
SGF Content Validator
Validates and sanitizes SGF content before processing.
"""

import re


class SGFValidationError(Exception):
    """Raised when SGF validation fails."""

    pass


class SGFValidator:
    """Validates SGF content for security and correctness."""

    # Configuration
    MAX_FILE_SIZE = 500_000  # 500KB
    MAX_MOVES = 1000
    MAX_VARIATIONS = 100

    # Suspicious patterns that should never appear in valid SGF
    SUSPICIOUS_PATTERNS = [
        r"<script",
        r"javascript:",
        r"on\w+\s*=",  # Event handlers like onclick=
        r"\.\.\/",  # Path traversal
        r"\.\.\\",  # Windows path traversal
        r"file://",
        r"data:",
        r"vbscript:",
        r"<iframe",
        r"<object",
        r"<embed",
    ]

    @classmethod
    def validate(cls, content: str) -> str:
        """
        Validate and sanitize SGF content.

        Args:
            content: Raw SGF string

        Returns:
            Sanitized SGF string

        Raises:
            SGFValidationError: If validation fails
        """
        if not content:
            raise SGFValidationError("Empty SGF content")

        # Strip whitespace
        content = content.strip()

        # Size check
        if len(content) > cls.MAX_FILE_SIZE:
            raise SGFValidationError(
                f"SGF file too large: {len(content)} bytes (max: {cls.MAX_FILE_SIZE})"
            )

        # Basic structure validation
        cls._validate_structure(content)

        # Security checks
        cls._check_suspicious_patterns(content)

        # Move count check (DoS prevention)
        cls._check_move_count(content)

        # Variation count check
        cls._check_variation_count(content)

        return content

    @classmethod
    def _validate_structure(cls, content: str) -> None:
        """Validate basic SGF structure."""
        if not content.startswith("("):
            raise SGFValidationError("SGF must start with '('")

        if not content.endswith(")"):
            raise SGFValidationError("SGF must end with ')'")

        # Check for game type marker
        if "GM[1]" not in content and "GM[" not in content:
            # Allow missing GM property but warn
            pass

        # Check balanced parentheses
        depth = 0
        for char in content:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            if depth < 0:
                raise SGFValidationError("Unbalanced parentheses in SGF")

        if depth != 0:
            raise SGFValidationError("Unbalanced parentheses in SGF")

        # Check balanced brackets
        in_bracket = False
        escaped = False
        for char in content:
            if escaped:
                escaped = False
                continue
            if char == "\\":
                escaped = True
                continue
            if char == "[":
                if in_bracket:
                    raise SGFValidationError("Nested brackets in SGF")
                in_bracket = True
            elif char == "]":
                if not in_bracket:
                    raise SGFValidationError("Unmatched closing bracket in SGF")
                in_bracket = False

        if in_bracket:
            raise SGFValidationError("Unclosed bracket in SGF")

    @classmethod
    def _check_suspicious_patterns(cls, content: str) -> None:
        """Check for potentially malicious content."""
        content_lower = content.lower()

        for pattern in cls.SUSPICIOUS_PATTERNS:
            if re.search(pattern, content_lower, re.IGNORECASE):
                raise SGFValidationError(
                    f"SGF contains suspicious content matching pattern: {pattern}"
                )

    @classmethod
    def _check_move_count(cls, content: str) -> None:
        """Check that move count is reasonable."""
        # Count B[] and W[] moves
        move_count = len(re.findall(r";[BW]\[", content))

        if move_count > cls.MAX_MOVES:
            raise SGFValidationError(
                f"Too many moves: {move_count} (max: {cls.MAX_MOVES})"
            )

    @classmethod
    def _check_variation_count(cls, content: str) -> None:
        """Check that variation count is reasonable."""
        # Count opening parentheses after the first one
        variation_count = content.count("(") - 1

        if variation_count > cls.MAX_VARIATIONS:
            raise SGFValidationError(
                f"Too many variations: {variation_count} (max: {cls.MAX_VARIATIONS})"
            )


def validate_sgf(content: str) -> str:
    """
    Convenience function for SGF validation.

    Args:
        content: Raw SGF string

    Returns:
        Validated SGF string

    Raises:
        SGFValidationError: If validation fails
    """
    return SGFValidator.validate(content)
