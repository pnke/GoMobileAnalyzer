"""
Configuration constants for the Universal Go Recognition Core.
"""


class RecognitionConfig:
    # Preprocessing
    TARGET_SIZE = (32, 32)
    NORMALIZATION_MEAN = [0.485, 0.456, 0.406]
    NORMALIZATION_STD = [0.229, 0.224, 0.225]

    # Patch Extraction
    PATCH_PADDING = 16

    # Adaptive Classification (K-Means)
    KMEANS_CLUSTERS = 5
    RADIUS_RATIO = 0.3

    # Heuristic Thresholds (Luminance 0-255)
    LUM_BLACK_MAX = 80
    LUM_WHITE_MIN = 150
    LUM_MIDPOINT = 128
    HEURISTIC_SAT_THRESHOLD = 60  # Saturation above which intersection is "board color"
    HEURISTIC_LUM_WHITE = 190  # Brightness above which intersection is "white stone"

    # Safety Override
    SAFETY_LUM_MAX = 65
    SAFETY_SAT_MAX = 0.25
