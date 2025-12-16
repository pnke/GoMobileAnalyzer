"""
Structured Logging Configuration

Provides JSON logging for production and human-readable format for development.
Includes correlation ID support for request tracing.
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Optional, MutableMapping
import contextvars

# Context variable for correlation ID (thread-safe)
correlation_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)


def get_correlation_id() -> Optional[str]:
    """Get the current correlation ID from context."""
    return correlation_id_var.get()


def set_correlation_id(correlation_id: str) -> None:
    """Set the correlation ID in context."""
    correlation_id_var.set(correlation_id)


class StructuredFormatter(logging.Formatter):
    """
    JSON formatter for structured logging in production.
    Outputs logs as single-line JSON objects.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add correlation ID if available
        correlation_id = get_correlation_id()
        if correlation_id:
            log_entry["correlation_id"] = correlation_id

        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Add extra data if provided via record
        if hasattr(record, "extra_data") and record.extra_data:
            log_entry["data"] = record.extra_data

        # Add standard extra attributes
        for key in ["request_id", "sgf_size", "steps", "duration_ms", "status_code"]:
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        return json.dumps(log_entry, default=str)


class DevelopmentFormatter(logging.Formatter):
    """
    Human-readable formatter for development.
    Uses colors and readable layout.
    """

    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.RESET)

        # Build readable format
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        level = f"{color}{record.levelname:8}{self.RESET}"

        # Add correlation ID if present
        correlation_id = get_correlation_id()
        correlation_part = f" [{correlation_id[:8]}]" if correlation_id else ""

        message = record.getMessage()

        # Format: TIME | LEVEL | [CORR_ID] logger - message
        formatted = f"{timestamp} | {level}{correlation_part} {record.name} - {message}"

        # Add extra attributes
        extras = []
        for key in ["request_id", "sgf_size", "steps", "duration_ms", "status_code"]:
            if hasattr(record, key):
                extras.append(f"{key}={getattr(record, key)}")

        if extras:
            formatted += f" ({', '.join(extras)})"

        # Add exception if present
        if record.exc_info:
            formatted += f"\n{self.formatException(record.exc_info)}"

        return formatted


class StructuredLogger(logging.LoggerAdapter):
    """
    Logger adapter that allows passing extra structured data easily.

    Usage:
        logger.info("Analysis complete", sgf_size=1024, duration_ms=150)
    """

    def process(self, msg: str, kwargs: MutableMapping[str, Any]) -> tuple[str, dict]:
        # Extract custom keys and add them to extra
        extra = kwargs.get("extra", {})
        custom_keys = [
            "request_id",
            "sgf_size",
            "steps",
            "duration_ms",
            "status_code",
            "extra_data",
        ]

        for key in custom_keys:
            if key in kwargs:
                extra[key] = kwargs.pop(key)

        kwargs["extra"] = extra
        return msg, dict(kwargs)


def get_structured_logger(name: str) -> StructuredLogger:
    """Get a structured logger by name."""
    return StructuredLogger(logging.getLogger(name), {})


def setup_logging() -> None:
    """
    Configures the logging for the application.

    Uses JSON format in production (LOG_FORMAT=json or not DEV).
    Uses human-readable format in development (DEV=true and LOG_FORMAT!=json).
    """
    # Determine environment
    is_dev = os.environ.get("DEV", "").lower() in ("true", "1", "yes")
    log_format = os.environ.get("LOG_FORMAT", "auto").lower()
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()

    # Choose formatter
    formatter: logging.Formatter
    if log_format == "json" or (log_format == "auto" and not is_dev):
        formatter = StructuredFormatter()
    else:
        formatter = DevelopmentFormatter()

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Add new handler with our formatter
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # Set level for third-party libraries to reduce noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
