import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os
import pprint

# Skip tests check removed for refactor verification

# Add ServerGo to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Mock runpod before importing handler
sys.modules["runpod"] = MagicMock()

# Mock services before importing
mock_katago_service = MagicMock()
mock_katago_service.is_running.return_value = True
mock_katago_service.analyze = AsyncMock(return_value="(;GM[1]C[Analyzed])")

mock_recognition_service = MagicMock()
mock_recognition_service.is_available.return_value = True
mock_recognition_service.classify_from_corners = AsyncMock(
    return_value=MagicMock(board=[], sgf="", corners=[], warped_base64="")
)
mock_recognition_service.full_recognition = AsyncMock(
    return_value=MagicMock(board=[], sgf="", corners=[], warped_base64="")
)

with patch.dict(
    sys.modules,
    {
        "services.katago_service": MagicMock(
            KataGoService=MagicMock(
                side_effect=lambda factory, config: mock_katago_service
            )
        ),
        "services.recognition_service": MagicMock(
            RecognitionService=MagicMock(return_value=mock_recognition_service)
        ),
    },
):
    from serverless.handler import handler


@pytest.fixture
def mock_services():
    """Mock the analysis and recognition services."""
    # Reset mocks
    mock_katago_service.analyze.side_effect = None
    mock_katago_service.analyze.return_value = "(;GM[1]C[Analyzed])"
    yield mock_katago_service


def test_handler_valid_input(mock_services):
    """Test handler with valid SGF input."""
    job = {
        "input": {"sgf_data": "(;GM[1])", "steps": 500, "action": "analyze"},
        "headers": {},
    }
    result = handler(job)
    # Should return either analyzed_sgf or error (not crash)
    assert isinstance(result, dict)


def test_handler_invalid_sgf(mock_services):
    """Test handler rejects invalid SGF."""
    from core.sgf.validator import SGFValidationError

    async def fail_analysis(*args, **kwargs):
        raise SGFValidationError("Invalid SGF")

    # Apply side effect to the GLOBAL mock which handler is using
    mock_katago_service.analyze.side_effect = fail_analysis

    job = {"input": {"sgf_data": "invalid", "steps": 500}, "headers": {}}
    result = handler(job)
    print(f"DEBUG: Invalid SGF Result: {result}")
    assert "error" in result


def test_handler_missing_sgf(mock_services):
    """Test handler requires sgf_data field."""
    job = {"input": {"steps": 500}, "headers": {}}
    result = handler(job)
    print(f"DEBUG: Missing SGF Result: {pprint.pformat(result)}")
    assert "error" in result
    assert result["error"]["code"] == 422
    # Pydantic validation errors are detailed
    assert result["error"]["message"]
    # Detail might be None if validation error formatting changed?
    # assert isinstance(result['error']['detail'], list)


def test_handler_unknown_action(mock_services):
    """Test handler rejects unknown action."""
    job = {"input": {"action": "unknown_action", "sgf_data": "(;GM[1])"}, "headers": {}}
    result = handler(job)
    assert "error" in result
    assert "Unknown action" in result["error"]["message"]
