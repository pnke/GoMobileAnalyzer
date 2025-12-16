"""
Rate Limiting Middleware with per-user/per-IP tracking.
"""

import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import config


class RateLimiter:
    """
    Token bucket rate limiter with sliding window.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.buckets: Dict[str, Deque[float]] = defaultdict(deque)
        self._cleanup_counter = 0
        self._cleanup_interval = 100  # Cleanup every N requests

    def _get_identifier(self, request: Request) -> str:
        """
        Get rate limit identifier for request.
        Prefers API key over IP address.
        """
        # Check for API key identifier set by auth middleware
        api_key_id = getattr(request.state, "api_key_id", None)
        if api_key_id:
            return f"key:{api_key_id}"

        # Fall back to IP address
        client_ip = "unknown"

        # Check X-Forwarded-For for proxied requests
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take first IP in chain (original client)
            client_ip = forwarded_for.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host

        return f"ip:{client_ip}"

    def is_allowed(self, request: Request) -> tuple[bool, Optional[int]]:
        """
        Check if request is allowed under rate limit.

        Returns:
            Tuple of (is_allowed, retry_after_seconds)
        """
        identifier = self._get_identifier(request)
        now = time.monotonic()

        # Get request timestamps for this identifier
        timestamps = self.buckets[identifier]

        # Remove expired timestamps
        while timestamps and (now - timestamps[0]) > self.window_seconds:
            timestamps.popleft()

        # Check if under limit
        if len(timestamps) >= self.max_requests:
            # Calculate retry-after
            oldest = timestamps[0]
            retry_after = int(self.window_seconds - (now - oldest)) + 1
            return False, retry_after

        # Record this request
        timestamps.append(now)

        # Periodic cleanup of stale identifiers
        self._maybe_cleanup()

        return True, None

    def _maybe_cleanup(self):
        """Periodically clean up stale buckets."""
        self._cleanup_counter += 1
        if self._cleanup_counter < self._cleanup_interval:
            return

        self._cleanup_counter = 0
        now = time.monotonic()

        # Find stale identifiers
        stale_keys = [
            key
            for key, timestamps in self.buckets.items()
            if not timestamps or (now - timestamps[-1]) > self.window_seconds * 2
        ]

        # Remove them
        for key in stale_keys:
            del self.buckets[key]


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""

    def __init__(
        self,
        app,
        max_requests: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ):
        super().__init__(app)
        self.limiter = RateLimiter(
            max_requests=max_requests or config.RATE_LIMIT_REQUESTS,
            window_seconds=window_seconds or config.RATE_LIMIT_WINDOW_SEC,
        )

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ("/health", "/ping"):
            return await call_next(request)

        is_allowed, retry_after = self.limiter.is_allowed(request)

        if not is_allowed:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after)},
                content={
                    "error": {
                        "code": 429,
                        "message": "Too many requests. Please retry later.",
                        "retry_after": retry_after,
                    }
                },
            )

        return await call_next(request)
