"""
Recognition Provider - Shared dependency for UniversalGoRecognizer.
Provides a FastAPI-compatible dependency to avoid duplicated initialization logic.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import UniversalGo ML recognizer
UNIVERSAL_AVAILABLE = False
try:
    from services.universal_go_recognizer import UniversalGoRecognizer

    UNIVERSAL_AVAILABLE = True
except ImportError as e:
    logger.warning(f"UniversalGo not available: {e}")

# Singleton instance
_universal_recognizer: Optional["UniversalGoRecognizer"] = None


def get_universal_recognizer() -> Optional["UniversalGoRecognizer"]:
    """
    Lazy-load and return the UniversalGoRecognizer singleton.

    Returns:
        UniversalGoRecognizer instance if available, None otherwise.
    """
    global _universal_recognizer
    if _universal_recognizer is None and UNIVERSAL_AVAILABLE:
        try:
            _universal_recognizer = UniversalGoRecognizer()
            logger.info("UniversalGoRecognizer initialized successfully")
        except Exception as e:
            logger.error(f"Failed to init UniversalGo: {e}")
    return _universal_recognizer


def init_recognizer() -> None:
    """
    Initialize the recognizer at application startup.
    Call this from main.py lifespan.
    """
    if UNIVERSAL_AVAILABLE:
        logger.info("Initializing UniversalGo Recognizer...")
        get_universal_recognizer()


def is_recognizer_available() -> bool:
    """Check if the recognizer is available and loaded."""
    recognizer = get_universal_recognizer()
    return recognizer is not None and recognizer.is_available()
