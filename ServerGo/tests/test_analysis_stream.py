import pytest
from httpx import AsyncClient, ASGITransport
from main import app


from middleware.auth import verify_api_key


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[verify_api_key] = lambda: "test_key"
    yield
    app.dependency_overrides.pop(verify_api_key, None)


@pytest.mark.asyncio
async def test_analysis_stream_connection():
    # Using AsyncClient for SSE endpoint testing
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Note: SSE testing with standard clients is tricky; usually we test the generator logic or just connection
        # Here we just check if it accepts the connection.
        # For a real stream test, we might need a specialized SSE client or just verify the endpoint exists/doesn't 404.
        response = await ac.post(
            "/v1/analyses/stream", json={"sgf": "(;GM[1]SZ[19])", "visits": 100}
        )
        # Note: Depending on mock setup, this might return streaming response or something else.
        # But we check status code to be success-like or validation error if something else is missing.
        assert response.status_code in [200, 307]
