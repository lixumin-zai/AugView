"""
Core module for AugView - Pipeline tracking and decorator API
"""

import base64
import io
import uuid
import functools
import inspect
import random
from typing import Any, Callable, Dict, List, Optional, Union
from dataclasses import dataclass, field
from PIL import Image
import numpy as np

# Global viewer instance
_current_viewer: Optional["AugView"] = None


def convert_to_native(obj):
    """Convert numpy types and other non-serializable types to Python native types for JSON serialization."""
    from enum import Enum
    
    if obj is None:
        return None
    elif isinstance(obj, (str, int, float, bool)):
        return obj
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.bool_, np.bool8)):
        return bool(obj)
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, Enum):
        return obj.name  # Convert enum to its name string
    elif isinstance(obj, dict):
        return {str(k): convert_to_native(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_native(v) for v in obj]
    elif hasattr(obj, '__dict__'):
        # For objects with __dict__, try to serialize their attributes
        return str(obj)
    else:
        # Fallback: convert to string representation
        try:
            return str(obj)
        except:
            return None


def get_current_viewer() -> Optional["AugView"]:
    """Get the current active AugView instance."""
    return _current_viewer


@dataclass
class TransformStep:
    """Represents a single step in the augmentation pipeline."""
    id: str
    name: str
    transform_type: str  # 'albumentations', 'torchvision', 'custom'
    params: Dict[str, Any]
    param_specs: Dict[str, Dict[str, Any]]  # Parameter specifications for UI
    input_image: Optional[str] = None  # Base64 encoded
    output_image: Optional[str] = None  # Base64 encoded
    enabled: bool = True
    applied: bool = True  # Whether transform was actually applied (for probability)
    probability: Optional[float] = None  # The 'p' value if exists
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "transform_type": self.transform_type,
            "params": convert_to_native(self.params),
            "param_specs": convert_to_native(self.param_specs),
            "input_image": self.input_image,
            "output_image": self.output_image,
            "enabled": bool(self.enabled),
            "applied": bool(self.applied),
            "probability": float(self.probability) if self.probability is not None else None,
        }


@dataclass
class Pipeline:
    """Represents the complete augmentation pipeline."""
    id: str
    name: str
    steps: List[TransformStep] = field(default_factory=list)
    original_image: Optional[str] = None  # Base64 encoded
    final_image: Optional[str] = None  # Base64 encoded
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "steps": [step.to_dict() for step in self.steps],
            "original_image": self.original_image,
            "final_image": self.final_image,
        }


class AugView:
    """Main class for tracking and visualizing augmentation pipelines."""
    
    def __init__(self, name: str = "Augmentation Pipeline"):
        self.name = name
        self.pipeline = Pipeline(
            id=str(uuid.uuid4()),
            name=name,
            steps=[]
        )
        self._transforms = []
        self._update_callbacks: List[Callable] = []
        self._last_image: Optional[np.ndarray] = None
        
        global _current_viewer
        _current_viewer = self
    
    def register_callback(self, callback: Callable):
        """Register a callback for pipeline updates."""
        self._update_callbacks.append(callback)
    
    def _notify_update(self):
        """Notify all registered callbacks of pipeline update."""
        for callback in self._update_callbacks:
            try:
                callback(self.pipeline)
            except Exception as e:
                print(f"Callback error: {e}")
    
    @staticmethod
    def image_to_base64(image: Union[Image.Image, np.ndarray]) -> str:
        """Convert image to base64 string."""
        if isinstance(image, np.ndarray):
            # Handle different array shapes
            if len(image.shape) == 2:
                image = np.stack([image] * 3, axis=-1)
            elif image.shape[-1] == 4:
                image = image[:, :, :3]
            image = Image.fromarray(image.astype(np.uint8))
        
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    @staticmethod
    def base64_to_image(b64_string: str) -> np.ndarray:
        """Convert base64 string to numpy array."""
        image_data = base64.b64decode(b64_string)
        image = Image.open(io.BytesIO(image_data))
        return np.array(image)
    
    def _extract_param_specs(self, transform: Any) -> Dict[str, Dict[str, Any]]:
        """Extract parameter specifications from a transform for UI generation."""
        specs = {}
        
        # Get from __init__ signature
        try:
            sig = inspect.signature(transform.__class__.__init__)
            for param_name, param in sig.parameters.items():
                if param_name in ('self', 'args', 'kwargs'):
                    continue
                
                spec = {"name": param_name, "type": "unknown"}
                
                # Special handling for probability 'p'
                if param_name == 'p':
                    spec["type"] = "float"
                    spec["min"] = 0.0
                    spec["max"] = 1.0
                    spec["step"] = 0.05
                    spec["label"] = "Probability"
                    spec["is_probability"] = True
                
                # Try to infer type from annotation or default
                elif param.annotation != inspect.Parameter.empty:
                    anno = param.annotation
                    if anno == float or anno == Optional[float]:
                        spec["type"] = "float"
                        spec["min"] = 0.0
                        spec["max"] = 1.0
                        spec["step"] = 0.01
                    elif anno == int or anno == Optional[int]:
                        spec["type"] = "int"
                        spec["min"] = 0
                        spec["max"] = 100
                        spec["step"] = 1
                    elif anno == bool:
                        spec["type"] = "bool"
                
                if param.default != inspect.Parameter.empty:
                    spec["default"] = param.default
                    
                    # Infer type from default value
                    if isinstance(param.default, float):
                        spec["type"] = "float"
                        spec["min"] = 0.0
                        spec["max"] = max(1.0, param.default * 2)
                        spec["step"] = 0.01
                    elif isinstance(param.default, int) and not isinstance(param.default, bool):
                        spec["type"] = "int"
                        spec["min"] = 0
                        spec["max"] = max(100, param.default * 2)
                        spec["step"] = 1
                    elif isinstance(param.default, bool):
                        spec["type"] = "bool"
                    elif isinstance(param.default, tuple) and len(param.default) == 2:
                        spec["type"] = "range"
                        spec["min"] = param.default[0]
                        spec["max"] = param.default[1]
                
                specs[param_name] = spec
        except Exception:
            pass
        
        return specs
    
    def _get_transform_params(self, transform: Any) -> Dict[str, Any]:
        """Extract current parameter values from a transform."""
        params = {}
        
        # Get stored attributes
        for attr in dir(transform):
            if not attr.startswith('_'):
                try:
                    value = getattr(transform, attr)
                    if not callable(value) and not isinstance(value, type):
                        # Only include serializable values
                        if isinstance(value, (int, float, bool, str, tuple, list)):
                            params[attr] = value
                except Exception:
                    pass
        
        return params
    
    def _get_probability(self, transform: Any) -> Optional[float]:
        """Get the probability 'p' from a transform if it exists."""
        if hasattr(transform, 'p'):
            return float(transform.p)
        return None
    
    def add_transform(self, transform: Any, name: Optional[str] = None) -> TransformStep:
        """Add a transform to the pipeline."""
        # Detect transform type
        transform_type = "custom"
        class_name = transform.__class__.__name__
        module = transform.__class__.__module__
        
        if "albumentations" in module:
            transform_type = "albumentations"
        elif "torchvision" in module:
            transform_type = "torchvision"
        
        probability = self._get_probability(transform)
        
        step = TransformStep(
            id=str(uuid.uuid4()),
            name=name or class_name,
            transform_type=transform_type,
            params=self._get_transform_params(transform),
            param_specs=self._extract_param_specs(transform),
            probability=probability,
        )
        
        self._transforms.append((transform, step))
        self.pipeline.steps.append(step)
        
        return step
    
    def wrap_compose(self, compose: Any) -> Any:
        """Wrap an Albumentations Compose or similar pipeline."""
        transforms = []
        
        # Extract transforms from Compose
        if hasattr(compose, 'transforms'):
            transforms = compose.transforms
        elif hasattr(compose, 'transform'):
            transforms = compose.transform.transforms if hasattr(compose.transform, 'transforms') else [compose.transform]
        
        for t in transforms:
            self.add_transform(t)
        
        return compose
    
    def _check_transform_applied(self, input_img: np.ndarray, output_img: np.ndarray) -> bool:
        """Check if a transform was actually applied by comparing images."""
        if input_img.shape != output_img.shape:
            return True
        # Quick check: compare a sample of pixels
        diff = np.abs(input_img.astype(float) - output_img.astype(float)).mean()
        return diff > 0.5  # Threshold for "different enough"
    
    def process_image(self, image: Union[Image.Image, np.ndarray], pipeline_func: Optional[Callable] = None) -> np.ndarray:
        """Process an image through the pipeline and capture each step."""
        if isinstance(image, Image.Image):
            image = np.array(image)
        
        # Store for re-running
        self._last_image = image.copy()
        
        self.pipeline.original_image = self.image_to_base64(image)
        current_image = image.copy()
        
        for transform, step in self._transforms:
            # If step is disabled, skip it but keep input/output from previous
            if not step.enabled:
                step.input_image = self.image_to_base64(current_image)
                step.output_image = self.image_to_base64(current_image)
                step.applied = False
                continue
            
            step.input_image = self.image_to_base64(current_image)
            input_for_comparison = current_image.copy()
            
            try:
                # Apply transform based on type
                if step.transform_type == "albumentations":
                    result = transform(image=current_image)
                    current_image = result.get("image", current_image)
                elif step.transform_type == "torchvision":
                    # Convert to PIL for torchvision
                    pil_image = Image.fromarray(current_image)
                    result = transform(pil_image)
                    if hasattr(result, 'numpy'):
                        current_image = result.numpy()
                    else:
                        current_image = np.array(result)
                else:
                    # Custom transform
                    result = transform(current_image)
                    if isinstance(result, dict):
                        current_image = result.get("image", current_image)
                    else:
                        current_image = result
                
                # Ensure proper dtype
                if current_image.dtype != np.uint8:
                    if current_image.max() <= 1.0:
                        current_image = (current_image * 255).astype(np.uint8)
                    else:
                        current_image = current_image.astype(np.uint8)
                
                # Ensure 3 channels (some transforms may change this)
                if len(current_image.shape) == 2:
                    current_image = np.stack([current_image] * 3, axis=-1)
                elif len(current_image.shape) == 3 and current_image.shape[-1] == 1:
                    current_image = np.repeat(current_image, 3, axis=-1)
                elif len(current_image.shape) == 3 and current_image.shape[-1] == 4:
                    current_image = current_image[:, :, :3]
                
                step.output_image = self.image_to_base64(current_image)
                
                # Check if transform was actually applied (for probability-based transforms)
                step.applied = self._check_transform_applied(input_for_comparison, current_image)
                
            except Exception as e:
                print(f"Error in transform {step.name}: {e}")
                step.output_image = step.input_image
                step.applied = False
        
        self.pipeline.final_image = self.image_to_base64(current_image)
        self._notify_update()
        
        return current_image
    
    def rerun(self) -> Optional[np.ndarray]:
        """Re-run the pipeline with the last image (with new random seed)."""
        if self._last_image is not None:
            return self.process_image(self._last_image)
        elif self.pipeline.original_image:
            image = self.base64_to_image(self.pipeline.original_image)
            return self.process_image(image)
        return None
    
    def update_step_param(self, step_id: str, param_name: str, value: Any) -> bool:
        """Update a parameter for a specific step."""
        for transform, step in self._transforms:
            if step.id == step_id:
                try:
                    setattr(transform, param_name, value)
                    step.params[param_name] = value
                    
                    # Update probability if 'p' changed
                    if param_name == 'p':
                        step.probability = float(value)
                    
                    # Re-run pipeline to show updated results
                    self.rerun()
                    return True
                except Exception as e:
                    print(f"Error updating param: {e}")
                    return False
        return False
    
    def toggle_step(self, step_id: str, enabled: bool) -> bool:
        """Enable or disable a specific step."""
        for _, step in self._transforms:
            if step.id == step_id:
                step.enabled = enabled
                # Re-run pipeline to show effect of toggle
                self.rerun()
                return True
        return False


def augview(name: str = "Augmentation Pipeline"):
    """
    Decorator to wrap an augmentation pipeline creation function.
    
    Usage:
        @augview(name="My Pipeline")
        def create_pipeline():
            return A.Compose([...])
        
        pipeline = create_pipeline()
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            viewer = AugView(name=name)
            result = func(*args, **kwargs)
            
            # Try to wrap the result if it's a Compose-like object
            if hasattr(result, 'transforms') or hasattr(result, 'transform'):
                viewer.wrap_compose(result)
            
            # Attach viewer to result for access
            result._augview = viewer
            
            return result
        return wrapper
    return decorator
