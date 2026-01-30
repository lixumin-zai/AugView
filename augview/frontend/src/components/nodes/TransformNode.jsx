import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { Eye, EyeOff, Check, X, ZoomIn } from 'lucide-react'
import ImageLightbox from '../ImageLightbox'

function TransformNode({ data, selected }) {
    const { step, onParamUpdate, onToggleStep } = data
    const [localParams, setLocalParams] = useState({})
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const debounceTimerRef = useRef({})

    useEffect(() => {
        if (step?.params) {
            setLocalParams({ ...step.params })
        }
    }, [step?.id, step?.params])

    const debouncedUpdate = useCallback((stepId, paramName, value) => {
        if (debounceTimerRef.current[paramName]) {
            clearTimeout(debounceTimerRef.current[paramName])
        }
        debounceTimerRef.current[paramName] = setTimeout(() => {
            onParamUpdate(stepId, paramName, value)
        }, 300)
    }, [onParamUpdate])

    const handleChange = (paramName, value) => {
        setLocalParams(prev => ({ ...prev, [paramName]: value }))
        debouncedUpdate(step.id, paramName, value)
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
        const exclude = ['always_apply', 'interpolation', 'border_mode', 'mask_interpolation', 'p_replace']
        return !exclude.includes(name.toLowerCase())
    }

    const inferType = (value) => {
        if (typeof value === 'boolean') return 'bool'
        if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float'
        if (Array.isArray(value) && value.length === 2) return 'range'
        return 'string'
    }

    const params = Object.entries(step?.params || {})
        .filter(([key]) => !key.startsWith('_') && isEditableParam(key))
        .sort(([a], [b]) => {
            const priority = ['p', 'probability', 'limit', 'strength', 'intensity']
            const aIdx = priority.findIndex(p => a.toLowerCase().includes(p))
            const bIdx = priority.findIndex(p => b.toLowerCase().includes(p))
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
            if (aIdx !== -1) return -1
            if (bIdx !== -1) return 1
            return a.localeCompare(b)
        })
        .slice(0, 4) // Limit params shown in node

    const renderParam = (paramName, value, spec) => {
        const paramSpec = spec || step.param_specs?.[paramName] || {}
        const type = paramSpec.type || inferType(value)
        const localValue = localParams[paramName] ?? value

        if (type === 'float' || type === 'int') {
            const min = paramSpec.min ?? 0
            const max = paramSpec.max ?? (type === 'float' ? 1 : 100)
            const stepVal = paramSpec.step ?? (type === 'float' ? 0.01 : 1)
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
                        onChange={(e) => handleChange(paramName, type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value))}
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

        return null
    }

    if (!step) return null

    const imageSrc = step.output_image ? `data:image/png;base64,${step.output_image}` : null

    return (
        <>
            <div className={`transform-node ${selected ? 'selected' : ''} ${!step.enabled ? 'disabled' : ''}`}>
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

