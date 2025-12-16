import logging
import cv2
import numpy as np
from fastapi import UploadFile, HTTPException

logger = logging.getLogger(__name__)


async def decode_image(image: UploadFile) -> np.ndarray:
    """Helper to read and decode uploaded image."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    try:
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        cv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if cv_image is None:
            raise HTTPException(status_code=400, detail="Could not decode image")
        return cv_image
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image decode failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid image data")
