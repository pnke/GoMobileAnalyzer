import unittest
import pytest

# Skip tests if torch is not available or broken
try:
    import torch  # noqa: F401 - imported to test availability
except (ImportError, OSError) as e:
    pytest.skip(f"PyTorch not available: {e}", allow_module_level=True)

import numpy as np
from unittest.mock import MagicMock, patch
from services.universal_go_recognizer import UniversalGoRecognizer


class TestUniversalGoRecognizer(unittest.TestCase):
    @patch("services.universal_go_recognizer.UniversalGoRecognizer._load_models")
    def setUp(self, mock_load):
        # Normalize device to CPU for tests
        with patch("torch.device") as mock_device:
            mock_device.return_value = "cpu"
            self.recognizer = UniversalGoRecognizer()

    def test_warp_board_logic(self):
        """Test that _warp_board produces correct output shape and runs without error."""
        # Dummy image 100x100 white
        img = np.ones((100, 100, 3), dtype=np.uint8) * 255
        # Corners at approx boundaries
        corners = np.array([[0, 0], [100, 0], [100, 100], [0, 100]], dtype=np.float32)

        # Warp to 50x50 with 0 margin
        warped = self.recognizer._warp_board(img, corners, output_size=50, margin=0)
        self.assertIsNotNone(warped)
        self.assertEqual(warped.shape, (50, 50, 3))

    def test_detect_corners_structure(self):
        """Test that detect_corners calls the pipeline steps."""
        img = np.zeros((100, 100, 3), dtype=np.uint8)

        # Mock external functions from segmentation module and instance method _find_corners
        with patch("services.universal_go_recognizer.predict_mask") as mock_mask:
            with patch.object(self.recognizer, "_find_corners") as mock_find:
                # Mock mask
                mock_mask.return_value = np.zeros((800, 800), dtype=np.uint8)
                # Mock corners found on 800x800
                mock_find.return_value = np.array(
                    [[0, 0], [800, 0], [800, 800], [0, 800]], dtype=np.float32
                )

                # Mock model existence
                self.recognizer.model = MagicMock()

                corners = self.recognizer.detect_corners(img)

                self.assertIsNotNone(corners)
                # Should detect 4 corners
                self.assertEqual(len(corners), 4)
                # Should be scaled back from 800x800 to 100x100 (Factor 0.125)
                # 0 -> 0, 800 -> 100
                self.assertEqual(corners[1][0], 100)  # x

    def test_classify_from_corners_params(self):
        """Verify that classify_from_corners uses margin=16."""
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        corners = np.array([[0, 0], [10, 0], [10, 10], [0, 10]], dtype=np.float32)

        with patch.object(self.recognizer, "_warp_board") as mock_warp:
            with patch.object(self.recognizer, "_classify_stones") as mock_classify:
                mock_warp.return_value = np.zeros((608, 608, 3), dtype=np.uint8)
                mock_classify.return_value = [[0] * 19] * 19

                self.recognizer.classify_from_corners(img, corners)

                mock_warp.assert_called_once()
                args = mock_warp.call_args
                # Critical check: Must be 16 to match backend training/logic
                self.assertEqual(args.kwargs["margin"], 16)
                self.assertEqual(args.kwargs["output_size"], 608)
