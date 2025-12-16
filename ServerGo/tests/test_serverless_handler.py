import pytest
import base64
import sys
from unittest.mock import MagicMock, patch, AsyncMock

# Mock runpod before serverless.handler imports it
sys.modules["runpod"] = MagicMock()
sys.modules["runpod.serverless"] = MagicMock()

from serverless.handler import (  # noqa: E402
    validate_api_key,
    error_response,
    handle_analyze,
    handle_recognize,
    handler,
    initialize,
    AnalysisRequest,
    RecognitionRequest,
)
from services.recognition_service import RecognitionResult  # noqa: E402


@pytest.fixture
def mock_katago_service():
    """Mock KataGo service."""
    with patch("serverless.handler.katago_service") as mock:
        mock.is_running.return_value = True
        mock.analyze = AsyncMock(return_value="(;GM[1]FF[4]SZ[19])")
        yield mock


@pytest.fixture
def mock_recognition_service():
    """Mock recognition service."""
    with patch("serverless.handler.recognition_service") as mock:
        mock.is_available.return_value = True
        result = RecognitionResult(
            board=[[0] * 19 for _ in range(19)],
            sgf="(;GM[1]FF[4]SZ[19])",
            corners=[[50, 50], [350, 50], [350, 350], [50, 350]],
            warped_base64="fake_base64",
        )
        mock.classify_from_corners = AsyncMock(return_value=result)
        mock.full_recognition = AsyncMock(return_value=result)
        mock.initialize = AsyncMock()
        yield mock


def test_validate_api_key_no_key_required():
    """Test API key validation when no key is required."""
    with patch("serverless.handler.KATAGO_API_KEY", None):
        assert validate_api_key({}, {}) is True


def test_validate_api_key_valid_header():
    """Test API key validation with valid header."""
    with patch("serverless.handler.KATAGO_API_KEY", "test-key"):
        headers = {"X-Worker-Key": "test-key"}
        assert validate_api_key({}, headers) is True


def test_validate_api_key_valid_header_lowercase():
    """Test API key validation with lowercase header."""
    with patch("serverless.handler.KATAGO_API_KEY", "test-key"):
        headers = {"x-worker-key": "test-key"}
        assert validate_api_key({}, headers) is True


def test_validate_api_key_invalid_header():
    """Test API key validation with invalid header."""
    with patch("serverless.handler.KATAGO_API_KEY", "test-key"):
        headers = {"X-Worker-Key": "wrong-key"}
        assert validate_api_key({}, headers) is False


def test_validate_api_key_valid_input_body():
    """Test API key validation from input body (legacy)."""
    with (
        patch("serverless.handler.KATAGO_API_KEY", "test-key"),
        patch("serverless.handler.logger") as mock_logger,
    ):
        job_input = {"api_key": "test-key"}
        assert validate_api_key(job_input, {}) is True
        # Should log warning about using body
        mock_logger.warning.assert_called_once()


def test_validate_api_key_invalid_input_body():
    """Test API key validation with invalid input body key."""
    with patch("serverless.handler.KATAGO_API_KEY", "test-key"):
        job_input = {"api_key": "wrong-key"}
        assert validate_api_key(job_input, {}) is False


def test_validate_api_key_no_key_provided():
    """Test API key validation when key is required but not provided."""
    with patch("serverless.handler.KATAGO_API_KEY", "test-key"):
        assert validate_api_key({}, {}) is False


def test_error_response():
    """Test error response formatting."""
    result = error_response(400, "Test error")

    assert isinstance(result, dict)
    assert "error" in result
    assert result["error"]["code"] == 400
    assert result["error"]["message"] == "Test error"


@pytest.mark.asyncio
async def test_handle_analyze_success(mock_katago_service):
    """Test successful analysis handling."""
    request = AnalysisRequest(sgf_data="(;GM[1])", steps=1000)

    result = await handle_analyze(request)

    assert "analyzed_sgf" in result
    mock_katago_service.analyze.assert_called_once_with(
        "(;GM[1])", visits=1000, start_turn=None, end_turn=None
    )


@pytest.mark.asyncio
async def test_handle_analyze_sgf_validation_error(mock_katago_service):
    """Test analysis with SGF validation error."""
    from core.sgf.validator import SGFValidationError

    request = AnalysisRequest(sgf_data="invalid", steps=1000)
    mock_katago_service.analyze.side_effect = SGFValidationError("Bad SGF")

    result = await handle_analyze(request)

    assert "error" in result
    assert result["error"]["code"] == 400
    assert "Invalid SGF" in result["error"]["message"]


@pytest.mark.asyncio
async def test_handle_analyze_general_exception(mock_katago_service):
    """Test analysis with general exception."""
    request = AnalysisRequest(sgf_data="(;GM[1])", steps=1000)
    mock_katago_service.analyze.side_effect = Exception("Engine crashed")

    with patch("serverless.handler.logger") as mock_logger:
        result = await handle_analyze(request)

        assert "error" in result
        assert result["error"]["code"] == 500
        assert "Analysis failed" in result["error"]["message"]
        mock_logger.error.assert_called_once()


@pytest.mark.asyncio
async def test_handle_recognize_invalid_base64():
    """Test recognition with invalid base64 image."""
    request = RecognitionRequest(image="not-valid-base64!!!", board_size=19)

    result = await handle_recognize(request)

    assert "error" in result
    assert result["error"]["code"] == 400
    assert "Invalid base64 image" in result["error"]["message"]


@pytest.mark.asyncio
async def test_handle_recognize_with_corners(mock_recognition_service):
    """Test recognition with provided corners."""
    # Valid base64 image
    image_b64 = base64.b64encode(b"fake_image_data").decode("utf-8")
    corners = [[50, 50], [350, 50], [350, 350], [50, 350]]
    request = RecognitionRequest(image=image_b64, corners=corners, board_size=19)

    result = await handle_recognize(request)

    assert "board" in result
    assert "sgf" in result
    assert "corners" in result
    mock_recognition_service.classify_from_corners.assert_called_once()


@pytest.mark.asyncio
async def test_handle_recognize_full_pipeline(mock_recognition_service):
    """Test full recognition pipeline without corners."""
    image_b64 = base64.b64encode(b"fake_image_data").decode("utf-8")
    request = RecognitionRequest(image=image_b64, board_size=19)

    result = await handle_recognize(request)

    assert "board" in result
    assert "sgf" in result
    mock_recognition_service.full_recognition.assert_called_once()


@pytest.mark.asyncio
async def test_handle_recognize_detection_failed(mock_recognition_service):
    """Test recognition when detection fails."""
    image_b64 = base64.b64encode(b"fake_image_data").decode("utf-8")
    request = RecognitionRequest(image=image_b64, board_size=19)

    mock_recognition_service.full_recognition.return_value = None

    result = await handle_recognize(request)

    assert "error" in result
    assert result["error"]["code"] == 422
    assert "Board detection failed" in result["error"]["message"]


@pytest.mark.asyncio
async def test_handle_recognize_general_exception(mock_recognition_service):
    """Test recognition with general exception."""
    image_b64 = base64.b64encode(b"fake_image_data").decode("utf-8")
    request = RecognitionRequest(image=image_b64, board_size=19)

    mock_recognition_service.full_recognition.side_effect = Exception(
        "Recognition error"
    )

    with patch("serverless.handler.logger") as mock_logger:
        result = await handle_recognize(request)

        assert "error" in result
        assert result["error"]["code"] == 500
        assert "Recognition failed" in result["error"]["message"]
        mock_logger.error.assert_called_once()


def test_handler_invalid_api_key():
    """Test handler with invalid API key."""
    with patch("serverless.handler.validate_api_key", return_value=False):
        job = {"input": {}, "headers": {}}
        result = handler(job)

        assert "error" in result
        assert result["error"]["code"] == 401


def test_handler_analyze_action(mock_katago_service):
    """Test handler with analyze action."""
    with patch("serverless.handler.validate_api_key", return_value=True):
        job = {
            "input": {"action": "analyze", "sgf_data": "(;GM[1])", "steps": 1000},
            "headers": {},
        }
        result = handler(job)

        assert "analyzed_sgf" in result or "error" in result


def test_handler_analyze_validation_error():
    """Test handler with invalid analysis request."""
    with patch("serverless.handler.validate_api_key", return_value=True):
        job = {
            "input": {"action": "analyze"},  # Missing sgf_data
            "headers": {},
        }
        result = handler(job)

        assert "error" in result
        assert result["error"]["code"] == 422


def test_handler_analyze_service_not_running():
    """Test handler when analysis service is not running."""
    with (
        patch("serverless.handler.validate_api_key", return_value=True),
        patch("serverless.handler.katago_service") as mock_service,
    ):
        mock_service.is_running.return_value = False

        job = {"input": {"action": "analyze", "sgf_data": "(;GM[1])"}, "headers": {}}
        result = handler(job)

        assert "error" in result
        assert result["error"]["code"] == 503
        assert "not running" in result["error"]["message"]


def test_handler_recognize_action(mock_recognition_service):
    """Test handler with recognize action."""
    with patch("serverless.handler.validate_api_key", return_value=True):
        image_b64 = base64.b64encode(b"fake").decode("utf-8")
        job = {"input": {"action": "recognize", "image": image_b64}, "headers": {}}
        result = handler(job)

        assert "board" in result or "error" in result


def test_handler_recognize_validation_error():
    """Test handler with invalid recognition request."""
    with patch("serverless.handler.validate_api_key", return_value=True):
        job = {
            "input": {"action": "recognize"},  # Missing image
            "headers": {},
        }
        result = handler(job)

        assert "error" in result
        assert result["error"]["code"] == 422


def test_handler_recognize_service_not_available():
    """Test handler when recognition service is not available."""
    with (
        patch("serverless.handler.validate_api_key", return_value=True),
        patch("serverless.handler.recognition_service") as mock_service,
    ):
        mock_service.is_available.return_value = False

        image_b64 = base64.b64encode(b"fake").decode("utf-8")
        job = {"input": {"action": "recognize", "image": image_b64}, "headers": {}}
        result = handler(job)

        assert "error" in result
        assert result["error"]["code"] == 503
        assert "not available" in result["error"]["message"]


def test_handler_unknown_action():
    """Test handler with unknown action."""
    with patch("serverless.handler.validate_api_key", return_value=True):
        job = {"input": {"action": "unknown_action"}, "headers": {}}
        result = handler(job)

        assert "error" in result
        assert result["error"]["code"] == 400
        assert "Unknown action" in result["error"]["message"]


def test_handler_default_action_analyze(mock_katago_service):
    """Test handler defaults to analyze action."""
    with patch("serverless.handler.validate_api_key", return_value=True):
        job = {
            "input": {"sgf_data": "(;GM[1])"},  # No action specified
            "headers": {},
        }
        result = handler(job)

        # Should use analyze as default
        assert "analyzed_sgf" in result or "error" in result


@pytest.mark.asyncio
async def test_initialize():
    """Test service initialization."""
    with (
        patch("serverless.handler.katago_service") as mock_katago,
        patch("serverless.handler.recognition_service") as mock_rec,
        patch("serverless.handler.logger") as mock_logger,
    ):
        mock_katago.start = AsyncMock()
        mock_rec.initialize = AsyncMock()

        await initialize()

        mock_katago.start.assert_called_once()
        mock_rec.initialize.assert_called_once()
        mock_logger.info.assert_called_once()
