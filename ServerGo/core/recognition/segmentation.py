"""
Segmentation module for Go board recognition.
Handles DeepLabV3+ mask prediction with TTA.
"""

import cv2
import numpy as np
import torch
from torchvision import transforms
from typing import Tuple


def predict_mask(model, image: np.ndarray, device: torch.device) -> np.ndarray:
    """
    Predict board mask from image (RGB) using DeepLabV3+.
    Uses Test-Time Augmentation (horizontal flip).

    Args:
        model: DeepLabV3+ model
        image: RGB image (numpy array)
        device: torch device

    Returns:
        Binary mask (0 or 255)
    """
    input_image = cv2.resize(image, (520, 520))
    t = transforms.Compose(
        [
            transforms.ToPILImage(),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    input_tensor = t(input_image).unsqueeze(0).to(device)

    # Test-Time Augmentation (Horizontal Flip)
    input_flipped = torch.flip(input_tensor, [3])

    with torch.no_grad():
        output = model(input_tensor)["out"][0]
        output_flipped = model(input_flipped)["out"][0]

    prob_orig = torch.sigmoid(output).cpu().numpy()[0]
    prob_flipped = torch.sigmoid(output_flipped).cpu().numpy()[0]
    prob_flipped_back = np.fliplr(prob_flipped)

    # Average
    prob_avg = (prob_orig + prob_flipped_back) / 2.0
    pred_mask = prob_avg > 0.5

    return pred_mask.astype(np.uint8) * 255  # type: ignore


def cleanup_mask(mask: np.ndarray, target_size: Tuple[int, int]) -> np.ndarray:
    """
    Clean up mask morphology.

    Args:
        mask: Raw prediction mask
        target_size: (width, height) to resize to

    Returns:
        Cleaned binary mask
    """
    from skimage.transform import resize
    from skimage import measure

    mask_resized = resize(mask.astype(float) / 255, (target_size[1], target_size[0]))
    mask_binary = (mask_resized > 0.5).astype(np.uint8) * 255

    # Reduced kernel 5x5
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    eroded = cv2.erode(mask_binary, kernel, iterations=2)

    labels = measure.label(eroded)
    if labels.max() > 0:
        largest = np.argmax(np.bincount(labels.flat)[1:]) + 1
        eroded_clean = (labels == largest).astype(np.uint8) * 255
    else:
        eroded_clean = eroded

    mask_clean = cv2.dilate(eroded_clean, kernel, iterations=2)
    return mask_clean
