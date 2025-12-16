import pytest
import sys
from pathlib import Path

# Add the server directory to the path so we can import the server module
server_path = Path(__file__).parent.parent
sys.path.insert(0, str(server_path))


@pytest.fixture
def sample_sgf_content():
    """Sample SGF content for testing"""
    return """(;GM[1]FF[4]CA[UTF-8]AP[CGoban:3]ST[2]
RU[Japanese]SZ[19]KM[6.50]TM[1800]OT[5x30 byo-yomi]
PW[Player1]PB[Player2]WR[20k]BR[20k]
DT[2023-01-01]PC[The KGS Go Server at http://www.gokgs.com/]
C[Sample game for testing]
;B[aa];W[sa];B[as];W[ss])"""


@pytest.fixture
def sample_analysis_response():
    """Sample analysis response from KataGo"""
    return {
        "id": "analysis_query",
        "turnInfo": [
            {
                "turnNumber": 0,
                "winrate": 0.45,
                "scoreLead": -1.2,
                "player": "B",
                "moveInfos": [
                    {"move": "Q16", "winrate": 0.48, "scoreLead": -0.8},
                    {"move": "D16", "winrate": 0.47, "scoreLead": -0.9},
                    {"move": "Q4", "winrate": 0.46, "scoreLead": -1.0},
                ],
            },
            {
                "turnNumber": 1,
                "winrate": 0.52,
                "scoreLead": 1.0,
                "player": "W",
                "moveInfos": [
                    {"move": "D4", "winrate": 0.55, "scoreLead": 1.5},
                    {"move": "Q16", "winrate": 0.53, "scoreLead": 1.2},
                    {"move": "D16", "winrate": 0.51, "scoreLead": 0.8},
                ],
            },
        ],
    }


@pytest.fixture
def mock_katago_engine():
    """Mock KataGo engine for isolated testing."""
    from unittest.mock import MagicMock

    engine = MagicMock()
    engine.is_running.return_value = True
    engine.analyze.return_value = "(;GM[1]FF[4]SZ[19];B[pd]C[WR:0.45])"
    engine.close = MagicMock()

    return engine


@pytest.fixture
def mock_recognition_service():
    """Mock recognition service for isolated testing."""
    from unittest.mock import MagicMock, AsyncMock

    service = MagicMock()
    service.is_available.return_value = True
    service.detect_corners = AsyncMock(
        return_value=[[0, 0], [100, 0], [100, 100], [0, 100]]
    )
    service.classify_from_corners = AsyncMock(
        return_value=MagicMock(
            board=[[0] * 19 for _ in range(19)],
            sgf="(;GM[1]FF[4]SZ[19])",
            corners=[[0, 0], [100, 0], [100, 100], [0, 100]],
            warped_base64=None,
        )
    )

    return service


@pytest.fixture
def mock_image_bytes():
    """Sample valid JPEG image bytes for recognition tests."""
    import io

    try:
        from PIL import Image

        img = Image.new("RGB", (100, 100), color="beige")
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG")
        return buffer.getvalue()
    except ImportError:
        # Minimal valid JPEG if PIL not available
        return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
