"""
Tests for authentication middleware
"""

import pytest
from unittest.mock import patch

pytest.importorskip("fastapi", reason="FastAPI not installed")
from fastapi import FastAPI, Depends  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# Mock config before importing middleware
with patch.dict("os.environ", {"API_KEY": "test-secret-key"}):
    from middleware.auth import verify_api_key, optional_api_key


@pytest.fixture
def app_with_auth():
    """Create test app with auth middleware."""
    app = FastAPI()

    @app.get("/protected")
    async def protected_route(api_key: str = Depends(verify_api_key)):
        return {"message": "success", "key": api_key[:8] if api_key else None}

    @app.get("/optional")
    async def optional_route(api_key: str = Depends(optional_api_key)):
        return {"message": "success", "authenticated": api_key is not None}

    return app


class TestAuthMiddleware:
    """Test suite for authentication middleware."""

    def test_valid_api_key(self, app_with_auth):
        """Test that valid API key passes authentication."""
        client = TestClient(app_with_auth)

        with patch("middleware.auth.config") as mock_config:
            mock_config.API_KEY = "test-secret-key"
            mock_config.REQUIRE_API_KEY = False

            response = client.get(
                "/protected", headers={"X-API-Key": "test-secret-key"}
            )

            assert response.status_code == 200
            assert response.json()["message"] == "success"

    def test_missing_api_key(self, app_with_auth):
        """Test that missing API key returns 401."""
        client = TestClient(app_with_auth)

        with patch("middleware.auth.config") as mock_config:
            mock_config.API_KEY = "test-secret-key"
            mock_config.REQUIRE_API_KEY = False

            response = client.get("/protected")

            assert response.status_code == 401
            assert "Missing API key" in response.json()["detail"]

    def test_invalid_api_key(self, app_with_auth):
        """Test that invalid API key returns 401."""
        client = TestClient(app_with_auth)

        with patch("middleware.auth.config") as mock_config:
            mock_config.API_KEY = "test-secret-key"
            mock_config.REQUIRE_API_KEY = False

            response = client.get("/protected", headers={"X-API-Key": "wrong-key"})

            assert response.status_code == 401
            assert "Invalid API key" in response.json()["detail"]

    def test_auth_disabled_when_no_key_configured(self, app_with_auth):
        """Test that auth is disabled when no API_KEY is configured."""
        client = TestClient(app_with_auth)

        with patch("middleware.auth.config") as mock_config:
            mock_config.API_KEY = None
            mock_config.REQUIRE_API_KEY = False

            response = client.get("/protected")

            assert response.status_code == 200

    def test_optional_auth_without_key(self, app_with_auth):
        """Test that optional auth allows requests without key."""
        client = TestClient(app_with_auth)

        with patch("middleware.auth.config") as mock_config:
            mock_config.API_KEY = "test-secret-key"

            response = client.get("/optional")

            assert response.status_code == 200
            assert response.json()["authenticated"] is False

    def test_optional_auth_with_valid_key(self, app_with_auth):
        """Test that optional auth accepts valid key."""
        client = TestClient(app_with_auth)

        with patch("middleware.auth.config") as mock_config:
            mock_config.API_KEY = "test-secret-key"

            response = client.get("/optional", headers={"X-API-Key": "test-secret-key"})

            assert response.status_code == 200
            assert response.json()["authenticated"] is True
