"""
V1 API Schemas
Strictly typed Pydantic models for request and response validation.
"""

from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict

from config import config

# --- Generic Envelope ---


class ResponseMeta(BaseModel):
    """Metadata included in every response."""

    version: str = "v1"
    status: str = "ok"


class BaseEnvelope(BaseModel):
    """Base envelope structure."""

    meta: ResponseMeta = Field(default_factory=ResponseMeta)


# --- Analysis Schemas ---


class AnalysisRequest(BaseModel):
    """Request model for SGF analysis."""

    model_config = ConfigDict(populate_by_name=True)

    sgf: str = Field(..., min_length=1, description="Raw SGF content")
    visits: int = Field(
        default=config.DEFAULT_ANALYSIS_STEPS,
        ge=config.MIN_ANALYSIS_STEPS,
        le=config.MAX_ANALYSIS_STEPS,
        description="Number of visits (simulations)",
    )
    start_turn: Optional[int] = Field(
        None, ge=0, alias="startTurn", description="Start turn index (inclusive)"
    )
    end_turn: Optional[int] = Field(
        None, ge=0, alias="endTurn", description="End turn index (inclusive)"
    )


class AnalysisData(BaseModel):
    """Data payload for analysis result."""

    sgf: str = Field(..., description="Analyzed SGF content")
    visits_used: int
    engine_time_sec: Optional[float] = None


class AnalysisResponse(BaseEnvelope):
    """Complete analysis response."""

    data: AnalysisData


class StreamEventData(BaseModel):
    """Data payload for SSE analysis update."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=lambda s: "".join(
            w.capitalize() if i else w for i, w in enumerate(s.split("_"))
        ),
    )

    turn: int
    total_turns: int = Field(alias="totalTurns")
    winrate: float
    score: float
    top_moves: List[Any] = Field(alias="topMoves")
    is_done: bool = Field(False, alias="isDone")
    error: Optional[str] = None


# --- Recognition Schemas ---


class RecognitionData(BaseModel):
    """Data payload for board recognition."""

    model_config = ConfigDict(populate_by_name=True)

    sgf: str
    board_size: int = Field(alias="boardSize")
    confidence: float
    black_stones: int = Field(alias="blackStones")
    white_stones: int = Field(alias="whiteStones")
    method: str
    board: List[List[int]]
    corners: Optional[List[List[float]]] = None
    warped_image_base64: Optional[str] = Field(None, alias="warpedImageBase64")


class RecognitionResponse(BaseEnvelope):
    """Complete recognition response."""

    data: RecognitionData


class CornersData(BaseModel):
    """Data payload for corner detection."""

    model_config = ConfigDict(populate_by_name=True)

    corners: List[List[float]]
    image_width: int = Field(alias="imageWidth")
    image_height: int = Field(alias="imageHeight")
    preview_base64: str = Field(alias="previewBase64")


class CornersResponse(BaseEnvelope):
    """Complete corners response."""

    data: CornersData
