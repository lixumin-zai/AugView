import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Layers, Upload, Settings, Play, RefreshCw, Shuffle,
    Eye, EyeOff, ChevronRight, Wifi, WifiOff,
    Image as ImageIcon, Sliders, Check, X
} from 'lucide-react'
import PipelineGraph from './components/PipelineGraph'
import StepPreview from './components/StepPreview'
import ParameterPanel from './components/ParameterPanel'
import ImageUpload from './components/ImageUpload'

function App() {
    const [pipeline, setPipeline] = useState(null)
    const [selectedStepId, setSelectedStepId] = useState(null)
    const [connected, setConnected] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isRunning, setIsRunning] = useState(false)
    const wsRef = useRef(null)
    const selectedStepIdRef = useRef(null)

    // Keep ref in sync with state
    useEffect(() => {
        selectedStepIdRef.current = selectedStepId
    }, [selectedStepId])

    // WebSocket connection
    useEffect(() => {
        const connectWebSocket = () => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const wsUrl = `${protocol}//${window.location.host}/ws`

            const ws = new WebSocket(wsUrl)

            ws.onopen = () => {
                console.log('WebSocket connected')
                setConnected(true)
                setLoading(false)
            }

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data)
                if (message.type === 'pipeline_update') {
                    setPipeline(message.data)
                    setIsRunning(false)
                    // Only auto-select first step if nothing is selected
                    if (!selectedStepIdRef.current && message.data.steps?.length > 0) {
                        setSelectedStepId(message.data.steps[0].id)
                    }
                }
            }

            ws.onclose = () => {
                console.log('WebSocket disconnected')
                setConnected(false)
                // Reconnect after delay
                setTimeout(connectWebSocket, 3000)
            }

            ws.onerror = (error) => {
                console.error('WebSocket error:', error)
                setConnected(false)
            }

            wsRef.current = ws
        }

        connectWebSocket()

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [])

    // Fetch initial pipeline state
    useEffect(() => {
        fetch('/api/pipeline')
            .then(res => res.json())
            .then(data => {
                if (!data.error) {
                    setPipeline(data)
                    if (data.steps?.length > 0) {
                        setSelectedStepId(data.steps[0].id)
                    }
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    const handleImageUpload = useCallback(async (file) => {
        setIsRunning(true)
        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })
            const data = await response.json()
            if (data.pipeline) {
                setPipeline(data.pipeline)
            }
        } catch (error) {
            console.error('Upload error:', error)
        }
        setIsRunning(false)
    }, [])

    const handleRerun = useCallback(async () => {
        setIsRunning(true)
        try {
            const response = await fetch('/api/rerun', { method: 'POST' })
            const data = await response.json()
            if (data.pipeline) {
                setPipeline(data.pipeline)
            }
        } catch (error) {
            console.error('Rerun error:', error)
        }
        setIsRunning(false)
    }, [])

    const handleParamUpdate = useCallback(async (stepId, paramName, value) => {
        // Try WebSocket first
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'update_param',
                step_id: stepId,
                param_name: paramName,
                value: value,
            }))
        } else {
            // Fallback to REST API
            try {
                await fetch(`/api/step/${stepId}/params`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [paramName]: value }),
                })
                // Trigger re-run
                handleRerun()
            } catch (error) {
                console.error('Param update error:', error)
            }
        }
    }, [handleRerun])

    const handleToggleStep = useCallback(async (stepId, enabled) => {
        // Try WebSocket first
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'toggle_step',
                step_id: stepId,
                enabled: enabled,
            }))
        } else {
            // Fallback to REST API
            try {
                await fetch(`/api/step/${stepId}/toggle?enabled=${enabled}`, {
                    method: 'PUT',
                })
                // Trigger re-run
                handleRerun()
            } catch (error) {
                console.error('Toggle error:', error)
            }
        }
    }, [handleRerun])

    const selectedStep = pipeline?.steps?.find(s => s.id === selectedStepId)

    if (loading) {
        return (
            <div className="app-container" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading AugView...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="app-logo">
                    <Layers size={24} />
                    <span>AugView</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {pipeline?.name && (
                        <span style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.875rem'
                        }}>
                            {pipeline.name}
                        </span>
                    )}

                    <div className={`status-badge ${connected ? 'status-connected' : 'status-disconnected'}`}>
                        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {connected ? 'Connected' : 'Disconnected'}
                    </div>

                    <button
                        className="btn btn-accent"
                        onClick={handleRerun}
                        disabled={!pipeline?.original_image || isRunning}
                        title="Re-run with new random values"
                    >
                        {isRunning ? (
                            <div className="spinner" style={{ width: 16, height: 16 }}></div>
                        ) : (
                            <Shuffle size={16} />
                        )}
                        Random
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                {/* Left Sidebar - Pipeline Steps */}
                <div className="pipeline-sidebar">
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Pipeline Steps</span>
                            <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.75rem',
                                color: 'var(--color-accent)'
                            }}>
                                {pipeline?.steps?.length || 0} steps
                            </span>
                        </div>
                        <div className="card-body">
                            {pipeline?.steps?.length > 0 ? (
                                <PipelineGraph
                                    steps={pipeline.steps}
                                    selectedStepId={selectedStepId}
                                    onSelectStep={setSelectedStepId}
                                    onToggleStep={handleToggleStep}
                                />
                            ) : (
                                <div className="empty-state">
                                    <Layers size={48} />
                                    <h3>No Pipeline Loaded</h3>
                                    <p>Create a pipeline using the @augview decorator</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Test Image</span>
                        </div>
                        <div className="card-body">
                            <ImageUpload onUpload={handleImageUpload} />
                        </div>
                    </div>
                </div>

                {/* Center - Preview */}
                <div className="preview-panel">
                    <StepPreview
                        step={selectedStep}
                        originalImage={pipeline?.original_image}
                        finalImage={pipeline?.final_image}
                    />
                </div>

                {/* Right Sidebar - Parameters */}
                <div className="parameter-panel">
                    <div className="card" style={{ flex: 1 }}>
                        <div className="card-header">
                            <span className="card-title">
                                <Sliders size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                                Parameters
                            </span>
                        </div>
                        <div className="card-body">
                            {selectedStep ? (
                                <ParameterPanel
                                    step={selectedStep}
                                    onParamUpdate={handleParamUpdate}
                                />
                            ) : (
                                <div className="empty-state">
                                    <Settings size={48} />
                                    <h3>No Step Selected</h3>
                                    <p>Select a step to view and edit parameters</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default App
