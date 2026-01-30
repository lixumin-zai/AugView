import { useState, useCallback } from 'react'
import { Upload, Image as ImageIcon } from 'lucide-react'

function ImageUpload({ onUpload }) {
    const [isDragover, setIsDragover] = useState(false)
    const [preview, setPreview] = useState(null)

    const handleFile = useCallback((file) => {
        if (file && file.type.startsWith('image/')) {
            // Create preview
            const reader = new FileReader()
            reader.onload = (e) => {
                setPreview(e.target.result)
            }
            reader.readAsDataURL(file)

            // Upload file
            onUpload(file)
        }
    }, [onUpload])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setIsDragover(false)
        const file = e.dataTransfer.files[0]
        handleFile(file)
    }, [handleFile])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setIsDragover(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
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

    if (preview) {
        return (
            <div style={{ position: 'relative' }}>
                <img
                    src={preview}
                    alt="Uploaded preview"
                    style={{
                        width: '100%',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--spacing-sm)',
                    }}
                />
                <button
                    className="btn btn-ghost"
                    onClick={() => {
                        setPreview(null)
                        handleClick()
                    }}
                    style={{ width: '100%' }}
                >
                    <Upload size={16} />
                    Change Image
                </button>
            </div>
        )
    }

    return (
        <div
            className={`upload-zone ${isDragover ? 'dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
        >
            <Upload size={32} />
            <p>Drop an image here</p>
            <span>or click to browse</span>
        </div>
    )
}

export default ImageUpload
