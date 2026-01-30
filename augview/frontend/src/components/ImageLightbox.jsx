import { memo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { useState } from 'react'

function ImageLightbox({ isOpen, onClose, imageSrc, title }) {
    const [scale, setScale] = useState(1)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

    useEffect(() => {
        if (isOpen) {
            setScale(1)
            setPosition({ x: 0, y: 0 })
        }
    }, [isOpen, imageSrc])

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return
            if (e.key === 'Escape') onClose()
            if (e.key === '+' || e.key === '=') handleZoomIn()
            if (e.key === '-') handleZoomOut()
            if (e.key === '0') handleReset()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 4))
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5))
    const handleReset = () => {
        setScale(1)
        setPosition({ x: 0, y: 0 })
    }

    const handleWheel = useCallback((e) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setScale(s => Math.max(0.5, Math.min(4, s + delta)))
    }, [])

    const handleMouseDown = (e) => {
        if (scale > 1) {
            setIsDragging(true)
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
        }
    }

    const handleMouseMove = (e) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            })
        }
    }

    const handleMouseUp = () => setIsDragging(false)

    if (!isOpen) return null

    const lightboxContent = (
        <div
            className="lightbox-overlay"
            onClick={onClose}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="lightbox-header">
                <span className="lightbox-title">{title}</span>
                <div className="lightbox-controls">
                    <button onClick={(e) => { e.stopPropagation(); handleZoomOut() }} title="Zoom Out (-)">
                        <ZoomOut size={18} />
                    </button>
                    <span className="lightbox-scale">{Math.round(scale * 100)}%</span>
                    <button onClick={(e) => { e.stopPropagation(); handleZoomIn() }} title="Zoom In (+)">
                        <ZoomIn size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleReset() }} title="Reset (0)">
                        <RotateCcw size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onClose() }} title="Close (Esc)">
                        <X size={18} />
                    </button>
                </div>
            </div>
            <div
                className="lightbox-content"
                onClick={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
            >
                <img
                    src={imageSrc}
                    alt={title}
                    className="lightbox-image"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease'
                    }}
                    draggable={false}
                />
            </div>
        </div>
    )

    // Use portal to render outside ReactFlow canvas
    return createPortal(lightboxContent, document.body)
}

export default memo(ImageLightbox)
