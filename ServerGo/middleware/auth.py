"""
API Key Authentication Middleware
"""

import secrets
from typing import Optional

from fastapi import Request, HTTPException, Depends
from fastapi.security import APIKeyHeader

from config import config

# Header name for API key
API_KEY_HEADER_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=False)


async def verify_api_key(
    request: Request, api_key: Optional[str] = Depends(api_key_header)
) -> Optional[str]:
    """
    Verify the API key from request header.

    If API_KEY is not configured, authentication is skipped (dev mode).
    If REQUIRE_API_KEY is True but no API_KEY is configured, all requests fail.

    Args:
        request: FastAPI request object
        api_key: API key from X-API-Key header

    Returns:
        The validated API key or None if auth is disabled

    Raises:
        HTTPException: If authentication fails
    """
    expected_key = config.API_KEY

    # If no API key is configured
    if not expected_key:
        if config.REQUIRE_API_KEY:
            # Misconfiguration: require auth but no key set
            raise HTTPException(
                status_code=500, detail="Server authentication misconfigured"
            )
        # Auth disabled, allow request
        return None

    # Auth is enabled, key is required
    if not api_key:
        raise HTTPException(
            status_code=401, detail="Missing API key. Provide X-API-Key header."
        )

    # Constant-time comparison to prevent timing attacks
    if not secrets.compare_digest(api_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Store validated key identifier in request state (for logging/rate limiting)
    request.state.api_key_id = api_key[:8] + "..."  # Don't store full key

    return api_key


class OptionalAPIKeyAuth:
    """
    Dependency that makes API key auth optional.
    Used for endpoints that work with or without auth.
    """

    async def __call__(
        self, request: Request, api_key: Optional[str] = Depends(api_key_header)
    ) -> Optional[str]:
        """
        Verify API key if provided, but don't require it.
        """
        if not api_key:
            return None

        expected_key = config.API_KEY
        if not expected_key:
            return None

        if secrets.compare_digest(api_key, expected_key):
            request.state.api_key_id = api_key[:8] + "..."
            return api_key

        # Invalid key provided - still fail
        raise HTTPException(status_code=401, detail="Invalid API key")


optional_api_key = OptionalAPIKeyAuth()
