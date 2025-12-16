"""
Go Analysis Server - Main Application
"""

import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from core.errors import ErrorResponse, ErrorDetail, AppException

from config import config
from services.katago_service import katago_service
from services.recognition_provider import init_recognizer
from routers.v1 import router as v1_router
from middleware import RateLimiterMiddleware, BodySizeLimitMiddleware
from middleware.correlation import CorrelationIdMiddleware
from logging_config import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Starts KataGo on startup and stops it on shutdown.
    """
    logger.info("Starting application...")

    # Start KataGo if paths are configured
    if config.validate_katago_paths():
        await katago_service.start()
    else:
        logger.warning("KataGo paths not configured, engine will not start")

    # Initialize UniversalGo Model
    init_recognizer()

    yield

    # Shutdown
    logger.info("Shutting down application...")
    await katago_service.stop()


# Create FastAPI app
app = FastAPI(
    title="Go Analysis API",
    description="AI-powered Go game analysis using KataGo",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["X-API-Key", "Content-Type", "Authorization"],
    expose_headers=["X-Request-ID", "Retry-After"],
)

# Add security middleware
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(RateLimiterMiddleware)
app.add_middleware(CorrelationIdMiddleware)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to all requests."""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id

    # Log request
    logger.info(
        "REQUEST: %s %s -> %s", request.method, request.url.path, response.status_code
    )

    return response


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """Handle Application exceptions."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetail(
                code=exc.status_code,
                message=exc.message,
                detail=exc.detail,
                request_id=request_id,
            )
        ).model_dump(),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent format."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetail(
                code=exc.status_code, message=str(exc.detail), request_id=request_id
            )
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.exception("Unhandled exception: %s", exc)
    request_id = getattr(request.state, "request_id", None)

    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error=ErrorDetail(
                code=500, message="Internal server error", request_id=request_id
            )
        ).model_dump(),
    )


# Include routers with API versioning

# V1 API (handles /v1 prefix internally)
app.include_router(v1_router)


# Health check with dependency status
@app.get("/health")
async def health_check():
    """Health check endpoint with dependency status."""
    katago_status = "running" if katago_service.is_running() else "stopped"
    return {
        "status": "healthy",
        "version": "1.0.0",
        "dependencies": {"katago": katago_status},
    }


@app.get("/ping")
async def ping():
    """Simple ping endpoint."""
    return {"message": "pong"}


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Go Analysis Server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
