import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import sys
from pathlib import Path

# Add ServerGo to path
server_path = Path(__file__).parent.parent
sys.path.insert(0, str(server_path))

from services.katago_service import KataGoService  # noqa: E402
from core.analysis.async_engine import AsyncKataGoEngine  # noqa: E402


@pytest.mark.asyncio
async def test_analyze_success():
    """Test successful analysis using mocked engine"""
    # Pass a dummy factory, we will mock the engine property directly anyway
    mock_config = MagicMock()
    mock_config.KATAGO_TIMEOUT_SEC = 120
    service = KataGoService(lambda: MagicMock(), mock_config)

    # Mock the engine - Use spec=AsyncKataGoEngine so isinstance checks work
    mock_engine = MagicMock(spec=AsyncKataGoEngine)
    mock_engine.is_running.return_value = True
    # AsyncMock for analyze because it is awaited directly
    mock_engine.analyze = AsyncMock(return_value="(;GM[1]SZ[19]C[Analysis Result])")

    service.engine = mock_engine

    # We rely on the real run_in_executor to call our mock
    result = await service.analyze("(;GM[1]SZ[19])")

    assert "(;GM[1]SZ[19]C[Analysis Result])" == result
    mock_engine.analyze.assert_called_once()


@pytest.mark.asyncio
async def test_analyze_restart_failure():
    """Test analysis when KataGo fails to start (simulated)"""
    mock_config = MagicMock()
    service = KataGoService(lambda: MagicMock(), mock_config)
    service.engine = None  # Not running

    # Mock start() to NOT start the engine (simulate failure to recover)
    with patch.object(service, "start", new_callable=AsyncMock) as mock_start:
        with pytest.raises(RuntimeError, match="KataGo engine is not running"):
            await service.analyze("(;GM[1]SZ[19])")

        mock_start.assert_called_once()


@pytest.mark.asyncio
async def test_analyze_auto_restart():
    """Test that analyze attempts to start engine if not running"""
    mock_config = MagicMock()
    mock_config.KATAGO_TIMEOUT_SEC = 120
    service = KataGoService(lambda: MagicMock(), mock_config)
    service.engine = None

    # Mock start() to successfully start the engine
    async def mock_start_side_effect():
        mock_engine = MagicMock(spec=AsyncKataGoEngine)
        mock_engine.is_running.return_value = True
        mock_engine.analyze = AsyncMock(return_value="(;GM[1]SZ[19]C[Recovered])")
        service.engine = mock_engine

    with patch.object(
        service, "start", side_effect=mock_start_side_effect
    ) as mock_start:
        result = await service.analyze("(;GM[1]SZ[19])")

        assert "Recovered" in result
        mock_start.assert_called_once()
