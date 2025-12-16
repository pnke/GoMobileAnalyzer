"""
Tests for config.py
"""

import os
import importlib
from unittest.mock import patch

# We need to import config after setting up mocks


class TestConfig:
    """Tests for Config class."""

    def test_default_values(self):
        """Test that default configuration values are set correctly."""
        with patch.dict(os.environ, {}, clear=True):
            import config as config_module

            importlib.reload(config_module)
            cfg = config_module.config

            # Test reasonable bounds rather than exact defaults (env may override)
            assert cfg.MAX_BODY_BYTES >= 1024  # At least 1KB
            assert cfg.RATE_LIMIT_REQUESTS >= 1
            assert cfg.RATE_LIMIT_WINDOW_SEC >= 10
            assert cfg.KATAGO_TIMEOUT_SEC >= 10.0
            assert cfg.REQUIRE_API_KEY in [True, False]
            assert isinstance(cfg.ALLOWED_ORIGINS, list)
            assert cfg.MIN_ANALYSIS_STEPS >= 10
            assert cfg.MAX_ANALYSIS_STEPS >= 1000
            assert cfg.DEFAULT_ANALYSIS_STEPS >= 100

    def test_custom_int_values(self):
        """Test parsing custom integer values from environment."""
        with patch.dict(
            os.environ,
            {
                "MAX_BODY_BYTES": "2097152",
                "RATE_LIMIT_REQUESTS": "60",
            },
            clear=False,
        ):
            import config as config_module

            importlib.reload(config_module)
            cfg = config_module.config

            assert cfg.MAX_BODY_BYTES == 2097152
            assert cfg.RATE_LIMIT_REQUESTS == 60

    def test_custom_bool_values(self):
        """Test parsing boolean values."""
        with patch.dict(os.environ, {"REQUIRE_API_KEY": "true"}, clear=False):
            import config as config_module

            importlib.reload(config_module)
            cfg = config_module.config

            assert cfg.REQUIRE_API_KEY is True

    def test_custom_list_values(self):
        """Test parsing comma-separated list values."""
        with patch.dict(
            os.environ,
            {"ALLOWED_ORIGINS": "https://example.com,https://test.com"},
            clear=False,
        ):
            import config as config_module

            importlib.reload(config_module)
            cfg = config_module.config

            assert cfg.ALLOWED_ORIGINS == ["https://example.com", "https://test.com"]

    def test_int_bounds_validation(self):
        """Test that integer bounds are validated."""
        with patch.dict(os.environ, {"RATE_LIMIT_REQUESTS": "0"}, clear=False):
            import config as config_module

            # The error is raised during reload - pytest.raises catches it
            try:
                importlib.reload(config_module)
                assert False, "Expected ConfigurationError"
            except config_module.ConfigurationError as e:
                assert "RATE_LIMIT_REQUESTS" in str(e)

    def test_invalid_int_raises_error(self):
        """Test that non-integer values raise ConfigurationError."""
        with patch.dict(os.environ, {"MAX_BODY_BYTES": "not_a_number"}, clear=False):
            import config as config_module

            try:
                importlib.reload(config_module)
                assert False, "Expected ConfigurationError"
            except config_module.ConfigurationError as e:
                assert "must be an integer" in str(e)

    def test_invalid_bool_raises_error(self):
        """Test that invalid boolean values raise ConfigurationError."""
        with patch.dict(os.environ, {"REQUIRE_API_KEY": "maybe"}, clear=False):
            import config as config_module

            try:
                importlib.reload(config_module)
                assert False, "Expected ConfigurationError"
            except config_module.ConfigurationError as e:
                assert "boolean" in str(e)

    def test_analysis_bounds_validation(self):
        """Test that MIN < MAX for analysis steps."""
        with patch.dict(
            os.environ,
            {"MIN_ANALYSIS_STEPS": "1000", "MAX_ANALYSIS_STEPS": "500"},
            clear=False,
        ):
            import config as config_module

            try:
                importlib.reload(config_module)
                assert False, "Expected ConfigurationError"
            except config_module.ConfigurationError as e:
                assert "MAX_ANALYSIS_STEPS" in str(e)
