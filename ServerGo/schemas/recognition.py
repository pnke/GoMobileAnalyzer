"""
Recognition API Schemas
Pydantic models for the /v1/recognize endpoints.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class RecognitionResponse(BaseModel):
    """Response model for board recognition."""

    sgf: str = Field(..., description="Generated SGF string")
    board_size: int = Field(..., ge=9, le=19, description="Board size (9, 13, or 19)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Recognition confidence")
    black_stones: int = Field(..., ge=0, description="Number of black stones detected")
    white_stones: int = Field(..., ge=0, description="Number of white stones detected")
    method: str = Field(
        default="opencv",
        description="Recognition method: 'universal', 'opencv', or 'universal_manual'",
    )
    corners: Optional[List[List[float]]] = Field(
        default=None, description="Detected corners [[x,y], ...]"
    )
    board: Optional[List[List[int]]] = Field(
        default=None, description="2D board state (0=empty, 1=black, 2=white)"
    )
    warped_image_base64: Optional[str] = Field(
        default=None, description="Base64 encoded warped board image"
    )


class CornersResponse(BaseModel):
    """Response model for corner detection."""

    corners: List[List[float]] = Field(
        ..., description="4 corners: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]"
    )
    image_width: int = Field(..., ge=1, description="Original image width")
    image_height: int = Field(..., ge=1, description="Original image height")
    preview_base64: str = Field(
        ..., description="Base64 encoded preview with corners drawn"
    )


class ClassifyRequest(BaseModel):
    """Request model for classification with manual corners."""

    corners: List[List[float]] = Field(
        ..., description="4 corners: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]"
    )
    board_size: int = Field(default=19, ge=9, le=19, description="Board size")
