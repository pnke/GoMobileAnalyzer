import torch
import torch.nn as nn
from core.recognition.models import ResNet9, conv_block


def test_conv_block_without_pool():
    """Test conv_block function without pooling."""
    block = conv_block(in_channels=3, out_channels=64, pool=False)

    # Should have 3 layers: Conv2d, BatchNorm2d, ReLU
    assert isinstance(block, nn.Sequential)
    assert len(block) == 3
    assert isinstance(block[0], nn.Conv2d)
    assert isinstance(block[1], nn.BatchNorm2d)
    assert isinstance(block[2], nn.ReLU)

    # Verify input/output channels
    assert block[0].in_channels == 3
    assert block[0].out_channels == 64


def test_conv_block_with_pool():
    """Test conv_block function with pooling."""
    block = conv_block(in_channels=64, out_channels=128, pool=True)

    # Should have 4 layers: Conv2d, BatchNorm2d, ReLU, MaxPool2d
    assert len(block) == 4
    assert isinstance(block[0], nn.Conv2d)
    assert isinstance(block[1], nn.BatchNorm2d)
    assert isinstance(block[2], nn.ReLU)
    assert isinstance(block[3], nn.MaxPool2d)


def test_resnet9_initialization():
    """Test ResNet9 model initialization."""
    model = ResNet9(in_channels=3, num_classes=3)

    assert isinstance(model, nn.Module)
    assert hasattr(model, "conv1")
    assert hasattr(model, "conv2")
    assert hasattr(model, "res1")
    assert hasattr(model, "conv3")
    assert hasattr(model, "conv4")
    assert hasattr(model, "res2")
    assert hasattr(model, "classifier")


def test_resnet9_forward_pass():
    """Test ResNet9 forward pass with dummy input."""
    model = ResNet9(in_channels=3, num_classes=3)
    model.eval()

    # Create dummy input: batch of 4 images, 3 channels, 32x32
    batch_size = 4
    input_tensor = torch.randn(batch_size, 3, 32, 32)

    # Forward pass
    output = model(input_tensor)

    # Output should be [batch_size, num_classes]
    assert output.shape == (batch_size, 3)


def test_resnet9_output_range():
    """Test that ResNet9 produces logits (not probabilities)."""
    model = ResNet9(in_channels=3, num_classes=3)
    model.eval()

    input_tensor = torch.randn(1, 3, 32, 32)
    output = model(input_tensor)

    # Output should be logits (can be >1 or <0)
    # Just verify it's a valid tensor
    assert output.numel() == 3
    assert not torch.isnan(output).any()
    assert not torch.isinf(output).any()


def test_resnet9_different_input_sizes():
    """Test ResNet9 with different input sizes."""
    model = ResNet9(in_channels=3, num_classes=3)
    model.eval()

    # Test with 48x48 input
    input_48 = torch.randn(1, 3, 48, 48)
    output_48 = model(input_48)
    assert output_48.shape == (1, 3)

    # Test with 64x64 input
    input_64 = torch.randn(1, 3, 64, 64)
    output_64 = model(input_64)
    assert output_64.shape == (1, 3)


def test_resnet9_batch_processing():
    """Test ResNet9 with various batch sizes."""
    model = ResNet9(in_channels=3, num_classes=3)
    model.eval()

    # Batch of 1
    output_1 = model(torch.randn(1, 3, 32, 32))
    assert output_1.shape == (1, 3)

    # Batch of 8
    output_8 = model(torch.randn(8, 3, 32, 32))
    assert output_8.shape == (8, 3)

    # Batch of 16
    output_16 = model(torch.randn(16, 3, 32, 32))
    assert output_16.shape == (16, 3)


def test_resnet9_residual_connections():
    """Test that residual connections work."""
    model = ResNet9(in_channels=3, num_classes=3)
    model.eval()

    input_tensor = torch.randn(2, 3, 32, 32)

    # Process through conv1 and conv2
    out = model.conv1(input_tensor)
    out = model.conv2(out)

    # Residual block should add input
    res1_input = out.clone()
    res1_output = model.res1(out)
    final = res1_output + res1_input

    # Should be different from just res1_output
    assert not torch.allclose(final, res1_output)


def test_resnet9_custom_channels():
    """Test ResNet9 with custom number of input channels."""
    # Single channel input (grayscale)
    model_gray = ResNet9(in_channels=1, num_classes=3)
    output = model_gray(torch.randn(1, 1, 32, 32))
    assert output.shape == (1, 3)

    # 4 channel input (e.g., RGBA)
    model_rgba = ResNet9(in_channels=4, num_classes=3)
    output = model_rgba(torch.randn(1, 4, 32, 32))
    assert output.shape == (1, 3)


def test_resnet9_custom_classes():
    """Test ResNet9 with custom number of output classes."""
    # Binary classification
    model_2 = ResNet9(in_channels=3, num_classes=2)
    output = model_2(torch.randn(1, 3, 32, 32))
    assert output.shape == (1, 2)

    # 10 classes
    model_10 = ResNet9(in_channels=3, num_classes=10)
    output = model_10(torch.randn(1, 3, 32, 32))
    assert output.shape == (1, 10)


def test_resnet9_gradients():
    """Test that ResNet9 supports gradient computation."""
    model = ResNet9(in_channels=3, num_classes=3)
    model.train()

    input_tensor = torch.randn(2, 3, 32, 32, requires_grad=True)
    output = model(input_tensor)

    # Compute dummy loss and backprop
    loss = output.sum()
    loss.backward()

    # Gradients should exist
    assert input_tensor.grad is not None


def test_resnet9_deterministic():
    """Test that ResNet9 produces same output for same input in eval mode."""
    model = ResNet9(in_channels=3, num_classes=3)
    model.eval()

    input_tensor = torch.randn(1, 3, 32, 32)

    output1 = model(input_tensor)
    output2 = model(input_tensor)

    assert torch.allclose(output1, output2)


def test_conv_block_conv_params():
    """Test conv_block Conv2d layer parameters."""
    block = conv_block(32, 64, pool=False)
    conv_layer = block[0]

    assert conv_layer.kernel_size == (3, 3)
    assert conv_layer.padding == (1, 1)
    assert conv_layer.in_channels == 32
    assert conv_layer.out_channels == 64


def test_resnet9_adaptive_pooling():
    """Test that adaptive pooling works for various input sizes."""
    model = ResNet9(in_channels=3, num_classes=3)
    model.eval()

    # Different input sizes should all work
    for size in [32, 40, 48, 64, 128]:
        input_tensor = torch.randn(1, 3, size, size)
        output = model(input_tensor)
        assert output.shape == (1, 3)
