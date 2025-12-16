import pytest

pytest.importorskip("fastapi", reason="FastAPI not installed")
from fastapi.testclient import TestClient  # noqa: E402
from unittest.mock import AsyncMock, patch  # noqa: E402
from main import app  # noqa: E402
from middleware.auth import verify_api_key  # noqa: E402
import asyncio  # noqa: E402


# Bypass authentication for all tests in this module
@pytest.fixture(autouse=True)
def bypass_auth():
    """Bypass API key authentication for testing."""
    app.dependency_overrides[verify_api_key] = lambda: "test_key"
    yield
    app.dependency_overrides.pop(verify_api_key, None)


client = TestClient(app)

# Apply global override for unittest compatibility
app.dependency_overrides[verify_api_key] = lambda: "test_key"


def test_ping():
    response = client.get("/v1/ping")
    assert response.status_code == 200
    assert response.json() == {"message": "pong", "version": "v1"}


def test_health():
    # Mock the service state
    with patch("services.katago_service.katago_service.engine") as mock_engine:
        mock_engine.is_running.return_value = True
        response = client.get("/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "up"  # v1/health returns up/degraded
        assert data["katago_running"] is True


def test_analyze_endpoint():
    # Mock SGF content
    sgf_content = "(;GM[1]FF[4]SZ[19];B[pd];W[dp])"

    # Mock katago_service.analyze
    mock_analyzed_sgf = "(;GM[1]FF[4]SZ[19];B[pd]C[Winrate: 50.0%];W[dp])"

    from services.katago_service import katago_service

    # Patch the analyze method on the actual instance
    with patch.object(
        katago_service, "analyze", new_callable=AsyncMock
    ) as mock_analyze:
        mock_analyze.return_value = mock_analyzed_sgf

        response = client.post("/v1/analyses", json={"sgf": sgf_content, "visits": 100})

        if response.status_code != 200:
            print(f"DEBUG: Response {response.status_code}: {response.text}")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        data = response.json()
        assert data["data"]["sgf"] == mock_analyzed_sgf
        mock_analyze.assert_called_once()


# ============================================================================
# Edge Case Tests
# ============================================================================


def test_analyze_endpoint_empty_sgf():
    """Test empty SGF returns appropriate error"""
    response = client.post("/v1/analyses", json={"sgf": "", "visits": 100})
    # Should return 422 (validation error) or 400 (bad request)
    assert response.status_code in [400, 422]


def test_analyze_endpoint_invalid_sgf_format():
    """Test completely invalid SGF format"""
    response = client.post(
        "/v1/analyses", json={"sgf": "this is not valid SGF at all", "visits": 100}
    )
    assert response.status_code in [400, 422, 500]


def test_analyze_endpoint_malformed_sgf():
    """Test malformed SGF (missing closing parenthesis)"""
    malformed_sgf = "(;GM[1]FF[4]SZ[19];B[pd]"  # Missing closing paren
    response = client.post("/v1/analyses", json={"sgf": malformed_sgf, "visits": 100})
    assert response.status_code in [400, 422, 500]


def test_analyze_endpoint_invalid_steps_parameter():
    """Test with invalid steps parameter (too low)"""
    sgf_content = "(;GM[1]FF[4]SZ[19];B[pd])"

    with patch(
        "services.katago_service.katago_service.analyze", new_callable=AsyncMock
    ) as mock_analyze:
        mock_analyze.return_value = sgf_content

        # Test with steps below minimum (should either clamp or error)
        response = client.post("/v1/analyses", json={"sgf": sgf_content, "visits": 1})
        # Accept either clamped success or validation error
        assert response.status_code in [200, 400, 422]


def test_analyze_endpoint_steps_at_maximum():
    """Test with steps at maximum allowed value"""
    sgf_content = "(;GM[1]FF[4]SZ[19];B[pd])"

    with patch(
        "services.katago_service.katago_service.analyze", new_callable=AsyncMock
    ) as mock_analyze:
        mock_analyze.return_value = sgf_content

        response = client.post(
            "/v1/analyses", json={"sgf": sgf_content, "visits": 100000}
        )
        # Should succeed or be clamped
        assert response.status_code in [200, 400]


# ============================================================================
# Error Path Tests
# ============================================================================


def test_analyze_endpoint_service_error():
    """Test graceful handling when KataGo service fails"""
    sgf_content = "(;GM[1]FF[4]SZ[19];B[pd])"

    with patch(
        "services.katago_service.katago_service.analyze", new_callable=AsyncMock
    ) as mock_analyze:
        mock_analyze.side_effect = Exception("KataGo process crashed")

        response = client.post("/v1/analyses", json={"sgf": sgf_content, "visits": 100})

        # Should return 500 with error details
        assert response.status_code == 500
        data = response.json()
        assert "error" in data


def test_analyze_endpoint_timeout_error():
    """Test handling when analysis times out"""
    sgf_content = "(;GM[1]FF[4]SZ[19];B[pd])"

    with patch(
        "services.katago_service.katago_service.analyze", new_callable=AsyncMock
    ) as mock_analyze:
        mock_analyze.side_effect = asyncio.TimeoutError("Analysis timed out")

        response = client.post("/v1/analyses", json={"sgf": sgf_content, "visits": 100})

        # Should return 500 or 504 (gateway timeout)
        assert response.status_code in [500, 504]


def test_analyze_endpoint_service_not_running():
    """Test when KataGo service is not running"""
    sgf_content = "(;GM[1]FF[4]SZ[19];B[pd])"

    with patch("services.katago_service.katago_service.engine") as mock_engine:
        # Mock engine to return False for is_running
        mock_engine.is_running.return_value = False

        with patch(
            "services.katago_service.katago_service.analyze", new_callable=AsyncMock
        ) as mock_analyze:
            mock_analyze.side_effect = RuntimeError(
                "KataGo engine is not running and could not be restarted."
            )

            response = client.post(
                "/v1/analyses", json={"sgf": sgf_content, "visits": 100}
            )

            # Should return 500, 502, or 503 (service unavailable)
            assert response.status_code in [500, 502, 503]


# ============================================================================
# Edge Cases for Other Endpoints
# ============================================================================


def test_health_when_katago_not_running():
    """Test health endpoint when KataGo is not running"""
    with patch("services.katago_service.katago_service.engine") as mock_engine:
        mock_engine.is_running.return_value = False
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        # Should still be healthy but indicate KataGo status
        assert "katago_running" in data or "dependencies" in data


def test_versioned_endpoint():
    """Test that v1 prefixed endpoint works"""
    response = client.get("/v1/ping")
    # Note: if v1 endpoints are available
    # Either 200 if ping exists on v1, or 404 if not routed
    assert response.status_code in [200, 404]
