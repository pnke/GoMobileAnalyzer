import json
import logging
from unittest.mock import MagicMock
from logging_config import (
    get_correlation_id,
    set_correlation_id,
    StructuredLogger,
    StructuredFormatter,
    correlation_id_var,
)


def test_correlation_id_context():
    # Reset context
    token = correlation_id_var.set(None)
    try:
        assert get_correlation_id() is None
        set_correlation_id("test-id-123")
        assert get_correlation_id() == "test-id-123"
    finally:
        correlation_id_var.reset(token)


def test_structured_logger_process():
    # Test adapter logic
    mock_logger = MagicMock()
    adapter = StructuredLogger(mock_logger, {})

    # Passing extra kwargs
    msg, kwargs = adapter.process(
        "message", {"extra": {}, "sgf_size": 19, "other": "val"}
    )

    # Should move sgf_size to extra
    assert "sgf_size" not in kwargs
    assert kwargs["extra"]["sgf_size"] == 19
    # Should keep other
    assert kwargs["other"] == "val"


def test_structured_formatter():
    formatter = StructuredFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="path",
        lineno=1,
        msg="Test message",
        args=(),
        exc_info=None,
    )
    # Add extra data via adapter simulation
    record.extra_data = {"key": "value"}
    record.request_id = "req-1"

    # Mock correlation id
    token = correlation_id_var.set("corr-123")
    try:
        output = formatter.format(record)
        log = json.loads(output)

        assert log["message"] == "Test message"
        assert log["correlation_id"] == "corr-123"
        assert log["data"]["key"] == "value"
        assert log["request_id"] == "req-1"
        assert log["level"] == "INFO"
    finally:
        correlation_id_var.reset(token)
