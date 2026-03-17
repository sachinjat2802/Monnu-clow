// ============================================================================
// Orchestration Tree — Supervisor hierarchy visualization
// ============================================================================

import React from 'react';
import { Network, ArrowDown, ShieldCheck, Zap, Code, Shield, Search, Layers, Play, FileText, Briefcase, Terminal, CheckCircle } from 'lucide-react';
import { useDashboardStore, AgentRole, AgentState } from '../../stores/dashboard';

const ROLE_ICONS: Record<AgentRole, React.ReactNode> = {
    supervisor: <ShieldCheck size={20} />,
    planner: <Zap size={18} />,
    coder: <Code size={18} />,
    tester: <Search size={18} />,
    reviewer: <Shield size={18} />,
    debugger: <Search size={18} />,
    'fullstack-1': <Code size={18} className="text-blue-400" />,
    'fullstack-2': <Code size={18} className="text-blue-400" />,
    'fullstack-3': <Code size={18} className="text-blue-400" />,
    'tester-1': <Search size={18} />,
    'tester-2': <CheckCircle className="w-4 h-4 text-emerald-400" />,
    ba: <FileText className="w-4 h-4 text-blue-400" />,
    manager: <Briefcase className="w-4 h-4 text-amber-500" />,
    architect: <Layers className="w-4 h-4 text-indigo-400" />,
    'senior-dev': <Terminal className="w-4 h-4 text-orange-400" />,
    'functional-reviewer': <ShieldCheck className="w-4 h-4 text-pink-400" />,
    security: <Shield size={18} className="text-red-400" />,
};

export function OrchestrationTree({ compact = false }: { compact?: boolean }) {
    const { agents, pipeline, dailyIterations, totalEarnings, toggleAgent, sendMessage } = useDashboardStore();

    const handleToggle = (role: AgentRole) => {
        const newEnabled = !agents[role].enabled;
        toggleAgent(role);
        sendMessage('agent:toggle', { role, enabled: newEnabled });
    };

    const handleRunAutomated = () => {
        sendMessage('workflow:start-automated', { goal: 'Full System Optimization Loop' });
        sendMessage('start');
    };

    if (compact) {
        return (
            <div className="sidebar-workflows-inner">
                <div className="sidebar-workflow-controls">
                    <button
                        className="btn btn-primary btn-sm w-full btn-automated"
                        onClick={handleRunAutomated}
                        title="Start Automated Workflow Loop"
                    >
                        <Play size={14} /> Run Auto Loop
                    </button>
                </div>

                <div className="tree-container compact">
                    <div className="tree-level grid grid-cols-2 gap-1">
                        <AgentNode role="manager" icon={ROLE_ICONS.manager} state={agents.manager} isCurrent={pipeline.currentAgent === 'manager'} onToggle={() => handleToggle('manager')} compact />
                        <AgentNode role="ba" icon={ROLE_ICONS.ba} state={agents.ba} isCurrent={pipeline.currentAgent === 'ba'} onToggle={() => handleToggle('ba')} compact />
                    </div>
                    <div className="tree-level">
                        <AgentNode role="architect" icon={ROLE_ICONS.architect} state={agents.architect} isCurrent={pipeline.currentAgent === 'architect'} onToggle={() => handleToggle('architect')} compact />
                    </div>
                    <div className="tree-level grid grid-cols-3 gap-1">
                        <AgentNode role="fullstack-1" icon={ROLE_ICONS['fullstack-1']} state={agents['fullstack-1']} isCurrent={pipeline.currentAgent === 'fullstack-1'} onToggle={() => handleToggle('fullstack-1')} compact />
                        <AgentNode role="fullstack-2" icon={ROLE_ICONS['fullstack-2']} state={agents['fullstack-2']} isCurrent={pipeline.currentAgent === 'fullstack-2'} onToggle={() => handleToggle('fullstack-2')} compact />
                        <AgentNode role="fullstack-3" icon={ROLE_ICONS['fullstack-3']} state={agents['fullstack-3']} isCurrent={pipeline.currentAgent === 'fullstack-3'} onToggle={() => handleToggle('fullstack-3')} compact />
                    </div>
                    <div className="tree-level grid grid-cols-2 gap-1">
                        <AgentNode role="security" icon={ROLE_ICONS.security} state={agents.security} isCurrent={pipeline.currentAgent === 'security'} onToggle={() => handleToggle('security')} compact />
                        <AgentNode role="reviewer" icon={ROLE_ICONS.reviewer} state={agents.reviewer} isCurrent={pipeline.currentAgent === 'reviewer'} onToggle={() => handleToggle('reviewer')} compact />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card orchestration-card">
            <div className="card-header">
                <div className="card-title">
                    <Network size={18} />
                    <span>Industrial Agent Workforce</span>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-primary btn-sm btn-automated"
                        onClick={handleRunAutomated}
                        title="Start Automated Workflow Loop"
                    >
                        <Play size={14} /> Run Auto
                    </button>
                    <div className="metric-badge">
                        <Zap size={14} /> {dailyIterations} it/day
                    </div>
                    <div className="earnings-badge">
                        ${totalEarnings.toFixed(2)}
                    </div>
                </div>
            </div>

            <div className="tree-container">
                {/* Level 1: Management */}
                <div className="tree-level level-1">
                    <div className="node-sub-group">
                        <AgentNode role="manager" icon={ROLE_ICONS.manager} state={agents.manager} isCurrent={pipeline.currentAgent === 'manager'} onToggle={() => handleToggle('manager')} />
                        <AgentNode role="supervisor" icon={ROLE_ICONS.supervisor} state={agents.supervisor} isCurrent={pipeline.currentAgent === 'supervisor'} onToggle={() => handleToggle('supervisor')} />
                        <AgentNode role="ba" icon={ROLE_ICONS.ba} state={agents.ba} isCurrent={pipeline.currentAgent === 'ba'} onToggle={() => handleToggle('ba')} />
                    </div>
                </div>

                <div className="tree-connector"><ArrowDown size={16} /></div>

                {/* Level 2: Design & Lead */}
                <div className="tree-level level-2">
                    <div className="node-sub-group">
                        <AgentNode role="architect" icon={ROLE_ICONS.architect} state={agents.architect} isCurrent={pipeline.currentAgent === 'architect'} onToggle={() => handleToggle('architect')} />
                        <AgentNode role="senior-dev" icon={ROLE_ICONS['senior-dev']} state={agents['senior-dev']} isCurrent={pipeline.currentAgent === 'senior-dev'} onToggle={() => handleToggle('senior-dev')} />
                    </div>
                </div>

                <div className="tree-connector"><ArrowDown size={16} /></div>

                {/* Level 3: Workforce */}
                <div className="tree-level level-3">
                    <div className="node-sub-group">
                        <AgentNode role="fullstack-1" icon={ROLE_ICONS['fullstack-1']} state={agents['fullstack-1']} isCurrent={pipeline.currentAgent === 'fullstack-1'} onToggle={() => handleToggle('fullstack-1')} />
                        <AgentNode role="fullstack-2" icon={ROLE_ICONS['fullstack-2']} state={agents['fullstack-2']} isCurrent={pipeline.currentAgent === 'fullstack-2'} onToggle={() => handleToggle('fullstack-2')} />
                        <AgentNode role="fullstack-3" icon={ROLE_ICONS['fullstack-3']} state={agents['fullstack-3']} isCurrent={pipeline.currentAgent === 'fullstack-3'} onToggle={() => handleToggle('fullstack-3')} />
                    </div>
                </div>

                <div className="tree-connector"><ArrowDown size={16} /></div>

                {/* Level 4: Quality & Security */}
                <div className="tree-level level-4">
                    <div className="node-sub-group">
                        <AgentNode role="security" icon={ROLE_ICONS.security} state={agents.security} isCurrent={pipeline.currentAgent === 'security'} onToggle={() => handleToggle('security')} />
                        <AgentNode role="reviewer" icon={ROLE_ICONS.reviewer} state={agents.reviewer} isCurrent={pipeline.currentAgent === 'reviewer'} onToggle={() => handleToggle('reviewer')} />
                        <AgentNode role="functional-reviewer" icon={ROLE_ICONS['functional-reviewer']} state={agents['functional-reviewer']} isCurrent={pipeline.currentAgent === 'functional-reviewer'} onToggle={() => handleToggle('functional-reviewer')} />
                        <AgentNode role="tester-1" icon={ROLE_ICONS['tester-1']} state={agents['tester-1']} isCurrent={pipeline.currentAgent === 'tester-1'} onToggle={() => handleToggle('tester-1')} />
                    </div>
                </div>
            </div>

            <div className="card-footer-metrics">
                <div className="workflow-hint">
                    <ShieldCheck size={14} />
                    <span>Professional SDLC: Requirements → Architecture → Implementation → Security → Functional Review → Testing</span>
                </div>
            </div>
        </div>
    );
}

function AgentNode({ role, icon, state, isCurrent, onToggle, compact = false }: {
    role: AgentRole,
    icon: React.ReactNode,
    state: AgentState,
    isCurrent: boolean,
    onToggle: () => void,
    compact?: boolean
}) {
    return (
        <div
            className={`agent-node ${role} ${state.status === 'working' ? 'active' : ''} ${isCurrent ? 'current' : ''} ${!state.enabled ? 'disabled' : ''} ${compact ? 'compact' : ''}`}
            onClick={onToggle}
            title={`${state.enabled ? 'Enabled' : 'Disabled'} - Click to toggle`}
        >
            <div className="node-icon">{icon}</div>
            <div className="node-content">
                <div className="node-label">
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                    {state.iterations > 0 && <span className="node-iter">({state.iterations})</span>}
                </div>
                {!compact && state.enabled && <div className="node-status-msg">{state.message}</div>}
            </div>
            {!state.enabled && <div className="disabled-overlay">OFF</div>}
        </div>
    );
}
