"""
Correlation ID Middleware

Adds request tracing via X-Correlation-ID header.
- Forwards existing correlation ID from request
- Generates new UUID if not present
- Injects into logging context for all request logs
"""

import uuid
import logging
from contextvars import ContextVar
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from logging_config import set_correlation_id as set_log_correlation_id

# Context variable for correlation ID (thread-safe)
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")

logger = logging.getLogger(__name__)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Middleware to add correlation ID to requests."""

    HEADER_NAME = "X-Correlation-ID"

    async def dispatch(self, request: Request, call_next):
        # Get existing correlation ID or generate new one
        correlation_id = request.headers.get(self.HEADER_NAME) or str(uuid.uuid4())

        # Store in both context variables (middleware and logging)
        correlation_id_var.set(correlation_id)
        set_log_correlation_id(correlation_id)

        # Add to request state for access in routes
        request.state.correlation_id = correlation_id

        # Log request with correlation ID
        logger.info(
            "Request started",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
            },
        )

        # Process request
        response = await call_next(request)

        # Add correlation ID to response headers
        response.headers[self.HEADER_NAME] = correlation_id

        # Log response
        logger.info(
            "Request completed",
            extra={
                "correlation_id": correlation_id,
                "status_code": response.status_code,
            },
        )

        return response


def get_correlation_id() -> str:
    """Get the current correlation ID from context."""
    return correlation_id_var.get()


class CorrelationIdFilter(logging.Filter):
    """Logging filter to add correlation ID to log records."""

    def filter(self, record):
        record.correlation_id = get_correlation_id() or "-"
        return True
