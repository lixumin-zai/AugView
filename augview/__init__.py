"""
AugView - Image Augmentation Pipeline Visualizer

A Python toolkit for visualizing image augmentation pipelines
with a beautiful web-based interactive UI.
"""

from .core import AugView, augview, get_current_viewer
from .server import start_server

__version__ = "0.1.0"
__all__ = ["AugView", "augview", "get_current_viewer", "start_server"]
