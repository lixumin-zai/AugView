import { useState } from 'react'
import { Image as ImageIcon, ArrowRight, Maximize2 } from 'lucide-react'

function StepPreview({ step, originalImage, finalImage }) {
    const [viewMode, setViewMode] = useState('step') // 'step' | 'full'
    const [zoomedImage, setZoomedImage] = useState(null)

    const renderImage = (imageData, label) => {
        if (!imageData) {
            return (
                <div className="preview-placeholder">
                    <ImageIcon size={48} />
                    <p>{label}</p>
                </div>
            )
        }

        return (
            <img
                className="preview-image"
                src={`data:image/png;base64,${imageData}`}
                alt={label}
                onClick={() => setZoomedImage(imageData)}
                style={{ cursor: 'zoom-in' }}
            />
        )
    }

    return (
        <div className="preview-container">
            {/* View Mode Toggle */}
            <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
                <div className="card-header">
                    <span className="card-title">
                        {viewMode === 'step' ? 'Step Preview' : 'Full Pipeline'}
                    </span>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <button
                            className={`btn ${viewMode === 'step' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('step')}
                        >
                            Single Step
                        </button>
                        <button
                            className={`btn ${viewMode === 'full' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('full')}
                        >
                            Full Pipeline
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Images */}
            <div className="preview-images">
                {viewMode === 'step' ? (
                    <>
                        {/* Step Input */}
                        <div className="preview-box card">
                            <div className="card-header">
                                <span className="card-title">Input</span>
                                {step && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {step.name}
                                    </span>
                                )}
                            </div>
                            <div className="card-body">
                                {renderImage(step?.input_image || originalImage, 'No input image')}
                            </div>
                        </div>

                        {/* Step Output */}
                        <div className="preview-box card">
                            <div className="card-header">
                                <span className="card-title">Output</span>
                                {step && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>
                                        After transform
                                    </span>
                                )}
                            </div>
                            <div className="card-body">
                                {renderImage(step?.output_image, 'No output image')}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Original Image */}
                        <div className="preview-box card">
                            <div className="card-header">
                                <span className="card-title">Original</span>
                            </div>
                            <div className="card-body">
                                {renderImage(originalImage, 'No original image')}
                            </div>
                        </div>

                        {/* Final Image */}
                        <div className="preview-box card">
                            <div className="card-header">
                                <span className="card-title">Final Result</span>
                            </div>
                            <div className="card-body">
                                {renderImage(finalImage, 'No final image')}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Zoom Modal */}
            {zoomedImage && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        cursor: 'zoom-out',
                    }}
                    onClick={() => setZoomedImage(null)}
                >
                    <img
                        src={`data:image/png;base64,${zoomedImage}`}
                        alt="Zoomed preview"
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            objectFit: 'contain',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                        }}
                    />
                </div>
            )}
        </div>
    )
}

export default StepPreview
