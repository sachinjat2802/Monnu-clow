// ============================================================================
// Workflow Board — Functional flow and progress tracking
// ============================================================================

import React from 'react';
import { GitMerge, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { useDashboardStore, WorkflowItem } from '../../stores/dashboard';

export function WorkflowBoard() {
    const { workflows } = useDashboardStore();

    // Demo data if empty
    const displayWorkflows: WorkflowItem[] = workflows;

    return (
        <div className="card workflow-card">
            <div className="card-header">
                <div className="card-title">
                    <GitMerge size={18} />
                    <span>Active Workflows</span>
                </div>
            </div>
            <div className="workflow-list">
                {displayWorkflows.map(wf => (
                    <div key={wf.id} className="workflow-item">
                        <div className="workflow-info">
                            <span className="workflow-name">{wf.name}</span>
                            <span className="workflow-progress-text">{wf.progress}%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${wf.progress}%` }} />
                        </div>
                        <div className="workflow-steps">
                            {wf.steps.map((step, idx) => (
                                <div key={idx} className={`workflow-step ${step.status}`}>
                                    {step.status === 'completed' ? <CheckCircle2 size={12} /> :
                                        step.status === 'working' ? <Clock size={12} className="spin" /> :
                                            step.status === 'failed' ? <AlertCircle size={12} /> : <Circle size={12} />}
                                    <span>{step.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
