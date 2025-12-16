import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import HTTPException
from fastapi.testclient import TestClient
from core.errors import AppException

# Mock the startup dependencies before importing main
with (
    patch("main.setup_logging"),
    patch("main.katago_service"),
    patch("main.init_recognizer"),
):
    from main import app, lifespan


@pytest.fixture
def test_client():
    """Create test client."""
    return TestClient(app)


@pytest.mark.asyncio
async def test_lifespan_katago_configured():
    """Test lifespan with KataGo configured."""
    mock_app = MagicMock()

    with (
        patch("main.config.validate_katago_paths", return_value=True),
        patch("main.katago_service") as mock_katago,
        patch("main.init_recognizer") as mock_init,
        patch("main.logger") as mock_logger,
    ):
        mock_katago.start = AsyncMock()
        mock_katago.stop = AsyncMock()

        async with lifespan(mock_app):
            # Startup should call start
            mock_katago.start.assert_called_once()
            mock_init.assert_called_once()
            mock_logger.info.assert_called()

        # Shutdown should call stop
        mock_katago.stop.assert_called_once()


@pytest.mark.asyncio
async def test_lifespan_katago_not_configured():
    """Test lifespan when KataGo is not configured."""
    mock_app = MagicMock()

    with (
        patch("main.config.validate_katago_paths", return_value=False),
        patch("main.katago_service") as mock_katago,
        patch("main.init_recognizer") as mock_init,
        patch("main.logger") as mock_logger,
    ):
        mock_katago.start = AsyncMock()
        mock_katago.stop = AsyncMock()

        async with lifespan(mock_app):
            # Should not start KataGo
            mock_katago.start.assert_not_called()
            # Should still init recognizer
            mock_init.assert_called_once()
            # Should log warning
            assert any(
                "not configured" in str(call)
                for call in mock_logger.warning.call_args_list
            )

        # Should still call stop on shutdown
        mock_katago.stop.assert_called_once()


def test_request_id_middleware(test_client):
    """Test request ID is added to responses."""
    response = test_client.get("/health")

    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0


@pytest.mark.asyncio
async def test_app_exception_handler():
    """Test AppException is handled correctly."""
    from main import app_exception_handler

    mock_request = MagicMock()
    mock_request.state.request_id = "test-request-id"

    exc = AppException(status_code=400, message="Test error", detail="Test detail")

    response = await app_exception_handler(mock_request, exc)

    assert response.status_code == 400
    body = response.body.decode()
    assert "Test error" in body
    assert "Test detail" in body


@pytest.mark.asyncio
async def test_http_exception_handler():
    """Test HTTPException is handled correctly."""
    from main import http_exception_handler

    mock_request = MagicMock()
    mock_request.state.request_id = "test-request-id"

    exc = HTTPException(status_code=404, detail="Not found")

    response = await http_exception_handler(mock_request, exc)

    assert response.status_code == 404
    body = response.body.decode()
    assert "Not found" in body


@pytest.mark.asyncio
async def test_unhandled_exception_handler():
    """Test unhandled exceptions are caught."""
    from main import unhandled_exception_handler

    mock_request = MagicMock()
    mock_request.state.request_id = "test-request-id"

    exc = ValueError("Unexpected error")

    with patch("main.logger") as mock_logger:
        response = await unhandled_exception_handler(mock_request, exc)

        assert response.status_code == 500
        body = response.body.decode()
        assert "Internal server error" in body

        # Should log the exception
        mock_logger.exception.assert_called_once()


def test_health_check_katago_running(test_client):
    """Test health check when KataGo is running."""
    with patch("main.katago_service.is_running", return_value=True):
        response = test_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "1.0.0"
        assert data["dependencies"]["katago"] == "running"


def test_health_check_katago_stopped(test_client):
    """Test health check when KataGo is stopped."""
    with patch("main.katago_service.is_running", return_value=False):
        response = test_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["dependencies"]["katago"] == "stopped"


def test_ping_endpoint(test_client):
    """Test ping endpoint."""
    response = test_client.get("/ping")

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "pong"


def test_middlewares_loaded():
    """Test that all middlewares are loaded."""
    # Check that middlewares are in the app
    middleware_names = [m.__class__.__name__ for m in app.user_middleware]

    # Should have CORS, BodySizeLimit, RateLimiter, CorrelationId
    assert len(middleware_names) >= 3
