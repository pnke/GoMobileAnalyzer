from typing import Any, Optional
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: int
    message: str
    request_id: Optional[str] = None
    detail: Optional[Any] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class AppException(Exception):
    """
    Base application exception.
    """

    def __init__(self, status_code: int, message: str, detail: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.detail = detail
