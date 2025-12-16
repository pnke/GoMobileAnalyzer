from core.errors import AppException, ErrorDetail, ErrorResponse
from core.exceptions import (
    GoAnalysisError,
    ModelLoadError,
    ImageProcessingError,
    RecognitionError,
    KataGoError,
    KataGoStartupError,
    KataGoTimeoutError,
    SGFValidationError,
)


def test_app_exception():
    exc = AppException(400, "Bad Request", detail={"foo": "bar"})
    assert exc.status_code == 400
    assert exc.message == "Bad Request"
    assert exc.detail == {"foo": "bar"}
    assert str(exc) == "Bad Request"


def test_error_models():
    detail = ErrorDetail(code=1, message="Error")
    assert detail.code == 1
    assert detail.message == "Error"

    resp = ErrorResponse(error=detail)
    assert resp.error == detail


def test_go_analysis_error():
    exc = GoAnalysisError("Error message", details="Some details")
    assert exc.message == "Error message"
    assert exc.details == "Some details"
    assert str(exc) == "Error message"


def test_model_load_error():
    exc = ModelLoadError("resnet18", "File not found")
    assert isinstance(exc, GoAnalysisError)
    assert exc.model_name == "resnet18"
    assert "Failed to load model" in str(exc)
    assert exc.details == "File not found"


def test_image_processing_error():
    exc = ImageProcessingError("resize", "Invalid dimensions")
    assert isinstance(exc, GoAnalysisError)
    assert exc.operation == "resize"
    assert "Image processing failed during" in str(exc)
    assert exc.details == "Invalid dimensions"


def test_recognition_error():
    exc = RecognitionError("corner_detection", "No corners found")
    assert isinstance(exc, GoAnalysisError)
    assert exc.stage == "corner_detection"
    assert "Recognition failed at stage" in str(exc)
    assert exc.details == "No corners found"


def test_katago_error():
    exc = KataGoError("Engine failure", "Process crash")
    assert isinstance(exc, GoAnalysisError)
    assert exc.message == "Engine failure"
    assert exc.details == "Process crash"


def test_katago_startup_error():
    exc = KataGoStartupError("Missing binary")
    assert isinstance(exc, KataGoError)
    assert "failed to start" in str(exc)
    assert exc.details == "Missing binary"


def test_katago_timeout_error():
    exc = KataGoTimeoutError(10)
    assert isinstance(exc, KataGoError)
    assert exc.timeout_seconds == 10
    assert "timed out after 10 seconds" in str(exc)


def test_sgf_validation_error():
    exc = SGFValidationError("Unbalanced params")
    assert isinstance(exc, GoAnalysisError)
    assert "Invalid SGF content" in str(exc)
    assert exc.details == "Unbalanced params"
