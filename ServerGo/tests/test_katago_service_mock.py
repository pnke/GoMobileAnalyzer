import pytest

from unittest.mock import MagicMock
from services.katago_service import KataGoService


class MockGoEngine:
    def __init__(self):
        self.running = True
        self.analyze_called = False

    async def analyze(
        self,
        sgf_content: str,
        visits: int,
        timeout: int = 120,
        start_turn: int = None,
        end_turn: int = None,
    ) -> str:
        self.analyze_called = True
        return sgf_content + ";C[Analyzed by Mock]"

    def close(self):
        self.running = False

    def is_running(self) -> bool:
        return self.running


@pytest.mark.asyncio
async def test_katago_service_with_mock_engine():
    # Arrange
    # Arrange
    mock_engine = MockGoEngine()
    factory = MagicMock(return_value=mock_engine)
    mock_config = MagicMock()
    mock_config.KATAGO_TIMEOUT_SEC = 120
    service = KataGoService(factory, mock_config)

    # Act
    await service.start()
    result = await service.analyze("(;GM[1])", visits=10)
    await service.stop()

    # Assert
    assert factory.called
    assert mock_engine.analyze_called
    assert "Analyzed by Mock" in result
    assert not mock_engine.is_running()
