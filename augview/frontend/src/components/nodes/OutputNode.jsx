import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Image as ImageIcon, CheckCircle } from 'lucide-react'

function OutputNode({ data, selected }) {
    const { finalImage } = data

    return (
        <div className={`output-node ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Left} className="node-handle output-handle" />

            <div className="node-header output-header">
                <CheckCircle size={14} />
                <span>Output</span>
            </div>

            <div className="node-preview output-preview">
                {finalImage ? (
                    <img
                        src={`data:image/png;base64,${finalImage}`}
                        alt="Output"
                        className="node-preview-image"
                    />
                ) : (
                    <div className="node-preview-placeholder output-placeholder">
                        <ImageIcon size={32} />
                        <span>Final result</span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default memo(OutputNode)
