"""
Analysis API Schemas
Pydantic models for the /analyze endpoint.
"""

from typing import Optional
from pydantic import BaseModel, Field

from config import config


class AnalysisRequest(BaseModel):
    """Request model for SGF analysis."""

    sgf_data: str = Field(..., description="SGF file content")
    steps: int = Field(
        default=config.DEFAULT_ANALYSIS_STEPS,
        ge=config.MIN_ANALYSIS_STEPS,
        le=config.MAX_ANALYSIS_STEPS,
        description="Analysis depth (visits)",
    )
    start_turn: Optional[int] = Field(
        default=None, ge=0, description="Start turn index (inclusive)"
    )
    end_turn: Optional[int] = Field(
        default=None, ge=0, description="End turn index (inclusive)"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "sgf_data": "(;GM[1]FF[4]SZ[19];B[pd];W[dp])",
                    "steps": 1000,
                    "start_turn": 0,
                    "end_turn": 10,
                }
            ]
        }
    }


class AnalysisResponse(BaseModel):
    """Response model for SGF analysis."""

    analyzed_sgf: str = Field(..., description="SGF with winrate/score annotations")


class AnalysisErrorResponse(BaseModel):
    """Error response model."""

    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(default=None, description="Detailed error info")


class HealthResponse(BaseModel):
    """Response model for /health endpoint."""

    status: str = Field(..., description="Service status: 'up' or 'degraded'")
    katago_running: bool = Field(..., description="Whether KataGo engine is running")
    katago_paths_ok: bool = Field(
        ..., description="Whether KataGo paths are configured"
    )
    config: dict = Field(default_factory=dict, description="Server configuration")
