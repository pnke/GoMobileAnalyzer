"""
V1 API Routers Package

Consolidated v1 API structure providing:
- Health & Connectivity checks
- SGF Analysis endpoints
- Board Recognition endpoints
"""

from fastapi import APIRouter
from .health import router as health_router
from .analyses import router as analyses_router
from .recognitions import router as recognitions_router

# Create main v1 router with prefix
router = APIRouter(
    prefix="/v1",
    tags=["v1"],
    responses={
        400: {"description": "Invalid request"},
        401: {"description": "Missing or invalid API key"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"},
        502: {"description": "KataGo engine error"},
        504: {"description": "Analysis timeout"},
    },
)

# Include sub-routers
router.include_router(health_router, tags=["Health"])
router.include_router(analyses_router, prefix="/analyses", tags=["Analyses"])
router.include_router(
    recognitions_router, prefix="/recognitions", tags=["Recognitions"]
)
