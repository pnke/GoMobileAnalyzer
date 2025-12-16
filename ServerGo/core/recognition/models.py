"""
Neural network model architectures for stone classification.

Contains the ResNet9 architecture used for classifying Go board
intersections as empty, black stone, or white stone.
"""

import torch.nn as nn


def conv_block(in_channels, out_channels, pool=False):
    """
    Create a convolutional block with Conv2d -> BatchNorm -> ReLU.

    Args:
        in_channels: Number of input channels.
        out_channels: Number of output channels.
        pool: If True, add MaxPool2d(2) at the end.

    Returns:
        nn.Sequential: The convolutional block.
    """
    layers = [
        nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1),
        nn.BatchNorm2d(out_channels),
        nn.ReLU(inplace=True),
    ]
    if pool:
        layers.append(nn.MaxPool2d(2))
    return nn.Sequential(*layers)


class ResNet9(nn.Module):
    """
    A simple ResNet-9 architecture for stone classification.
    Input: 3x32x32 (or similar)
    Output: 3 classes (Empty, Black, White)
    """

    def __init__(self, in_channels=3, num_classes=3):
        super().__init__()

        self.conv1 = conv_block(in_channels, 64)
        self.conv2 = conv_block(64, 128, pool=True)  # 16x16

        self.res1 = nn.Sequential(conv_block(128, 128), conv_block(128, 128))

        self.conv3 = conv_block(128, 256, pool=True)  # 8x8
        self.conv4 = conv_block(256, 512, pool=True)  # 4x4

        self.res2 = nn.Sequential(conv_block(512, 512), conv_block(512, 512))

        self.classifier = nn.Sequential(
            nn.AdaptiveMaxPool2d(1), nn.Flatten(), nn.Linear(512, num_classes)
        )

    def forward(self, xb):
        """Forward pass through the network."""
        out = self.conv1(xb)
        out = self.conv2(out)
        out = self.res1(out) + out
        out = self.conv3(out)
        out = self.conv4(out)
        out = self.res2(out) + out
        out = self.classifier(out)
        return out
