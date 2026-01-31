"""
Example: Using the @augview decorator with Albumentations

This demonstrates the elegant decorator-based API for AugView.
"""

import numpy as np
try:
    import albumentations as A
except ImportError:
    print("Please install albumentations: pip install albumentations")
    exit(1)

from augview import augview, start_server


# Use decorator to wrap your pipeline
@augview(name="Albumentations Pipeline")
def create_pipeline():
    """Create an albumentations augmentation pipeline."""
    return A.Compose([
        A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.8),
        A.HueSaturationValue(hue_shift_limit=20, sat_shift_limit=30, val_shift_limit=20, p=0.7),
        A.GaussNoise(var_limit=(10, 50), p=0.5),
        A.Blur(blur_limit=5, p=0.3),
        A.Rotate(limit=30, p=0.6),
    ])


def main():
    # Create pipeline using decorator
    pipeline = create_pipeline()
    
    # Get the AugView instance attached by the decorator
    viewer = pipeline._augview
    
    # Create a sample colorful image
    sample_image = np.zeros((300, 400, 3), dtype=np.uint8)
    for i in range(300):
        for j in range(400):
            sample_image[i, j] = [
                int(255 * i / 300),
                int(255 * j / 400),
                int(255 * (i + j) / 700)
            ]
    
    # Process and visualize
    viewer.process_image(sample_image)
    
    print("🎨 Starting AugView with decorator-based pipeline...")
    print("   Open http://localhost:8080 in your browser")
    print("   Press Ctrl+C to stop the server")
    
    start_server(viewer=viewer, port=8080, open_browser=True)


if __name__ == "__main__":
    main()
