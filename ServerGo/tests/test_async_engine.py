import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from core.analysis.async_engine import AsyncKataGoEngine

# Mock config paths
KATAGO_PATH = "katago"
CONFIG_PATH = "config.cfg"
MODEL_PATH = "model.bin"


@pytest.fixture
def mock_engine():
    """Create an AsyncKataGoEngine with mocked sync engine."""
    with patch("core.analysis.async_engine.SyncKataGoEngine") as MockSyncEngine:
        mock_sync = MagicMock()
        MockSyncEngine.return_value = mock_sync
        engine = AsyncKataGoEngine(KATAGO_PATH, CONFIG_PATH, MODEL_PATH)
        engine._mock_sync = mock_sync
        yield engine


@pytest.mark.asyncio
async def test_start_engine(mock_engine):
    """Test that start() calls the sync engine's start() method via asyncio.to_thread."""
    mock_engine._mock_sync.start = MagicMock()

    with patch("asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
        await mock_engine.start()
        mock_to_thread.assert_called_once_with(mock_engine.sync_engine.start)


@pytest.mark.asyncio
async def test_analyze_raises_not_implemented(mock_engine):
    """Test that analyze() raises NotImplementedError as we use streaming instead."""
    with pytest.raises(NotImplementedError, match="Use analyze_streaming instead"):
        await mock_engine.analyze("(;GM[1])", visits=10)


@pytest.mark.asyncio
async def test_analyze_streaming_flow(mock_engine):
    """Test that analyze_streaming correctly bridges sync generator to async generator."""
    # Setup mock sync engine generator
    mock_results = [
        {"turn": 0, "winrate": 50.0, "score": 0.5},
        {"turn": 1, "winrate": 55.0, "score": 1.0},
    ]

    def mock_generator(*args, **kwargs):
        for result in mock_results:
            yield result

    mock_engine._mock_sync.analyze_streaming_generator = mock_generator
    mock_engine._mock_sync.is_running.return_value = True

    # Collect results
    results = []
    async for res in mock_engine.analyze_streaming("(;GM[1];B[dp];W[pd])", visits=10):
        results.append(res)

    assert len(results) == 2
    assert results[0]["winrate"] == 50.0
    assert results[1]["winrate"] == 55.0


@pytest.mark.asyncio
async def test_analyze_streaming_handles_exception(mock_engine):
    """Test that exceptions in sync generator are propagated."""

    def mock_generator(*args, **kwargs):
        yield {"turn": 0, "winrate": 50.0}
        raise RuntimeError("KataGo error: Test error")

    mock_engine._mock_sync.analyze_streaming_generator = mock_generator
    mock_engine._mock_sync.is_running.return_value = True

    results = []
    with pytest.raises(RuntimeError, match="KataGo error"):
        async for res in mock_engine.analyze_streaming("(;GM[1])", visits=10):
            results.append(res)

    # Should have received the first result before error
    assert len(results) == 1


def test_close_delegates_to_sync_engine(mock_engine):
    """Test that close() calls the sync engine's close() method."""
    mock_engine.close()
    mock_engine._mock_sync.close.assert_called_once()


def test_is_running_delegates_to_sync_engine(mock_engine):
    """Test that is_running() returns sync engine's is_running()."""
    mock_engine._mock_sync.is_running.return_value = True
    assert mock_engine.is_running() is True

    mock_engine._mock_sync.is_running.return_value = False
    assert mock_engine.is_running() is False
