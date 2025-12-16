from unittest.mock import MagicMock, patch
from services.recognition_provider import (
    get_universal_recognizer,
    init_recognizer,
    is_recognizer_available,
)


def test_get_universal_recognizer_success():
    """Test successful initialization of UniversalGoRecognizer."""
    with (
        patch("services.recognition_provider.UNIVERSAL_AVAILABLE", True),
        patch("services.recognition_provider.UniversalGoRecognizer") as mock_class,
    ):
        # Reset singleton
        import services.recognition_provider

        services.recognition_provider._universal_recognizer = None

        mock_instance = MagicMock()
        mock_class.return_value = mock_instance

        result = get_universal_recognizer()

        assert result == mock_instance
        mock_class.assert_called_once()


def test_get_universal_recognizer_not_available():
    """Test when UniversalGo is not available."""
    with patch("services.recognition_provider.UNIVERSAL_AVAILABLE", False):
        import services.recognition_provider

        services.recognition_provider._universal_recognizer = None

        result = get_universal_recognizer()

        assert result is None


def test_get_universal_recognizer_init_failure():
    """Test handling of initialization failure."""
    with (
        patch("services.recognition_provider.UNIVERSAL_AVAILABLE", True),
        patch(
            "services.recognition_provider.UniversalGoRecognizer",
            side_effect=Exception("Init failed"),
        ),
    ):
        import services.recognition_provider

        services.recognition_provider._universal_recognizer = None

        result = get_universal_recognizer()

        assert result is None


def test_get_universal_recognizer_singleton():
    """Test that get_universal_recognizer returns the same instance."""
    with (
        patch("services.recognition_provider.UNIVERSAL_AVAILABLE", True),
        patch("services.recognition_provider.UniversalGoRecognizer") as mock_class,
    ):
        import services.recognition_provider

        services.recognition_provider._universal_recognizer = None

        mock_instance = MagicMock()
        mock_class.return_value = mock_instance

        result1 = get_universal_recognizer()
        result2 = get_universal_recognizer()

        assert result1 == result2
        mock_class.assert_called_once()  # Only called once


def test_init_recognizer_available():
    """Test init_recognizer when UNIVERSAL_AVAILABLE is True."""
    with (
        patch("services.recognition_provider.UNIVERSAL_AVAILABLE", True),
        patch("services.recognition_provider.get_universal_recognizer") as mock_get,
    ):
        init_recognizer()

        mock_get.assert_called_once()


def test_init_recognizer_not_available():
    """Test init_recognizer when UNIVERSAL_AVAILABLE is False."""
    with (
        patch("services.recognition_provider.UNIVERSAL_AVAILABLE", False),
        patch("services.recognition_provider.get_universal_recognizer") as mock_get,
    ):
        init_recognizer()

        mock_get.assert_not_called()


def test_is_recognizer_available_true():
    """Test is_recognizer_available when recognizer is loaded and available."""
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = True

    with patch(
        "services.recognition_provider.get_universal_recognizer",
        return_value=mock_recognizer,
    ):
        result = is_recognizer_available()

        assert result is True
        mock_recognizer.is_available.assert_called_once()


def test_is_recognizer_available_false_not_loaded():
    """Test is_recognizer_available when recognizer is not loaded."""
    with patch(
        "services.recognition_provider.get_universal_recognizer", return_value=None
    ):
        result = is_recognizer_available()

        assert result is False


def test_is_recognizer_available_false_not_available():
    """Test is_recognizer_available when recognizer loaded but not available."""
    mock_recognizer = MagicMock()
    mock_recognizer.is_available.return_value = False

    with patch(
        "services.recognition_provider.get_universal_recognizer",
        return_value=mock_recognizer,
    ):
        result = is_recognizer_available()

        assert result is False
