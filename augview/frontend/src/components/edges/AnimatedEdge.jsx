import { memo } from 'react'
import { BaseEdge, getSmoothStepPath } from 'reactflow'

function AnimatedEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}) {
    const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 16,
    })

    const isActive = data?.active !== false

    return (
        <>
            {/* Glow effect */}
            <path
                d={edgePath}
                fill="none"
                stroke="url(#edge-gradient)"
                strokeWidth={4}
                strokeOpacity={0.3}
                filter="url(#glow)"
            />
            {/* Main edge */}
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    ...style,
                    stroke: 'url(#edge-gradient)',
                    strokeWidth: 2,
                }}
                markerEnd={markerEnd}
            />
            {/* Animated dot */}
            {isActive && (
                <circle r={4} fill="var(--color-accent)">
                    <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={edgePath}
                    />
                </circle>
            )}
        </>
    )
}

// SVG Definitions component for gradients and filters
export function EdgeDefs() {
    return (
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
                <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--color-primary-light)" />
                    <stop offset="100%" stopColor="var(--color-accent)" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
        </svg>
    )
}

export default memo(AnimatedEdge)
