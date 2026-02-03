import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { Handle, Position, NodeResizer } from 'reactflow'
import { Eye, EyeOff, Check, X, ZoomIn } from 'lucide-react'
import ImageLightbox from '../ImageLightbox'

function TransformNode({ data, selected }) {
    const { step, onParamUpdate, onToggleStep } = data
    const [localParams, setLocalParams] = useState({})
    const [lightboxOpen, setLightboxOpen] = useState(false)

    useEffect(() => {
        if (step?.params) {
            setLocalParams({ ...step.params })
        }
    }, [step?.id, step?.params])

    // Update local state only (no API call)
    const handleLocalChange = (paramName, value) => {
        setLocalParams(prev => ({ ...prev, [paramName]: value }))
    }

    // Commit change to server (on blur, Enter, or mouseup for sliders)
    const handleCommit = useCallback((paramName, value) => {
        onParamUpdate(step.id, paramName, value)
    }, [onParamUpdate, step?.id])

    // Legacy handler for boolean toggles (immediate update)
    const handleChange = (paramName, value) => {
        setLocalParams(prev => ({ ...prev, [paramName]: value }))
        onParamUpdate(step.id, paramName, value)
    }

    const formatLabel = (name) => {
        return name
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
    }

    const isEditableParam = (name) => {
        const exclude = ['always_apply', 'interpolation', 'border_mode', 'mask_interpolation',
            'p_replace', 'fill_value', 'mask_fill_value', 'value', 'mask_value']
        return !exclude.includes(name.toLowerCase())
    }

    const inferType = (value) => {
        if (typeof value === 'boolean') return 'bool'
        if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float'
        if (typeof value === 'string') return 'string'
        if (Array.isArray(value)) {
            // Check if it's a numeric range (2 numbers)
            if (value.length === 2 && value.every(v => typeof v === 'number')) {
                return 'range'
            }
            // Check if it's a list of numbers (like kernel sizes)
            if (value.every(v => typeof v === 'number')) {
                return 'numlist'
            }
            return 'list'
        }
        if (typeof value === 'object' && value !== null) return 'object'
        return 'unknown'
    }

    const params = Object.entries(step?.params || {})
        .filter(([key, value]) => {
            if (key.startsWith('_')) return false
            if (!isEditableParam(key)) return false
            // Filter out complex objects that aren't useful
            const type = inferType(value)
            return type !== 'object' && type !== 'unknown' && type !== 'list'
        })
        .sort(([a], [b]) => {
            const priority = ['p', 'probability', 'scale', 'limit', 'blur', 'var', 'shift',
                'brightness', 'contrast', 'saturation', 'hue', 'degrees', 'strength', 'alpha']
            const aIdx = priority.findIndex(p => a.toLowerCase().includes(p))
            const bIdx = priority.findIndex(p => b.toLowerCase().includes(p))
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
            if (aIdx !== -1) return -1
            if (bIdx !== -1) return 1
            return a.localeCompare(b)
        })
        .slice(0, 8) // Show more params

    const renderParam = (paramName, value, spec) => {
        const paramSpec = spec || step.param_specs?.[paramName] || {}
        const type = paramSpec.type || inferType(value)
        const localValue = localParams[paramName] ?? value

        if (type === 'float' || type === 'int') {
            const min = paramSpec.min ?? 0
            const max = paramSpec.max ?? (type === 'float' ? 1 : 100)
            const stepVal = paramSpec.step ?? (type === 'float' ? 0.01 : 1)

            const parseValue = (val) => type === 'float' ? parseFloat(val) : parseInt(val)

            return (
                <div className="node-param" key={paramName}>
                    <div className="node-param-header">
                        <span className="node-param-label">{formatLabel(paramName)}</span>
                        <span className="node-param-value">
                            {type === 'float' ? Number(localValue).toFixed(2) : localValue}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={stepVal}
                        value={localValue}
                        onChange={(e) => handleLocalChange(paramName, parseValue(e.target.value))}
                        onMouseUp={(e) => handleCommit(paramName, parseValue(e.target.value))}
                        onTouchEnd={(e) => handleCommit(paramName, parseValue(e.target.value))}
                        className="node-slider nodrag"
                    />
                </div>
            )
        }

        if (type === 'bool') {
            return (
                <div className="node-param node-param-bool" key={paramName}>
                    <span className="node-param-label">{formatLabel(paramName)}</span>
                    <div
                        className={`node-toggle ${localValue ? 'active' : ''} nodrag`}
                        onClick={() => handleChange(paramName, !localValue)}
                    />
                </div>
            )
        }

        // Handle range/tuple parameters like scale_limit=(-0.5, -0.3)
        if (type === 'range' && Array.isArray(localValue) && localValue.length === 2) {
            // Update local state only
            const handleRangeLocalChange = (index, newVal) => {
                const newRange = [...localValue]
                newRange[index] = parseFloat(newVal)
                handleLocalChange(paramName, newRange)
            }

            // Commit to server
            const handleRangeCommit = () => {
                handleCommit(paramName, localValue)
            }

            // Handle Enter key
            const handleKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.target.blur()
                }
            }

            return (
                <div className="node-param node-param-range" key={paramName}>
                    <div className="node-param-header">
                        <span className="node-param-label">{formatLabel(paramName)}</span>
                    </div>
                    <div className="node-range-inputs nodrag">
                        <input
                            type="number"
                            step="0.1"
                            value={Number(localValue[0]).toFixed(2)}
                            onChange={(e) => handleRangeLocalChange(0, e.target.value)}
                            onBlur={handleRangeCommit}
                            onKeyDown={handleKeyDown}
                            className="node-range-input"
                        />
                        <span className="node-range-separator">~</span>
                        <input
                            type="number"
                            step="0.1"
                            value={Number(localValue[1]).toFixed(2)}
                            onChange={(e) => handleRangeLocalChange(1, e.target.value)}
                            onBlur={handleRangeCommit}
                            onKeyDown={handleKeyDown}
                            className="node-range-input"
                        />
                    </div>
                </div>
            )
        }

        return null
    }

    if (!step) return null

    const imageSrc = step.output_image ? `data:image/png;base64,${step.output_image}` : null

    return (
        <>
            <div className={`transform-node ${selected ? 'selected' : ''} ${!step.enabled ? 'disabled' : ''}`}>
                <NodeResizer
                    minWidth={180}
                    minHeight={200}
                    isVisible={selected}
                    lineClassName="node-resizer-line"
                    handleClassName="node-resizer-handle"
                />
                <Handle type="target" position={Position.Left} className="node-handle" />

                {/* Header */}
                <div className="node-header">
                    <div className="node-title-row">
                        <span className="node-title">{step.name}</span>
                        {step.enabled && step.probability !== null && (
                            <span className={`node-applied ${step.applied ? 'applied' : 'skipped'}`}>
                                {step.applied ? <Check size={10} /> : <X size={10} />}
                            </span>
                        )}
                    </div>
                    <div className="node-meta">
                        <span className="node-type">{step.transform_type}</span>
                        {step.probability !== null && (
                            <span className="node-probability">p={step.probability.toFixed(2)}</span>
                        )}
                        <button
                            className={`node-toggle-btn nodrag ${step.enabled ? '' : 'off'}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggleStep(step.id, !step.enabled)
                            }}
                            title={step.enabled ? 'Disable' : 'Enable'}
                        >
                            {step.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                    </div>
                </div>

                {/* Parameters */}
                {params.length > 0 && (
                    <div className="node-params">
                        {params.map(([name, value]) => renderParam(name, value))}
                    </div>
                )}

                {/* Preview */}
                <div
                    className={`node-preview ${imageSrc ? 'clickable' : ''}`}
                    onClick={() => imageSrc && setLightboxOpen(true)}
                >
                    {imageSrc ? (
                        <>
                            <img
                                src={imageSrc}
                                alt={step.name}
                                className="node-preview-image"
                            />
                            <div className="node-preview-zoom-hint nodrag">
                                <ZoomIn size={14} />
                            </div>
                            {step.output_size && (
                                <div className="node-image-size nodrag">
                                    {step.output_size[0]} × {step.output_size[1]}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="node-preview-placeholder">
                            No output
                        </div>
                    )}
                </div>

                <Handle type="source" position={Position.Right} className="node-handle" />
            </div>

            <ImageLightbox
                isOpen={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                imageSrc={imageSrc}
                title={step.name}
            />
        </>
    )
}

export default memo(TransformNode)

