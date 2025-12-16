import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
import pytest

pytest.importorskip("fastapi", reason="FastAPI not installed")
from fastapi.testclient import TestClient  # noqa: E402

# Import the actual server module
server_path = Path(__file__).parent.parent
sys.path.insert(0, str(server_path))

from main import app  # noqa: E402
from services.katago_service import get_katago_service, KataGoService  # noqa: E402
from middleware.auth import verify_api_key  # noqa: E402


# Bypass authentication for all tests in this module
@pytest.fixture(autouse=True)
def bypass_auth():
    """Bypass API key authentication for testing."""
    app.dependency_overrides[verify_api_key] = lambda: "test_key"
    yield
    app.dependency_overrides.pop(verify_api_key, None)


client = TestClient(app)


def test_ping_endpoint():
    """Test the ping endpoint"""
    response = client.get("/ping")
    assert response.status_code == 200
    assert response.json() == {"message": "pong"}


def test_analyze_endpoint_missing_content():
    """Test analyze endpoint with missing SGF content"""
    response = client.post("/v1/analyses", json={"visits": 100})  # Missing sgf
    assert response.status_code == 422  # Validation error


def test_analyze_endpoint_success(sample_sgf_content):
    """Test analyze endpoint with valid SGF content"""
    # Mock the service
    mock_service = MagicMock(spec=KataGoService)
    # Since analyze is async in spec, it might be auto-mocked as AsyncMock or we usually set it explicitly for clarity
    mock_service.analyze = AsyncMock()
    mock_service.analyze.return_value = "(;GM[1]SZ[19]C[Analyzed])"

    # Override dependency
    app.dependency_overrides[get_katago_service] = lambda: mock_service

    response = client.post(
        "/v1/analyses", json={"sgf": sample_sgf_content, "visits": 100}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    data = response.json()
    assert data["data"]["sgf"] == "(;GM[1]SZ[19]C[Analyzed])"

    # Verify that service.analyze was called
    mock_service.analyze.assert_called_once()

    # Clean up
    app.dependency_overrides = {}


def test_analyze_endpoint_with_steps(sample_sgf_content):
    """Test analyze endpoint with custom steps parameter"""
    mock_service = MagicMock(spec=KataGoService)
    mock_service.analyze = AsyncMock()
    mock_service.analyze.return_value = "(;GM[1]SZ[19])"

    app.dependency_overrides[get_katago_service] = lambda: mock_service

    response = client.post(
        "/v1/analyses", json={"sgf": sample_sgf_content, "visits": 500}
    )

    assert response.status_code == 200
    mock_service.analyze.assert_called_once()

    # Check that the query sent to KataGo includes the correct visits
    args, kwargs = mock_service.analyze.call_args
    assert kwargs["visits"] == 500

    app.dependency_overrides = {}
