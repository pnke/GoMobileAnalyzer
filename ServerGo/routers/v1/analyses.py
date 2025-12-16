"""
V1 Analyses Router
Handles SGF analysis requests.
"""

import json
import logging

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from services.katago_service import KataGoService, get_katago_service
from middleware.auth import verify_api_key
from schemas.v1 import AnalysisRequest, AnalysisResponse, AnalysisData

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=AnalysisResponse)
async def create_analysis(
    request: AnalysisRequest,
    service: KataGoService = Depends(get_katago_service),
    api_key: str = Depends(verify_api_key),
):
    """
    Start a new analysis job (Blocking for now, but wrapped in Envelope).
    """
    # Validate SGF
    logger.info(f"V1 Analysis payload: visits={request.visits}")

    try:
        # Run blocking analysis
        # KataGoService.analyze validates the SGF internally
        analyzed_sgf = await service.analyze(
            request.sgf,
            visits=request.visits,
            start_turn=request.start_turn,
            end_turn=request.end_turn,
        )

        return AnalysisResponse(
            data=AnalysisData(sgf=analyzed_sgf, visits_used=request.visits)
        )

    except TimeoutError as e:
        logger.error(f"Analysis timeout: {e}")
        raise HTTPException(status_code=504, detail="Analysis timed out")
    except Exception as e:
        logger.exception(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{id}/stream")
async def stream_analysis_by_id(id: str):
    """Placeholder for future Async Job streaming."""
    raise HTTPException(
        status_code=501,
        detail="Async jobs not yet implemented. Use POST /analyses/stream",
    )


@router.post("/stream")
async def stream_analysis_live(
    request: AnalysisRequest,
    service: KataGoService = Depends(get_katago_service),
    api_key: str = Depends(verify_api_key),
):
    """
    Stream analysis results via Server-Sent Events (SSE).
    CRITICAL FIX: Runs generator in threadpool to prevent blocking event loop.
    """

    async def event_generator():
        try:
            # Yield results directly from async service generator
            async for item in service.analyze_stream(
                request.sgf,
                visits=request.visits,
                start_turn=request.start_turn,
                end_turn=request.end_turn,
            ):
                yield f"data: {json.dumps(item)}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
