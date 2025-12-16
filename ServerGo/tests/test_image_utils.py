import pytest
import numpy as np
import cv2
from unittest.mock import AsyncMock, MagicMock
from fastapi import UploadFile, HTTPException
from core.image_utils import decode_image


@pytest.mark.asyncio
async def test_decode_image_success():
    # Create a dummy image
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, encoded = cv2.imencode(".jpg", img)
    content = encoded.tobytes()

    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "image/jpeg"
    mock_file.read = AsyncMock(return_value=content)

    decoded = await decode_image(mock_file)
    assert decoded is not None
    assert decoded.shape == (100, 100, 3)


@pytest.mark.asyncio
async def test_decode_image_invalid_content_type():
    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "text/plain"

    with pytest.raises(HTTPException) as exc:
        await decode_image(mock_file)
    assert exc.value.status_code == 400
    assert "image" in exc.value.detail


@pytest.mark.asyncio
async def test_decode_image_bad_data():
    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "image/png"
    mock_file.read = AsyncMock(return_value=b"not an image")

    with pytest.raises(HTTPException) as exc:
        await decode_image(mock_file)
    assert exc.value.status_code == 400
    assert "Invalid" in exc.value.detail or "Could not decode" in exc.value.detail


@pytest.mark.asyncio
async def test_decode_image_exception_handling():
    # Test handling of unexpected exceptions
    mock_file = MagicMock(spec=UploadFile)
    mock_file.content_type = "image/png"
    # Raise generic exception
    mock_file.read = AsyncMock(side_effect=RuntimeError("Read error"))

    with pytest.raises(HTTPException) as exc:
        await decode_image(mock_file)
    assert exc.value.status_code == 400
    assert "Invalid image data" in exc.value.detail
