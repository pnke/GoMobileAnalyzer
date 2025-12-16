"""
Custom Exceptions for Go Analysis Server.

Provides specific exception types for different error scenarios,
enabling better error handling and more informative error messages.
"""


class GoAnalysisError(Exception):
    """Base exception for all Go analysis errors."""

    def __init__(self, message: str, details: str | None = None):
        self.message = message
        self.details = details
        super().__init__(self.message)


class ModelLoadError(GoAnalysisError):
    """Raised when ML models fail to load."""

    def __init__(self, model_name: str, reason: str):
        super().__init__(f"Failed to load model '{model_name}'", details=reason)
        self.model_name = model_name


class ImageProcessingError(GoAnalysisError):
    """Raised when image processing operations fail."""

    def __init__(self, operation: str, reason: str):
        super().__init__(
            f"Image processing failed during '{operation}'", details=reason
        )
        self.operation = operation


class RecognitionError(GoAnalysisError):
    """Raised when board or stone recognition fails."""

    def __init__(self, stage: str, reason: str):
        super().__init__(f"Recognition failed at stage '{stage}'", details=reason)
        self.stage = stage


class KataGoError(GoAnalysisError):
    """Raised when KataGo engine encounters an error."""

    def __init__(self, message: str, reason: str | None = None):
        super().__init__(message, details=reason)


class KataGoStartupError(KataGoError):
    """Raised when KataGo fails to start."""

    def __init__(self, reason: str):
        super().__init__("KataGo engine failed to start", reason=reason)


class KataGoTimeoutError(KataGoError):
    """Raised when KataGo analysis times out."""

    def __init__(self, timeout_seconds: int):
        super().__init__(f"KataGo analysis timed out after {timeout_seconds} seconds")
        self.timeout_seconds = timeout_seconds


class SGFValidationError(GoAnalysisError):
    """Raised when SGF content is invalid."""

    def __init__(self, reason: str):
        super().__init__("Invalid SGF content", details=reason)
