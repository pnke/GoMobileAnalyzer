import pytest
from unittest.mock import MagicMock, patch


# Robust import
try:
    from core.analysis.async_engine import AsyncKataGoEngine
except ImportError:
    import sys

    sys.modules["core.sgf.parser"] = MagicMock()
    from core.analysis.async_engine import AsyncKataGoEngine


@pytest.fixture
def mock_engine():
    """Create an AsyncKataGoEngine with mocked sync engine."""
    with patch("core.analysis.async_engine.SyncKataGoEngine") as MockSyncEngine:
        mock_sync = MagicMock()
        MockSyncEngine.return_value = mock_sync
        engine = AsyncKataGoEngine("katago", "config", "model")
        engine._mock_sync = mock_sync
        yield engine


@pytest.mark.asyncio
async def test_streaming_propagates_katago_errors(mock_engine):
    """
    Test that KataGo error responses (like 'Illegal move') are correctly
    propagated as RuntimeErrors through the streaming interface.
    """

    def mock_generator(*args, **kwargs):
        yield {"turn": 0, "winrate": 50.0}
        raise RuntimeError("KataGo error: Illegal move 0: D4 (field: moves)")

    mock_engine._mock_sync.analyze_streaming_generator = mock_generator
    mock_engine._mock_sync.is_running.return_value = True

    results = []
    with pytest.raises(RuntimeError) as exc_info:
        async for res in mock_engine.analyze_streaming("(;GM[1])", visits=10):
            results.append(res)

    # Check first result was received
    assert len(results) == 1
    # Check error message
    assert "KataGo error: Illegal move 0: D4" in str(exc_info.value)


@pytest.mark.asyncio
async def test_analyze_raises_not_implemented(mock_engine):
    """
    Test that analyze() raises NotImplementedError since we use streaming.
    The old implementation would propagate errors, but the new wrapper
    doesn't support non-streaming analysis.
    """
    with pytest.raises(NotImplementedError, match="Use analyze_streaming instead"):
        await mock_engine.analyze("(;GM[1])", visits=10)


@pytest.mark.asyncio
async def test_streaming_handles_process_not_running(mock_engine):
    """
    Test that appropriate error is raised when process is not running.
    """

    def mock_generator(*args, **kwargs):
        raise RuntimeError("KataGo process is not running.")
        yield  # Generator syntax requirement

    mock_engine._mock_sync.analyze_streaming_generator = mock_generator
    mock_engine._mock_sync.is_running.return_value = False

    with pytest.raises(RuntimeError, match="not running"):
        async for _ in mock_engine.analyze_streaming("(;GM[1])", visits=10):
            pass
