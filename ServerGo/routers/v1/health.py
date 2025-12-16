"""
V1 Health and Connectivity Endpoints
Provides basic health checks and connectivity tests.
"""

import logging
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from config import config
from services.katago_service import KataGoService, get_katago_service
from middleware.auth import optional_api_key

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/ping")
async def ping_v1():
    """Simple ping endpoint for basic connectivity check."""
    return JSONResponse(content={"message": "pong", "version": "v1"})


@router.get("/health")
async def health_v1(
    service: KataGoService = Depends(get_katago_service),
    _: str = Depends(optional_api_key),
):
    """
    Health check endpoint.
    Returns status of the service and KataGo engine.
    """
    katago_paths_ok = config.validate_katago_paths()
    katago_running = bool(service.engine and service.engine.is_running())

    status = "up" if katago_running else "degraded"

    return JSONResponse(
        content={
            "status": status,
            "version": "v1",
            "katago_running": katago_running,
            "katago_paths_ok": katago_paths_ok,
            "config": {
                "max_body_bytes": config.MAX_BODY_BYTES,
                "rate_limit_requests": config.RATE_LIMIT_REQUESTS,
                "rate_limit_window_sec": config.RATE_LIMIT_WINDOW_SEC,
                "analysis_steps_range": [
                    config.MIN_ANALYSIS_STEPS,
                    config.MAX_ANALYSIS_STEPS,
                ],
            },
        }
    )
