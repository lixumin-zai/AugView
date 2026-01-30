"""
Example: Using torchvision transforms with AugView

This example demonstrates how to use AugView with torchvision transforms.
"""

import numpy as np
from PIL import Image

from augview import AugView, start_server

# Try to import torchvision
try:
    from torchvision import transforms
except ImportError:
    print("Please install torchvision: pip install torchvision")
    exit(1)


def main():
    # Create AugView instance
    viewer = AugView(name="Torchvision Pipeline")
    
    # Define torchvision transforms
    transform_list = [
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(
            brightness=0.2,
            contrast=0.2,
            saturation=0.2,
            hue=0.1
        ),
        transforms.RandomRotation(degrees=15),
        transforms.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0)),
    ]
    
    # Add transforms to viewer
    for t in transform_list:
        viewer.add_transform(t)
    
    # Create a sample image
    sample_image = np.zeros((512, 512, 3), dtype=np.uint8)
    for i in range(512):
        for j in range(512):
            sample_image[i, j] = [
                int(128 + 127 * np.sin(i / 30)),
                int(128 + 127 * np.cos(j / 30)),
                int(128 + 127 * np.sin((i + j) / 40))
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
