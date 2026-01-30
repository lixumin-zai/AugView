"""
Transform adapters for different augmentation libraries.
"""

from typing import Any, Callable, Dict, List, Optional, Union
from dataclasses import dataclass
import numpy as np
from PIL import Image


@dataclass
class TransformInfo:
    """Information about a transform for display purposes."""
    name: str
    category: str
    description: str
    params: Dict[str, Any]


class BaseAdapter:
    """Base class for transform library adapters."""
    
    def __init__(self, transform: Any):
        self.transform = transform
        self.name = self._get_name()
        self.params = self._extract_params()
    
    def _get_name(self) -> str:
        return self.transform.__class__.__name__
    
    def _extract_params(self) -> Dict[str, Any]:
        """Extract parameters from the transform."""
        params = {}
        for attr in dir(self.transform):
            if not attr.startswith('_'):
                try:
                    value = getattr(self.transform, attr)
                    if not callable(value) and isinstance(value, (int, float, bool, str, tuple, list)):
                        params[attr] = value
                except:
                    pass
        return params
    
    def apply(self, image: np.ndarray) -> np.ndarray:
        """Apply the transform to an image."""
        raise NotImplementedError
    
    def update_param(self, name: str, value: Any) -> bool:
        """Update a parameter value."""
        try:
            setattr(self.transform, name, value)
            self.params[name] = value
            return True
        except:
            return False


class AlbumentationsAdapter(BaseAdapter):
    """Adapter for Albumentations transforms."""
    
    def _extract_params(self) -> Dict[str, Any]:
        params = {}
        
        # Common Albumentations parameters
        common_params = ['p', 'always_apply']
        
        for attr in dir(self.transform):
            if attr.startswith('_'):
                continue
            try:
                value = getattr(self.transform, attr)
                if not callable(value) and isinstance(value, (int, float, bool, str, tuple, list)):
                    params[attr] = value
            except:
                pass
        
        # Special handling for limit-type parameters
        limit_attrs = ['limit', 'var_limit', 'brightness_limit', 'contrast_limit', 
                       'hue_shift_limit', 'sat_shift_limit', 'val_shift_limit',
                       'rotate_limit', 'scale_limit', 'shift_limit']
        
        for attr in limit_attrs:
            if hasattr(self.transform, attr):
                params[attr] = getattr(self.transform, attr)
        
        return params
    
    def apply(self, image: np.ndarray) -> np.ndarray:
        """Apply Albumentations transform."""
        result = self.transform(image=image)
        return result.get('image', image)
    
    def get_param_specs(self) -> Dict[str, Dict[str, Any]]:
        """Get parameter specifications for UI."""
        specs = {}
        
        # Probability parameter
        if 'p' in self.params:
            specs['p'] = {
                'type': 'float',
                'min': 0.0,
                'max': 1.0,
                'step': 0.05,
                'default': self.params['p'],
                'label': 'Probability'
            }
        
        # Limit parameters (usually tuples)
        for key, value in self.params.items():
            if 'limit' in key and isinstance(value, (tuple, list)):
                specs[key] = {
                    'type': 'range',
                    'min': value[0] if len(value) >= 1 else 0,
                    'max': value[1] if len(value) >= 2 else 1,
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
            elif isinstance(value, float):
                specs[key] = {
                    'type': 'float',
                    'min': 0.0,
                    'max': max(1.0, value * 2),
                    'step': 0.01,
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
            elif isinstance(value, int) and not isinstance(value, bool):
                specs[key] = {
                    'type': 'int',
                    'min': 0,
                    'max': max(100, value * 2),
                    'step': 1,
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
            elif isinstance(value, bool):
                specs[key] = {
                    'type': 'bool',
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
        
        return specs


class TorchvisionAdapter(BaseAdapter):
    """Adapter for torchvision transforms."""
    
    def apply(self, image: np.ndarray) -> np.ndarray:
        """Apply torchvision transform."""
        pil_image = Image.fromarray(image)
        result = self.transform(pil_image)
        
        # Handle tensor output
        if hasattr(result, 'numpy'):
            return (result.numpy() * 255).astype(np.uint8).transpose(1, 2, 0)
        elif hasattr(result, 'permute'):
            return (result.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
        else:
            return np.array(result)
    
    def get_param_specs(self) -> Dict[str, Dict[str, Any]]:
        """Get parameter specifications for UI."""
        specs = {}
        
        for key, value in self.params.items():
            if isinstance(value, float):
                specs[key] = {
                    'type': 'float',
                    'min': 0.0,
                    'max': max(1.0, value * 2),
                    'step': 0.01,
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
            elif isinstance(value, int) and not isinstance(value, bool):
                specs[key] = {
                    'type': 'int',
                    'min': 0,
                    'max': max(512, value * 2),
                    'step': 1,
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
            elif isinstance(value, bool):
                specs[key] = {
                    'type': 'bool',
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
            elif isinstance(value, (tuple, list)) and len(value) == 2:
                specs[key] = {
                    'type': 'range',
                    'min': value[0],
                    'max': value[1],
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
        
        return specs


class CustomAdapter(BaseAdapter):
    """Adapter for custom transform functions."""
    
    def __init__(self, transform: Callable, name: Optional[str] = None, 
                 params: Optional[Dict[str, Any]] = None):
        self.transform = transform
        self.name = name or (transform.__name__ if hasattr(transform, '__name__') else 'CustomTransform')
        self.params = params or {}
    
    def apply(self, image: np.ndarray) -> np.ndarray:
        """Apply custom transform."""
        result = self.transform(image)
        if isinstance(result, dict):
            return result.get('image', image)
        return result
    
    def get_param_specs(self) -> Dict[str, Dict[str, Any]]:
        """Get parameter specifications for UI."""
        specs = {}
        
        for key, value in self.params.items():
            if isinstance(value, float):
                specs[key] = {
                    'type': 'float',
                    'min': 0.0,
                    'max': max(1.0, value * 2),
                    'step': 0.01,
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
            elif isinstance(value, int) and not isinstance(value, bool):
                specs[key] = {
                    'type': 'int',
                    'min': 0,
                    'max': max(100, value * 2),
                    'step': 1,
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
            elif isinstance(value, bool):
                specs[key] = {
                    'type': 'bool',
                    'default': value,
                    'label': key.replace('_', ' ').title()
                }
        
        return specs


def create_adapter(transform: Any) -> BaseAdapter:
    """Create appropriate adapter based on transform type."""
    module = transform.__class__.__module__
    
    if 'albumentations' in module:
        return AlbumentationsAdapter(transform)
    elif 'torchvision' in module:
        return TorchvisionAdapter(transform)
    elif callable(transform):
        return CustomAdapter(transform)
    else:
        raise ValueError(f"Unsupported transform type: {type(transform)}")
