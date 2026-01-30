"""
Example: Basic usage with Albumentations

This example demonstrates how to use AugView with an Albumentations pipeline.
"""

import numpy as np
from PIL import Image

# Import AugView
from augview import augview, start_server

# Try to import Albumentations
try:
    import albumentations as A
except ImportError:
    print("Please install albumentations: pip install albumentations")
    exit(1)


# Use the @augview decorator to wrap your pipeline creation function
@augview(name="Basic Albumentations Pipeline")
def create_pipeline():
    """Create a basic image augmentation pipeline."""
    return A.Compose([
        A.RandomCrop(width=256, height=256, p=1.0),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.3),
        A.RandomBrightnessContrast(
            brightness_limit=0.2,
            contrast_limit=0.2,
            p=0.5
        ),
        A.GaussNoise(var_limit=(10.0, 50.0), p=0.3),
        A.Blur(blur_limit=7, p=0.2),
        A.HueSaturationValue(
            hue_shift_limit=20,
            sat_shift_limit=30,
            val_shift_limit=20,
            p=0.3
        ),
    ])


def main():
    # Create the pipeline with visualization enabled
    pipeline = create_pipeline()
    
    # Get the viewer instance attached to the pipeline
    viewer = pipeline._augview
    
    # Create a sample image (or load your own)
    # For demo, create a gradient image
    sample_image = np.zeros((512, 512, 3), dtype=np.uint8)
    for i in range(512):
        for j in range(512):
            sample_image[i, j] = [
                int(255 * i / 512),  # Red gradient
                int(255 * j / 512),  # Green gradient
                128                   # Constant blue
            ]
    
    # You can also load an image from file:
    # sample_image = np.array(Image.open("your_image.jpg"))
    
    # Process the image through the pipeline
    viewer.process_image(sample_image)
    
    print("🎨 Starting AugView visualization server...")
    print("   Open http://localhost:8080 in your browser")
    print("   Press Ctrl+C to stop the server")
    
    # Start the visualization server
    start_server(viewer=viewer, port=8080, open_browser=True)


if __name__ == "__main__":
    main()
