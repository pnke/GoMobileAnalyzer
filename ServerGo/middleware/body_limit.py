"""
Request Body Size Limit Middleware
"""

from typing import Optional
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import config


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to limit request body size.
    Prevents memory exhaustion from oversized requests.
    """

    def __init__(self, app, max_bytes: Optional[int] = None):
        super().__init__(app)
        self.max_bytes = max_bytes or config.MAX_BODY_BYTES

    async def dispatch(self, request: Request, call_next):
        # Check Content-Length header
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                length = int(content_length)
                if length > self.max_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": {
                                "code": 413,
                                "message": f"Request body too large. Maximum size: {self.max_bytes} bytes",
                                "max_bytes": self.max_bytes,
                                "received_bytes": length,
                            }
                        },
                    )
            except ValueError:
                # Invalid Content-Length header
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "code": 400,
                            "message": "Invalid Content-Length header",
                        }
                    },
                )

        return await call_next(request)
