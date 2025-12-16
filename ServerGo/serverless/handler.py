"""
RunPod Serverless Handler
Uses shared services layer for API parity with local server.
"""

import runpod
import sys
import os
import base64
import secrets
import logging
import asyncio
from pydantic import BaseModel, Field, ValidationError

# Ensure we can import from parent modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.sgf.validator import SGFValidationError
from services.katago_service import KataGoService, default_engine_factory
from services.recognition_service import RecognitionService
from core.errors import ErrorResponse, ErrorDetail
from config import config

# Setup structured logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# API Key from environment (set as RunPod Secret)
KATAGO_API_KEY = os.environ.get("KATAGO_API_KEY")

# Analysis limits
MIN_VISITS = 100
MAX_VISITS = 100000
DEFAULT_VISITS = 1000

# Global service instances
katago_service = KataGoService(default_engine_factory, config)
recognition_service = RecognitionService()


class AnalysisRequest(BaseModel):
    sgf_data: str = Field(..., description="SGF file content")
    steps: int = Field(
        default=DEFAULT_VISITS,
        ge=MIN_VISITS,
        le=MAX_VISITS,
        description="Analysis depth (visits)",
    )
    start_turn: int | None = Field(default=None, description="Start turn for analysis")
    end_turn: int | None = Field(default=None, description="End turn for analysis")
    api_key: str | None = Field(
        default=None, description="Optional API key in body (legacy)"
    )


class RecognitionRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded image")
    corners: list[list[float]] | None = Field(
        default=None, description="4 corner points [[x,y],...]"
    )
    board_size: int = Field(default=19, ge=9, le=19)
    api_key: str | None = Field(
        default=None, description="Optional API key in body (legacy)"
    )


def validate_api_key(job_input: dict, headers: dict) -> bool:
    """Validate API key from headers or input."""
    if not KATAGO_API_KEY:
        return True

    header_key = headers.get("X-Worker-Key") or headers.get("x-worker-key")
    if header_key:
        return secrets.compare_digest(header_key, KATAGO_API_KEY)

    input_key = job_input.get("api_key")
    if input_key:
        logger.warning("API key passed in input body. Use X-Worker-Key header instead.")
        return secrets.compare_digest(input_key, KATAGO_API_KEY)

    return False


def error_response(code: int, message: str) -> dict:
    """Create a standardized error response."""
    return ErrorResponse(error=ErrorDetail(code=code, message=message)).model_dump()


async def handle_analyze(request: AnalysisRequest) -> dict:
    logger.info(
        "Processing analysis: visits=%d, sgf_size=%d",
        request.steps,
        len(request.sgf_data),
    )

    try:
        analyzed_sgf = await katago_service.analyze(
            request.sgf_data,
            visits=request.steps,
            start_turn=request.start_turn,
            end_turn=request.end_turn,
        )
        return {"analyzed_sgf": analyzed_sgf}
    except SGFValidationError as e:
        return error_response(400, f"Invalid SGF: {str(e)}")
    except Exception as e:
        logger.error("Analysis error: %s", e)
        return error_response(500, f"Analysis failed: {str(e)}")


async def handle_recognize(request: RecognitionRequest) -> dict:
    """Handle board recognition request."""
    try:
        image_bytes = base64.b64decode(request.image)
    except Exception as e:
        return error_response(400, f"Invalid base64 image: {str(e)}")

    logger.info("Processing recognition: board_size=%d", request.board_size)

    try:
        if request.corners:
            # Classify with provided corners
            result = await recognition_service.classify_from_corners(
                image_bytes, request.corners, request.board_size
            )
        else:
            # Full recognition pipeline
            result = await recognition_service.full_recognition(
                image_bytes, request.board_size
            )

        if result is None:
            return error_response(422, "Board detection failed")

        return {
            "board": result.board,
            "sgf": result.sgf,
            "corners": result.corners,
            "warped_base64": result.warped_base64,
        }
    except Exception as e:
        logger.error("Recognition error: %s", e)
        return error_response(500, f"Recognition failed: {str(e)}")


def handler(job):
    """
    Main RunPod handler.

    Actions:
    - "analyze": SGF analysis (default)
    - "recognize": Board recognition
    """
    job_input = job.get("input", {})
    headers = job.get("headers", {})

    # Validate API key
    if not validate_api_key(job_input, headers):
        return error_response(401, "Invalid or missing API key.")

    action = job_input.get("action", "analyze")

    # Create event loop (Python 3.10+ compatible)
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if action == "analyze":
        try:
            request = AnalysisRequest(**job_input)
        except ValidationError as e:
            return error_response(422, f"Validation error: {e.errors()}")

        # Check service readiness
        if not katago_service.is_running():
            return error_response(
                503, "Analysis service not running. Worker may need restart."
            )

        return loop.run_until_complete(handle_analyze(request))

    elif action == "recognize":
        try:
            request = RecognitionRequest(**job_input)
        except ValidationError as e:
            return error_response(422, f"Validation error: {e.errors()}")

        # Check service readiness
        if not recognition_service.is_available():
            return error_response(503, "Recognition service not available.")

        return loop.run_until_complete(handle_recognize(request))

    else:
        return error_response(
            400, f"Unknown action: {action}. Use 'analyze' or 'recognize'."
        )


# Initialize services at startup
async def initialize():
    """Initialize services before handling requests."""
    await katago_service.start()
    await recognition_service.initialize()
    logger.info("All services initialized. Worker ready.")


if __name__ == "__main__":
    # Initialize services
    asyncio.run(initialize())

    # Start the RunPod serverless handler
    runpod.serverless.start({"handler": handler})
