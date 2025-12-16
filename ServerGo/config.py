"""
Configuration management with validation.
All required environment variables are checked at startup.
"""

import os
import logging
from typing import Optional
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class ConfigurationError(Exception):
    """Raised when configuration is invalid."""

    pass


class Config:
    """
    Application configuration with validation.

    Note: KataGo paths (KATAGO_PATH, KATAGO_MODEL, KATAGO_CONFIG) are optional
    at load time to support dev/test environments without KataGo installed.
    Use validate_katago_paths() to check if KataGo is properly configured
    before attempting to start the engine.
    """

    def __init__(self):
        # KataGo paths - optional at load, validated via validate_katago_paths()
        self.KATAGO_PATH = self._get_path("KATAGO_PATH", required=False)
        self.KATAGO_MODEL = self._get_path("KATAGO_MODEL", required=False)
        self.KATAGO_CONFIG = self._get_path("KATAGO_CONFIG", required=False)

        # Security settings with safe defaults (10MB default for image uploads)
        self.MAX_BODY_BYTES = self._get_int(
            "MAX_BODY_BYTES", default=10_485_760, min_val=1024, max_val=52_428_800
        )
        self.RATE_LIMIT_REQUESTS = self._get_int(
            "RATE_LIMIT_REQUESTS", default=30, min_val=1, max_val=1000
        )
        self.RATE_LIMIT_WINDOW_SEC = self._get_int(
            "RATE_LIMIT_WINDOW_SEC", default=60, min_val=10, max_val=3600
        )
        self.KATAGO_TIMEOUT_SEC = self._get_float(
            "KATAGO_TIMEOUT_SEC", default=120.0, min_val=10.0, max_val=600.0
        )

        # Buffer limit for subprocess communication
        self.BUFFER_LIMIT = 2 * 1024 * 1024  # 2MB, not configurable

        # API Security
        self.API_KEY = os.environ.get(
            "API_KEY", default="test-key"
        )  # Optional, enables auth if set
        self.REQUIRE_API_KEY = self._get_bool("REQUIRE_API_KEY", default=True)

        # CORS settings
        self.ALLOWED_ORIGINS = self._get_list("ALLOWED_ORIGINS", default=["*"])

        # Analysis limits
        self.MIN_ANALYSIS_STEPS = self._get_int(
            "MIN_ANALYSIS_STEPS", default=100, min_val=10, max_val=1000
        )
        self.MAX_ANALYSIS_STEPS = self._get_int(
            "MAX_ANALYSIS_STEPS", default=100_000, min_val=1000, max_val=1_000_000
        )
        self.DEFAULT_ANALYSIS_STEPS = self._get_int(
            "DEFAULT_ANALYSIS_STEPS", default=1000, min_val=100, max_val=100_000
        )

        # Validate analysis step bounds
        if self.MIN_ANALYSIS_STEPS >= self.MAX_ANALYSIS_STEPS:
            raise ConfigurationError(
                "MIN_ANALYSIS_STEPS must be less than MAX_ANALYSIS_STEPS"
            )
        if not (
            self.MIN_ANALYSIS_STEPS
            <= self.DEFAULT_ANALYSIS_STEPS
            <= self.MAX_ANALYSIS_STEPS
        ):
            raise ConfigurationError(
                "DEFAULT_ANALYSIS_STEPS must be between MIN and MAX"
            )

    def _get_path(self, key: str, required: bool = True) -> str:
        """Get a path from environment, optionally validating existence."""
        value = os.environ.get(key, "")

        if required and not value:
            raise ConfigurationError(f"Required environment variable {key} is not set")

        if value and not os.path.exists(value):
            if required:
                raise ConfigurationError(f"Path for {key} does not exist: {value}")
            else:
                # Log warning but don't fail
                logger.warning("Path for %s does not exist: %s", key, value)

        return value

    def _get_int(
        self,
        key: str,
        default: int,
        min_val: Optional[int] = None,
        max_val: Optional[int] = None,
    ) -> int:
        """Get an integer from environment with bounds checking."""
        value_str = os.environ.get(key)

        if value_str is None:
            return default

        try:
            value = int(value_str)
        except ValueError:
            raise ConfigurationError(f"{key} must be an integer, got: {value_str}")

        if min_val is not None and value < min_val:
            raise ConfigurationError(f"{key} must be >= {min_val}, got: {value}")

        if max_val is not None and value > max_val:
            raise ConfigurationError(f"{key} must be <= {max_val}, got: {value}")

        return value

    def _get_float(
        self,
        key: str,
        default: float,
        min_val: Optional[float] = None,
        max_val: Optional[float] = None,
    ) -> float:
        """Get a float from environment with bounds checking."""
        value_str = os.environ.get(key)

        if value_str is None:
            return default

        try:
            value = float(value_str)
        except ValueError:
            raise ConfigurationError(f"{key} must be a number, got: {value_str}")

        if min_val is not None and value < min_val:
            raise ConfigurationError(f"{key} must be >= {min_val}, got: {value}")

        if max_val is not None and value > max_val:
            raise ConfigurationError(f"{key} must be <= {max_val}, got: {value}")

        return value

    def _get_bool(self, key: str, default: bool) -> bool:
        """Get a boolean from environment."""
        value_str = os.environ.get(key, "").lower()

        if not value_str:
            return default

        if value_str in ("true", "1", "yes", "on"):
            return True
        if value_str in ("false", "0", "no", "off"):
            return False

        raise ConfigurationError(
            f"{key} must be a boolean (true/false), got: {value_str}"
        )

    def _get_list(self, key: str, default: list, separator: str = ",") -> list:
        """Get a list from environment (comma-separated by default)."""
        value_str = os.environ.get(key)

        if not value_str:
            return default

        items = [item.strip() for item in value_str.split(separator) if item.strip()]
        return items if items else default

    def validate_katago_paths(self) -> bool:
        """Check if all KataGo paths are configured and exist."""
        paths = [self.KATAGO_PATH, self.KATAGO_MODEL, self.KATAGO_CONFIG]
        return all(p and os.path.exists(p) for p in paths)


# Singleton instance - created at import time
# Will raise ConfigurationError if invalid
config = Config()


@lru_cache
def get_config() -> Config:
    """Dependency provider for Config."""
    return config
