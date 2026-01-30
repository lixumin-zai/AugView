import { memo, useState, useCallback } from 'react'
import { Handle, Position } from 'reactflow'
import { Upload, Image as ImageIcon } from 'lucide-react'

function SourceImageNode({ data, selected }) {
    const { originalImage, onUpload } = data
    const [isDragover, setIsDragover] = useState(false)

    const handleFile = useCallback((file) => {
        if (file && file.type.startsWith('image/')) {
            onUpload(file)
        }
    }, [onUpload])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragover(false)
        const file = e.dataTransfer.files[0]
        handleFile(file)
    }, [handleFile])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragover(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragover(false)
    }, [])

    const handleClick = useCallback(() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = (e) => {
            const file = e.target.files[0]
            handleFile(file)
        }
        input.click()
    }, [handleFile])

    return (
        <div className={`source-node ${selected ? 'selected' : ''}`}>
            <div className="node-header source-header">
                <ImageIcon size={14} />
                <span>Source Image</span>
            </div>

            <div className="node-preview source-preview">
                {originalImage ? (
                    <div className="source-image-container">
                        <img
                            src={`data:image/png;base64,${originalImage}`}
                            alt="Source"
                            className="node-preview-image"
                        />
                        <button
                            className="source-change-btn nodrag"
                            onClick={handleClick}
                        >
                            <Upload size={12} />
                        </button>
                    </div>
                ) : (
                    <div
                        className={`source-upload ${isDragover ? 'dragover' : ''} nodrag`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={handleClick}
                    >
                        <Upload size={24} />
                        <span>Drop image</span>
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="node-handle source-handle" />
        </div>
    )
}

export default memo(SourceImageNode)
