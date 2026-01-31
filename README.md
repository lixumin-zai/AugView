# AugView 🎨

Image Augmentation Pipeline Visualizer - A Python toolkit for visualizing image augmentation pipelines with a beautiful web-based interactive UI.

Build with Antigrevity

<p align="center">
  <img src="image.png" alt="alt text">
</p>

## Features

- 🐍 **Python Decorator API** - Wrap existing pipelines with minimal code changes
- 🔄 **Multiple Library Support** - Works with Albumentations, torchvision, and custom transforms
- 🌐 **Real-time Web UI** - Beautiful React-based visualization with WebSocket updates
- ⚙️ **Interactive Parameters** - Adjust transform parameters and see results instantly
- 📊 **Step-by-Step Preview** - View each augmentation step's input and output
- 🖼️ **Image Upload** - Drag & drop to test with your own images

## Installation

```bash
pip install -e .
```

With optional dependencies:
```bash
pip install -e ".[albumentations]"  # For Albumentations support
pip install -e ".[torchvision]"     # For torchvision support
pip install -e ".[all]"              # For all libraries
```

## Quick Start

### With Albumentations

```python
from augview import augview, start_server
import albumentations as A

@augview(name="My Augmentation Pipeline")
def create_pipeline():
    return A.Compose([
        A.RandomCrop(width=256, height=256),
        A.HorizontalFlip(p=0.5),
        A.RandomBrightnessContrast(p=0.2),
        A.GaussNoise(var_limit=(10, 50)),
    ])

pipeline = create_pipeline()

# Load an image and process
import numpy as np
from PIL import Image

image = np.array(Image.open("your_image.jpg"))
pipeline._augview.process_image(image)

# Start visualization server
start_server(port=8080)  # Opens browser to http://localhost:8080
```

### With torchvision

```python
from augview import AugView, start_server
from torchvision import transforms

viewer = AugView(name="Torchvision Pipeline")

transform_list = [
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
]

for t in transform_list:
    viewer.add_transform(t)

# Process image
import numpy as np
image = np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8)
viewer.process_image(image)

start_server(viewer=viewer, port=8080)
```

### With Custom Transforms

```python
from augview import AugView, start_server
import numpy as np

class MyTransform:
    def __init__(self, strength=0.5):
        self.strength = strength
    
    def __call__(self, image):
        return (image * self.strength).astype(np.uint8)

viewer = AugView(name="Custom Pipeline")
viewer.add_transform(MyTransform(strength=0.8), name="Darken")

image = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
viewer.process_image(image)
start_server(viewer=viewer)
```

## Web UI Features

The web interface provides:

- **Pipeline Overview** - See all steps in your augmentation pipeline
- **Step Preview** - Click any step to see its input/output
- **Full Pipeline View** - Compare original vs. final result
- **Parameter Controls** - Adjust parameters with sliders and toggles
- **Enable/Disable Steps** - Toggle individual steps on/off
- **Image Upload** - Test with your own images via drag & drop

## Development

### Building the Frontend

```bash
cd augview/frontend
npm install
npm run build
```

### Running in Development Mode

```bash
# Terminal 1: Backend
python examples/basic_usage.py

# Terminal 2: Frontend dev server (optional)
cd augview/frontend
npm run dev
```

## License

MIT License
