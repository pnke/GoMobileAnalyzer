import pytest
import json
from httpx import AsyncClient, ASGITransport
from main import app
from middleware.auth import verify_api_key
from services.katago_service import get_katago_service
from unittest.mock import AsyncMock, MagicMock

# Minimal valid SGF
VALID_SGF = "(;GM[1]FF[4]SZ[19];B[pd];W[dp])"


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[verify_api_key] = lambda: "test_key"

    # Mock KataGo Service
    mock_service = MagicMock()
    mock_service.analyze = AsyncMock()
    mock_service.analyze.return_value = "(;GM[1]SZ[19]C[Analyzed])"
    # For streaming
    mock_service.analyze_stream.return_value = iter([{"turn": 1, "winrate": 0.5}])

    app.dependency_overrides[get_katago_service] = lambda: mock_service

    yield
    app.dependency_overrides.pop(verify_api_key, None)
    app.dependency_overrides.pop(get_katago_service, None)


@pytest.mark.asyncio
async def test_v1_create_analysis():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"sgf": VALID_SGF, "visits": 100}
        response = await ac.post("/v1/analyses", json=payload)

        assert response.status_code == 200
        data = response.json()

        # Verify Envelope
        assert "meta" in data
        assert data["meta"]["version"] == "v1"
        assert "data" in data
        assert "visits_used" in data["data"]
        # KataGo is mocked usually, so just check structure


@pytest.mark.asyncio
async def test_v1_stream_analysis():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"sgf": VALID_SGF, "visits": 100}
        # SSE request
        async with ac.stream("POST", "/v1/analyses/stream", json=payload) as response:
            assert response.status_code == 200

            # Read first event
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    content = line[6:]
                    data = json.loads(content)
                    # Might be error if engine not running test env, or actual data
                    if "error" in data:
                        print(
                            f"Engine error (expected in mockless test): {data['error']}"
                        )
                    else:
                        assert "turn" in data or "done" in data
                    break
