import pytest
import time
from unittest.mock import MagicMock, AsyncMock
from fastapi import Request
from fastapi.responses import JSONResponse
from middleware.rate_limit import RateLimiter, RateLimiterMiddleware


@pytest.fixture
def mock_request():
    """Create a mock request."""
    request = MagicMock(spec=Request)
    request.client = MagicMock()
    request.client.host = "127.0.0.1"
    request.headers = {}
    request.state = MagicMock()
    request.url = MagicMock()
    request.url.path = "/api/test"
    return request


def test_rate_limiter_init():
    """Test RateLimiter initialization."""
    limiter = RateLimiter(max_requests=10, window_seconds=60)

    assert limiter.max_requests == 10
    assert limiter.window_seconds == 60
    assert limiter._cleanup_interval == 100
    assert limiter._cleanup_counter == 0


def test_get_identifier_with_api_key(mock_request):
    """Test identifier uses API key when available."""
    limiter = RateLimiter(max_requests=10, window_seconds=60)
    mock_request.state.api_key_id = "test-key-123"

    identifier = limiter._get_identifier(mock_request)

    assert identifier == "key:test-key-123"


def test_get_identifier_with_forwarded_for(mock_request):
    """Test identifier uses X-Forwarded-For header."""
    limiter = RateLimiter(max_requests=10, window_seconds=60)
    mock_request.state.api_key_id = None
    mock_request.headers = {"X-Forwarded-For": "192.168.1.100, 10.0.0.1"}

    identifier = limiter._get_identifier(mock_request)

    assert identifier == "ip:192.168.1.100"


def test_get_identifier_with_client_ip(mock_request):
    """Test identifier fallback to client IP."""
    limiter = RateLimiter(max_requests=10, window_seconds=60)
    mock_request.state.api_key_id = None

    identifier = limiter._get_identifier(mock_request)

    assert identifier == "ip:127.0.0.1"


def test_get_identifier_no_client(mock_request):
    """Test identifier when no client info available."""
    limiter = RateLimiter(max_requests=10, window_seconds=60)
    mock_request.state.api_key_id = None
    mock_request.client = None

    identifier = limiter._get_identifier(mock_request)

    assert identifier == "ip:unknown"


def test_is_allowed_under_limit(mock_request):
    """Test requests allowed under rate limit."""
    limiter = RateLimiter(max_requests=5, window_seconds=60)

    for i in range(5):
        allowed, retry_after = limiter.is_allowed(mock_request)
        assert allowed is True
        assert retry_after is None


def test_is_allowed_exceeds_limit(mock_request):
    """Test request blocked when exceeding limit."""
    limiter = RateLimiter(max_requests=3, window_seconds=60)

    # Use up all requests
    for i in range(3):
        limiter.is_allowed(mock_request)

    # Next request should be blocked
    allowed, retry_after = limiter.is_allowed(mock_request)

    assert allowed is False
    assert retry_after is not None
    assert retry_after > 0


def test_is_allowed_window_expiry(mock_request):
    """Test that old requests expire after window."""
    limiter = RateLimiter(max_requests=2, window_seconds=1)

    # Use up limit
    limiter.is_allowed(mock_request)
    limiter.is_allowed(mock_request)

    # Wait for window to expire
    time.sleep(1.1)

    # Should be allowed again
    allowed, retry_after = limiter.is_allowed(mock_request)
    assert allowed is True
    assert retry_after is None


def test_cleanup_triggers_after_interval(mock_request):
    """Test periodic cleanup of stale buckets."""
    limiter = RateLimiter(max_requests=10, window_seconds=1)
    limiter._cleanup_interval = 5

    # Generate some requests
    for i in range(5):
        limiter.is_allowed(mock_request)

    # Cleanup should have triggered and reset counter to 0
    assert limiter._cleanup_counter == 0


def test_cleanup_removes_stale_buckets(mock_request):
    """Test cleanup removes old inactive buckets."""
    limiter = RateLimiter(max_requests=10, window_seconds=1)

    # Create a bucket
    limiter.is_allowed(mock_request)
    identifier = limiter._get_identifier(mock_request)
    assert identifier in limiter.buckets

    # Wait for bucket to become stale (2x window)
    time.sleep(2.5)

    # Force cleanup
    limiter._cleanup_counter = limiter._cleanup_interval
    limiter._maybe_cleanup()

    # Bucket should be removed
    assert identifier not in limiter.buckets


@pytest.mark.asyncio
async def test_middleware_init():
    """Test middleware initialization."""
    app = MagicMock()
    middleware = RateLimiterMiddleware(app, max_requests=100, window_seconds=60)

    assert middleware.limiter.max_requests == 100
    assert middleware.limiter.window_seconds == 60


@pytest.mark.asyncio
async def test_middleware_skips_health_checks():
    """Test middleware skips rate limiting for health endpoints."""
    app = MagicMock()
    middleware = RateLimiterMiddleware(app, max_requests=1, window_seconds=60)

    request = MagicMock(spec=Request)
    request.url.path = "/health"

    call_next = AsyncMock(return_value="response")

    result = await middleware.dispatch(request, call_next)

    assert result == "response"
    call_next.assert_called_once()


@pytest.mark.asyncio
async def test_middleware_allows_request_under_limit():
    """Test middleware allows requests under limit."""
    app = MagicMock()
    middleware = RateLimiterMiddleware(app, max_requests=10, window_seconds=60)

    request = MagicMock(spec=Request)
    request.url.path = "/api/test"
    request.client = MagicMock()
    request.client.host = "127.0.0.1"
    request.headers = {}
    request.state = MagicMock()
    request.state.api_key_id = None

    call_next = AsyncMock(return_value="response")

    result = await middleware.dispatch(request, call_next)

    assert result == "response"


@pytest.mark.asyncio
async def test_middleware_blocks_request_over_limit():
    """Test middleware blocks requests exceeding limit."""
    app = MagicMock()
    middleware = RateLimiterMiddleware(app, max_requests=2, window_seconds=60)

    request = MagicMock(spec=Request)
    request.url.path = "/api/test"
    request.client = MagicMock()
    request.client.host = "127.0.0.1"
    request.headers = {}
    request.state = MagicMock()
    request.state.api_key_id = None

    call_next = AsyncMock(return_value="response")

    # Use up limit
    await middleware.dispatch(request, call_next)
    await middleware.dispatch(request, call_next)

    # Next should be blocked
    result = await middleware.dispatch(request, call_next)

    assert isinstance(result, JSONResponse)
    assert result.status_code == 429
    assert "Retry-After" in result.headers


@pytest.mark.asyncio
async def test_middleware_skip_ping_endpoint():
    """Test middleware skips /ping endpoint."""
    app = MagicMock()
    middleware = RateLimiterMiddleware(app, max_requests=1, window_seconds=60)

    request = MagicMock(spec=Request)
    request.url.path = "/ping"

    call_next = AsyncMock(return_value="pong")

    result = await middleware.dispatch(request, call_next)

    assert result == "pong"


def test_multiple_identifiers_separate_limits(mock_request):
    """Test different identifiers have separate rate limits."""
    limiter = RateLimiter(max_requests=2, window_seconds=60)

    # First identifier
    mock_request.state.api_key_id = "key1"
    limiter.is_allowed(mock_request)
    limiter.is_allowed(mock_request)
    allowed, _ = limiter.is_allowed(mock_request)
    assert allowed is False  # Blocked

    # Different identifier should still be allowed
    mock_request.state.api_key_id = "key2"
    allowed, _ = limiter.is_allowed(mock_request)
    assert allowed is True
