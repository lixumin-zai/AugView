import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import ReactFlow, {
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Layers, Shuffle, Wifi, WifiOff } from 'lucide-react'

import TransformNode from './components/nodes/TransformNode'
import SourceImageNode from './components/nodes/SourceImageNode'
import OutputNode from './components/nodes/OutputNode'
import AnimatedEdge, { EdgeDefs } from './components/edges/AnimatedEdge'

const nodeTypes = {
    transform: TransformNode,
    source: SourceImageNode,
    output: OutputNode,
}

const edgeTypes = {
    animated: AnimatedEdge,
}

const NODE_WIDTH = 280
const NODE_HEIGHT_BASE = 280
const NODE_SPACING_X = 100
const NODE_SPACING_Y = 40

function App() {
    const [pipeline, setPipeline] = useState(null)
    const [connected, setConnected] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isRunning, setIsRunning] = useState(false)
    const wsRef = useRef(null)

    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const nodePositionsRef = useRef({}) // Store user-dragged positions
    const nodeSizesRef = useRef({}) // Store user-resized dimensions
    const initializedRef = useRef(false) // Track if initial layout has been set

    // Custom onNodesChange to capture resize events
    const handleNodesChange = useCallback((changes) => {
        // Capture dimension changes from resize
        changes.forEach(change => {
            if (change.type === 'dimensions' && change.dimensions) {
                nodeSizesRef.current[change.id] = {
                    width: change.dimensions.width,
                    height: change.dimensions.height
                }
            }
        })
        onNodesChange(changes)
    }, [onNodesChange])

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
                }
            }

            ws.onclose = () => {
                console.log('WebSocket disconnected')
                setConnected(false)
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

    const handleParamUpdate = useCallback((stepId, paramName, value) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'update_param',
                step_id: stepId,
                param_name: paramName,
                value: value,
            }))
        } else {
            fetch(`/api/step/${stepId}/params`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [paramName]: value }),
            }).then(() => handleRerun())
                .catch(error => console.error('Param update error:', error))
        }
    }, [handleRerun])

    const handleToggleStep = useCallback((stepId, enabled) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'toggle_step',
                step_id: stepId,
                enabled: enabled,
            }))
        } else {
            fetch(`/api/step/${stepId}/toggle?enabled=${enabled}`, {
                method: 'PUT',
            }).then(() => handleRerun())
                .catch(error => console.error('Toggle error:', error))
        }
    }, [handleRerun])

    // Convert pipeline to ReactFlow nodes and edges
    useEffect(() => {
        if (!pipeline) return

        const steps = pipeline.steps || []
        const newNodes = []
        const newEdges = []

        // Layout constants
        const startX = 50
        const centerY = 120

        // Get default position for a node
        const getNodePosition = (nodeId, defaultPos) => {
            // Use stored position if exists, otherwise use default
            return nodePositionsRef.current[nodeId] || defaultPos
        }

        // Get stored size for a node (if user resized it)
        const getNodeStyle = (nodeId) => {
            return nodeSizesRef.current[nodeId] || undefined
        }

        // Source node - leftmost
        const sourceDefaultPos = { x: startX, y: centerY + 50 }
        newNodes.push({
            id: 'source',
            type: 'source',
            position: getNodePosition('source', sourceDefaultPos),
            style: getNodeStyle('source'),
            data: {
                originalImage: pipeline.original_image,
                originalSize: pipeline.original_size,
                onUpload: handleImageUpload,
            },
        })

        // Transform nodes - horizontal line after source
        const transformStartX = startX + 220 // After source node
        steps.forEach((step, index) => {
            const x = transformStartX + index * (NODE_WIDTH + NODE_SPACING_X)
            const y = centerY
            const defaultPos = { x, y }

            newNodes.push({
                id: step.id,
                type: 'transform',
                position: getNodePosition(step.id, defaultPos),
                style: getNodeStyle(step.id),
                data: {
                    step,
                    onParamUpdate: handleParamUpdate,
                    onToggleStep: handleToggleStep,
                },
            })
        })

        // Output node - rightmost, after all transforms
        const outputX = transformStartX + steps.length * (NODE_WIDTH + NODE_SPACING_X)
        const outputDefaultPos = { x: outputX, y: centerY + 50 }

        newNodes.push({
            id: 'output',
            type: 'output',
            position: getNodePosition('output', outputDefaultPos),
            style: getNodeStyle('output'),
            data: {
                finalImage: pipeline.final_image,
                finalSize: pipeline.final_size,
            },
        })

        // Create edges
        // Source to first transform
        if (steps.length > 0) {
            newEdges.push({
                id: 'e-source-0',
                source: 'source',
                target: steps[0].id,
                type: 'animated',
                data: { active: true },
            })
        }

        // Between transforms
        for (let i = 0; i < steps.length - 1; i++) {
            newEdges.push({
                id: `e-${i}-${i + 1}`,
                source: steps[i].id,
                target: steps[i + 1].id,
                type: 'animated',
                data: { active: steps[i].enabled },
            })
        }

        // Last transform to output
        if (steps.length > 0) {
            newEdges.push({
                id: 'e-last-output',
                source: steps[steps.length - 1].id,
                target: 'output',
                type: 'animated',
                data: { active: true },
            })
        } else {
            // Direct source to output if no steps
            newEdges.push({
                id: 'e-source-output',
                source: 'source',
                target: 'output',
                type: 'animated',
                data: { active: true },
            })
        }

        setNodes(newNodes)
        setEdges(newEdges)
    }, [pipeline, handleImageUpload, handleParamUpdate, handleToggleStep, setNodes, setEdges])

    const defaultViewport = useMemo(() => ({ x: 0, y: 0, zoom: 0.8 }), [])

    // Save node positions when dragged
    const onNodeDragStop = useCallback((event, node) => {
        nodePositionsRef.current[node.id] = node.position
    }, [])

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
            {/* ReactFlow Canvas */}
            <div className="react-flow-wrapper full-height">
                <EdgeDefs />
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    defaultViewport={defaultViewport}
                    onNodeDragStop={onNodeDragStop}
                    fitView={!initializedRef.current}
                    onInit={() => { initializedRef.current = true }}
                    fitViewOptions={{ padding: 0.2 }}
                    minZoom={0.3}
                    maxZoom={1.5}
                    proOptions={{ hideAttribution: true }}
                >
                    <Controls className="flow-controls" />
                    <MiniMap
                        className="flow-minimap"
                        nodeColor={(node) => {
                            if (node.type === 'source') return 'var(--color-accent)'
                            if (node.type === 'output') return '#22C55E'
                            return 'var(--color-primary-light)'
                        }}
                        maskColor="rgba(0, 0, 0, 0.8)"
                    />
                    <Background
                        color="var(--border-color)"
                        gap={24}
                        size={1}
                    />
                </ReactFlow>

                {/* Floating Toolbar */}
                <div className="floating-toolbar">
                    <div className={`toolbar-status ${connected ? 'connected' : 'disconnected'}`}>
                        {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                    </div>
                    <button
                        className="toolbar-btn"
                        onClick={handleRerun}
                        disabled={!pipeline?.original_image || isRunning}
                        title="Re-run with new random values"
                    >
                        {isRunning ? (
                            <div className="spinner" style={{ width: 16, height: 16 }}></div>
                        ) : (
                            <Shuffle size={18} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default App
