"""
Pydantic Schemas for GoRemoteAnalyse Backend
Centralized exports for all API models.
"""

from .analysis import (
    AnalysisRequest,
    AnalysisResponse,
    AnalysisErrorResponse,
    HealthResponse,
)

from .recognition import (
    RecognitionResponse,
    CornersResponse,
    ClassifyRequest,
)

__all__ = [
    # Analysis
    "AnalysisRequest",
    "AnalysisResponse",
    "AnalysisErrorResponse",
    "HealthResponse",
    # Recognition
    "RecognitionResponse",
    "CornersResponse",
    "ClassifyRequest",
]
