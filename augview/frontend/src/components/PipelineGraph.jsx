import { Eye, EyeOff, Check, X } from 'lucide-react'

function PipelineGraph({ steps, selectedStepId, onSelectStep, onToggleStep }) {
    return (
        <div className="pipeline-steps">
            {steps.map((step, index) => (
                <div
                    key={step.id}
                    className={`pipeline-step ${selectedStepId === step.id ? 'active' : ''} ${!step.enabled ? 'disabled' : ''}`}
                    onClick={() => onSelectStep(step.id)}
                >
                    <div className="step-number">{index + 1}</div>

                    <div className="step-info">
                        <div className="step-name">
                            {step.name}
                            {/* Show applied status */}
                            {step.enabled && step.probability !== null && (
                                <span
                                    className={`applied-badge ${step.applied ? 'applied' : 'skipped'}`}
                                    title={step.applied ? 'Transform was applied' : 'Skipped (probability)'}
                                >
                                    {step.applied ? <Check size={10} /> : <X size={10} />}
                                </span>
                            )}
                        </div>
                        <div className="step-type">
                            {step.transform_type}
                            {step.probability !== null && (
                                <span className="step-probability">
                                    p={step.probability.toFixed(2)}
                                </span>
                            )}
                        </div>
                    </div>

                    {step.output_image && (
                        <div className="step-thumbnail">
                            <img
                                src={`data:image/png;base64,${step.output_image}`}
                                alt={step.name}
                            />
                        </div>
                    )}

                    <button
                        className={`btn btn-icon ${step.enabled ? 'btn-ghost' : 'btn-disabled-step'}`}
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleStep(step.id, !step.enabled)
                        }}
                        title={step.enabled ? 'Disable step (skip this transform)' : 'Enable step'}
                    >
                        {step.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>

                    {index < steps.length - 1 && <div className="step-connector"></div>}
                </div>
            ))}
        </div>
    )
}

export default PipelineGraph
