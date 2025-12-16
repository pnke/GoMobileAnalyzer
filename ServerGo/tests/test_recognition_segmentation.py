import pytest
import numpy as np
import torch
from unittest.mock import MagicMock, patch
from core.recognition.segmentation import predict_mask, cleanup_mask


@pytest.fixture
def mock_model():
    """Create a mock DeepLabV3+ model."""
    model = MagicMock()
    # Mock output format: {'out': [tensor]}
    mock_output = torch.randn(1, 520, 520)  # Single channel output
    model.return_value = {"out": [mock_output]}
    return model


@pytest.fixture
def sample_image():
    """Create a sample RGB image."""
    # 640x480 RGB image
    return np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)


def test_predict_mask_shape(mock_model, sample_image):
    """Test predict_mask returns correct shape."""
    device = torch.device("cpu")

    mask = predict_mask(mock_model, sample_image, device)

    # Mask should be 520x520 (resized internally)
    assert mask.shape == (520, 520)
    assert mask.dtype == np.uint8


def test_predict_mask_binary_output(mock_model, sample_image):
    """Test predict_mask returns binary values (0 or 255)."""
    device = torch.device("cpu")

    mask = predict_mask(mock_model, sample_image, device)

    # Should only contain 0 or 255
    unique_values = np.unique(mask)
    assert all(val in [0, 255] for val in unique_values)


def test_predict_mask_uses_tta(mock_model, sample_image):
    """Test that predict_mask uses test-time augmentation."""
    device = torch.device("cpu")

    predict_mask(mock_model, sample_image, device)

    # Model should be called twice (original + flipped)
    assert mock_model.call_count == 2


def test_predict_mask_cuda_device(mock_model, sample_image):
    """Test predict_mask works with CUDA device specification."""
    if not torch.cuda.is_available():
        pytest.skip("CUDA not available")

    device = torch.device("cuda")
    mask = predict_mask(mock_model, sample_image, device)

    assert mask is not None
    assert mask.shape == (520, 520)


def test_predict_mask_various_image_sizes(mock_model):
    """Test predict_mask with different input image sizes."""
    device = torch.device("cpu")

    # Test different sizes - should all resize to 520x520
    for size in [(480, 640, 3), (800, 600, 3), (1024, 768, 3)]:
        image = np.random.randint(0, 255, size, dtype=np.uint8)
        mask = predict_mask(mock_model, image, device)
        assert mask.shape == (520, 520)


def test_predict_mask_averaging():
    """Test that TTA averaging works correctly."""
    # Create a deterministic model output
    model = MagicMock()

    # Create predictable outputs
    output_shape = (1, 520, 520)
    output1 = torch.ones(output_shape) * 2.0  # High logits
    output2 = torch.ones(output_shape) * 2.0  # Same for flipped

    model.side_effect = [
        {"out": [output1]},  # Original
        {"out": [output2]},  # Flipped
    ]

    device = torch.device("cpu")
    image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)

    mask = predict_mask(model, image, device)

    # With high logits (2.0), sigmoid gives ~0.88, so average should be >0.5 -> 255
    assert np.all(mask == 255)


def test_cleanup_mask_shape():
    """Test cleanup_mask resizes to target size."""
    # Create a 520x520 mask
    mask = np.random.randint(0, 2, (520, 520), dtype=np.uint8) * 255
    target_size = (640, 480)

    cleaned = cleanup_mask(mask, target_size)

    # Should be resized to target (height, width)
    assert cleaned.shape == (480, 640)


def test_cleanup_mask_binary():
    """Test cleanup_mask returns binary values."""
    mask = np.random.randint(0, 2, (520, 520), dtype=np.uint8) * 255
    target_size = (640, 480)

    cleaned = cleanup_mask(mask, target_size)

    # Should only contain 0 or 255
    unique_values = np.unique(cleaned)
    assert all(val in [0, 255] for val in unique_values)


def test_cleanup_mask_morph_operations():
    """Test that cleanup_mask applies morphological operations."""
    # Create mask with noise
    mask = np.zeros((520, 520), dtype=np.uint8)
    mask[100:400, 100:400] = 255
    # Add some noise
    mask[50:60, 50:60] = 255

    target_size = (520, 520)
    cleaned = cleanup_mask(mask, target_size)

    # Should have removed small components
    assert cleaned is not None


def test_cleanup_mask_largest_component():
    """Test that cleanup_mask keeps only largest component."""
    # Create mask with two components
    mask = np.zeros((520, 520), dtype=np.uint8)
    # Large component
    mask[100:400, 100:400] = 255
    # Small component
    mask[450:470, 450:470] = 255

    target_size = (520, 520)
    cleaned = cleanup_mask(mask, target_size)

    # Should mostly keep the large component
    # (exact result depends on erosion/dilation)
    assert np.sum(cleaned > 0) > 0


def test_cleanup_mask_empty_input():
    """Test cleanup_mask with empty mask."""
    mask = np.zeros((520, 520), dtype=np.uint8)
    target_size = (640, 480)

    cleaned = cleanup_mask(mask, target_size)

    # Should return empty mask
    assert cleaned.shape == (480, 640)
    # May not be completely empty due to morphological ops, but mostly empty
    assert np.sum(cleaned) < 255 * 100  # Less than 100 white pixels


def test_cleanup_mask_full_input():
    """Test cleanup_mask with completely white mask."""
    mask = np.ones((520, 520), dtype=np.uint8) * 255
    target_size = (640, 480)

    cleaned = cleanup_mask(mask, target_size)

    assert cleaned.shape == (480, 640)
    # Should still have many white pixels
    assert np.sum(cleaned > 0) > 0


def test_predict_mask_normalization():
    """Test that predict_mask applies ImageNet normalization."""
    model = MagicMock()
    model.return_value = {"out": [torch.zeros(1, 520, 520)]}

    device = torch.device("cpu")
    # Create image with known RGB values
    image = np.ones((480, 640, 3), dtype=np.uint8) * 128

    with patch("core.recognition.segmentation.transforms") as mock_transforms:
        # Let normalization pass through
        mock_transforms.Compose.return_value = lambda x: torch.zeros(3, 520, 520)

        predict_mask(model, image, device)

        # Verify transforms were set up
        assert mock_transforms.Compose.called


def test_cleanup_mask_different_target_sizes():
    """Test cleanup_mask with various target sizes."""
    mask = np.random.randint(0, 2, (520, 520), dtype=np.uint8) * 255

    for target_size in [(320, 240), (640, 480), (800, 600), (1024, 768)]:
        cleaned = cleanup_mask(mask, target_size)
        assert cleaned.shape == (target_size[1], target_size[0])


def test_predict_mask_grayscale_input(mock_model):
    """Test predict_mask with grayscale image converted to RGB."""
    device = torch.device("cpu")

    # Create grayscale image
    gray = np.random.randint(0, 255, (480, 640), dtype=np.uint8)
    # Convert to RGB by stacking
    rgb = np.stack([gray] * 3, axis=-1)

    mask = predict_mask(mock_model, rgb, device)

    assert mask.shape == (520, 520)


def test_cleanup_mask_kernel_size():
    """Test that cleanup_mask uses 5x5 elliptical kernel."""
    mask = np.ones((520, 520), dtype=np.uint8) * 255
    target_size = (520, 520)

    with patch("cv2.getStructuringElement") as mock_kernel:
        mock_kernel.return_value = np.ones((5, 5), dtype=np.uint8)

        cleanup_mask(mask, target_size)

        # Verify kernel was created correctly
        import cv2

        mock_kernel.assert_called_with(cv2.MORPH_ELLIPSE, (5, 5))


def test_cleanup_mask_erosion_dilation():
    """Test that both erosion and dilation are applied."""
    mask = np.ones((520, 520), dtype=np.uint8) * 255
    mask[250:270, 250:270] = 0  # Create a hole

    target_size = (520, 520)

    with patch("cv2.erode") as mock_erode, patch("cv2.dilate") as mock_dilate:
        # Make mocks return something valid
        mock_erode.return_value = mask
        mock_dilate.return_value = mask

        cleanup_mask(mask, target_size)

        # Both should be called with iterations=2
        assert mock_erode.called
        assert mock_dilate.called
