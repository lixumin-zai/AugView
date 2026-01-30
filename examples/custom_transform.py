"""
Example: Custom transform functions with AugView

This example demonstrates how to use AugView with custom transform functions.
"""

import numpy as np
from PIL import Image
import cv2  # Optional, for more complex transforms

from augview import AugView, start_server


class GrayscaleTransform:
    """Custom transform that converts image to grayscale."""
    
    def __init__(self, keep_channels: bool = True):
        self.keep_channels = keep_channels
    
    def __call__(self, image: np.ndarray) -> np.ndarray:
        gray = np.mean(image, axis=2, keepdims=True).astype(np.uint8)
        if self.keep_channels:
            return np.repeat(gray, 3, axis=2)
        return gray.squeeze()


class InvertTransform:
    """Custom transform that inverts colors."""
    
    def __init__(self, strength: float = 1.0):
        self.strength = strength
    
    def __call__(self, image: np.ndarray) -> np.ndarray:
        inverted = 255 - image
        return (image * (1 - self.strength) + inverted * self.strength).astype(np.uint8)


class SepiaTransform:
    """Custom transform that applies sepia effect."""
    
    def __init__(self, intensity: float = 0.8):
        self.intensity = intensity
    
    def __call__(self, image: np.ndarray) -> np.ndarray:
        # Ensure image is (H, W, 3)
        if len(image.shape) != 3 or image.shape[2] != 3:
            return image
        
        # Sepia matrix - apply per pixel
        sepia_matrix = np.array([
            [0.393, 0.769, 0.189],
            [0.349, 0.686, 0.168],
            [0.272, 0.534, 0.131]
        ])
        
        # Reshape for matrix multiplication: (H*W, 3) @ (3, 3).T -> (H*W, 3)
        h, w, c = image.shape
        flat = image.reshape(-1, 3).astype(np.float32)
        sepia = flat @ sepia_matrix.T
        sepia = sepia.reshape(h, w, 3)
        sepia = np.clip(sepia, 0, 255).astype(np.uint8)
        
        return (image * (1 - self.intensity) + sepia * self.intensity).astype(np.uint8)


class VignetteTransform:
    """Custom transform that applies vignette effect."""
    
    def __init__(self, strength: float = 0.5, radius: float = 0.8):
        self.strength = strength
        self.radius = radius
    
    def __call__(self, image: np.ndarray) -> np.ndarray:
        # Ensure image is at least 2D
        if len(image.shape) < 2:
            return image
            
        h, w = image.shape[:2]
        
        # Create vignette mask
        y, x = np.ogrid[:h, :w]
        center_y, center_x = h / 2, w / 2
        
        # Distance from center normalized
        dist = np.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
        max_dist = np.sqrt(center_x ** 2 + center_y ** 2)
        dist = dist / max_dist
        
        # Create vignette
        vignette = 1 - (dist / max(self.radius, 0.1)) ** 2 * self.strength
        vignette = np.clip(vignette, 0, 1)
        
        # Handle different image shapes
        if len(image.shape) == 3:
            vignette = vignette[:, :, np.newaxis]
        
        return (image * vignette).astype(np.uint8)


class PixelateTransform:
    """Custom transform that pixelates the image."""
    
    def __init__(self, block_size: int = 8):
        self.block_size = block_size
    
    def __call__(self, image: np.ndarray) -> np.ndarray:
        # Ensure block_size is at least 1
        block_size = max(1, int(self.block_size))
        
        h, w = image.shape[:2]
        
        # Downscale then upscale
        small_h = max(1, h // block_size)
        small_w = max(1, w // block_size)
        
        small = Image.fromarray(image).resize((small_w, small_h), Image.Resampling.NEAREST)
        pixelated = small.resize((w, h), Image.Resampling.NEAREST)
        
        return np.array(pixelated)


def main():
    # Create AugView instance
    viewer = AugView(name="Custom Transforms Pipeline")
    
    # Add custom transforms
    viewer.add_transform(GrayscaleTransform(keep_channels=True), name="Grayscale")
    viewer.add_transform(InvertTransform(strength=0.5), name="Invert Colors")
    viewer.add_transform(SepiaTransform(intensity=0.7), name="Sepia Effect")
    viewer.add_transform(VignetteTransform(strength=0.6), name="Vignette")
    viewer.add_transform(PixelateTransform(block_size=4), name="Pixelate")
    
    # Create a sample image with some patterns
    sample_image = np.zeros((400, 400, 3), dtype=np.uint8)
    
    # Create a colorful pattern
    for i in range(400):
        for j in range(400):
            # Checkerboard with gradient
            checker = ((i // 40) + (j // 40)) % 2
            sample_image[i, j] = [
                int(200 * checker + 55 * (i / 400)),
                int(100 + 155 * (j / 400)),
                int(200 * (1 - checker) + 55 * ((i + j) / 800))
            ]
    
    # Process the image
    viewer.process_image(sample_image)
    
    print("🎨 Starting AugView visualization server...")
    print("   Open http://localhost:8080 in your browser")
    print("   Press Ctrl+C to stop the server")
    
    # Start server
    start_server(viewer=viewer, port=8080, open_browser=True)


if __name__ == "__main__":
    main()
