import { useState, useEffect, useRef, useCallback } from 'react'

function ParameterPanel({ step, onParamUpdate }) {
    const [localParams, setLocalParams] = useState({})
    const debounceTimerRef = useRef({})

    useEffect(() => {
        if (step?.params) {
            setLocalParams({ ...step.params })
        }
    }, [step?.id])

    // Debounced update to server
    const debouncedUpdate = useCallback((stepId, paramName, value) => {
        // Clear previous timer for this param
        if (debounceTimerRef.current[paramName]) {
            clearTimeout(debounceTimerRef.current[paramName])
        }

        // Set new timer
        debounceTimerRef.current[paramName] = setTimeout(() => {
            onParamUpdate(stepId, paramName, value)
        }, 300) // 300ms debounce
    }, [onParamUpdate])

    const handleChange = (paramName, value) => {
        // Update local state immediately for responsive UI
        setLocalParams(prev => ({ ...prev, [paramName]: value }))
        // Debounce the server update
        debouncedUpdate(step.id, paramName, value)
    }

    if (!step) return null

    const renderParamControl = (paramName, value, spec) => {
        const paramSpec = spec || step.param_specs?.[paramName] || {}
        const type = paramSpec.type || inferType(value)
        const localValue = localParams[paramName] ?? value

        switch (type) {
            case 'float':
                return (
                    <div className="param-group" key={paramName}>
                        <label className="param-label">
                            <span>{formatLabel(paramName)}</span>
                            <span className="param-value">{Number(localValue).toFixed(3)}</span>
                        </label>
                        <input
                            type="range"
                            min={paramSpec.min || 0}
                            max={paramSpec.max || 1}
                            step={paramSpec.step || 0.01}
                            value={localValue}
                            onChange={(e) => handleChange(paramName, parseFloat(e.target.value))}
                        />
                    </div>
                )

            case 'int':
                return (
                    <div className="param-group" key={paramName}>
                        <label className="param-label">
                            <span>{formatLabel(paramName)}</span>
                            <span className="param-value">{localValue}</span>
                        </label>
                        <input
                            type="range"
                            min={paramSpec.min || 0}
                            max={paramSpec.max || 100}
                            step={paramSpec.step || 1}
                            value={localValue}
                            onChange={(e) => handleChange(paramName, parseInt(e.target.value))}
                        />
                    </div>
                )

            case 'bool':
                return (
                    <div className="param-group" key={paramName}>
                        <label className="param-label">
                            <span>{formatLabel(paramName)}</span>
                            <div
                                className={`toggle-switch ${localValue ? 'active' : ''}`}
                                onClick={() => handleChange(paramName, !localValue)}
                            />
                        </label>
                    </div>
                )

            case 'range':
                if (Array.isArray(localValue) && localValue.length === 2) {
                    return (
                        <div className="param-group" key={paramName}>
                            <label className="param-label">
                                <span>{formatLabel(paramName)}</span>
                                <span className="param-value">{`(${localValue[0]}, ${localValue[1]})`}</span>
                            </label>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <input
                                    type="number"
                                    value={localValue[0]}
                                    onChange={(e) => handleChange(paramName, [parseFloat(e.target.value), localValue[1]])}
                                    style={{ flex: 1 }}
                                    placeholder="Min"
                                />
                                <input
                                    type="number"
                                    value={localValue[1]}
                                    onChange={(e) => handleChange(paramName, [localValue[0], parseFloat(e.target.value)])}
                                    style={{ flex: 1 }}
                                    placeholder="Max"
                                />
                            </div>
                        </div>
                    )
                }
                break

            default:
                // String or unknown type
                if (typeof localValue === 'string' || typeof localValue === 'number') {
                    return (
                        <div className="param-group" key={paramName}>
                            <label className="param-label">
                                <span>{formatLabel(paramName)}</span>
                            </label>
                            <input
                                type="text"
                                value={localValue}
                                onChange={(e) => handleChange(paramName, e.target.value)}
                            />
                        </div>
                    )
                }
        }

        return null
    }

    // Filter and sort parameters
    const params = Object.entries(step.params || {})
        .filter(([key]) => !key.startsWith('_') && isEditableParam(key))
        .sort(([a], [b]) => {
            // Priority params first
            const priority = ['p', 'probability', 'limit', 'strength', 'intensity']
            const aIdx = priority.findIndex(p => a.toLowerCase().includes(p))
            const bIdx = priority.findIndex(p => b.toLowerCase().includes(p))
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
            if (aIdx !== -1) return -1
            if (bIdx !== -1) return 1
            return a.localeCompare(b)
        })

    return (
        <div className="parameter-controls">
            <div style={{
                marginBottom: 'var(--spacing-lg)',
                paddingBottom: 'var(--spacing-md)',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <h3 style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-primary-light)',
                    marginBottom: 'var(--spacing-xs)'
                }}>
                    {step.name}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {step.transform_type}
                </p>
            </div>

            {params.length > 0 ? (
                params.map(([name, value]) => renderParamControl(name, value))
            ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No editable parameters
                </p>
            )}
        </div>
    )
}

// Helper functions
function formatLabel(name) {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
}

function inferType(value) {
    if (typeof value === 'boolean') return 'bool'
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'int' : 'float'
    }
    if (Array.isArray(value) && value.length === 2) return 'range'
    return 'string'
}

function isEditableParam(name) {
    // Filter out non-useful params
    const exclude = [
        'always_apply', 'interpolation', 'border_mode',
        'mask_interpolation', 'p_replace'
    ]
    return !exclude.includes(name.toLowerCase())
}

export default ParameterPanel
