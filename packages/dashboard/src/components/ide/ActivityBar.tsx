// ============================================================================
// Activity Bar — VS Code-style icon sidebar
// ============================================================================

import React from 'react';
import {
    Files, Search, GitBranch, Bot, Settings, Zap
} from 'lucide-react';
import { useEditorStore, SidebarPanel } from '../../stores/editor';

const TOP_ITEMS: { panel: SidebarPanel; icon: React.ReactNode; label: string }[] = [
    { panel: 'explorer', icon: <Files size={22} />, label: 'Explorer' },
    { panel: 'search', icon: <Search size={22} />, label: 'Search' },
    { panel: 'git', icon: <GitBranch size={22} />, label: 'Source Control' },
    { panel: 'workflows', icon: <Zap size={22} />, label: 'Workflows' },
    { panel: 'ai-chat', icon: <Bot size={22} />, label: 'AI Copilot' },
];

export function ActivityBar({ onBackToDashboard }: { onBackToDashboard?: () => void }) {
    const { sidebarPanel, setSidebarPanel } = useEditorStore();

    return (
        <div className="ide-activity-bar" id="activity-bar">
            <div className="activity-bar-brand" title="Monnu Clow" onClick={onBackToDashboard} style={{ cursor: onBackToDashboard ? 'pointer' : 'default' }}>
                M
            </div>
            <div className="activity-bar-top">
                {TOP_ITEMS.map((item) => (
                    <button
                        key={item.panel}
                        className={`activity-bar-btn ${sidebarPanel === item.panel ? 'active' : ''}`}
                        onClick={() => setSidebarPanel(item.panel)}
                        title={item.label}
                        aria-label={item.label}
                    >
                        {item.icon}
                        {sidebarPanel === item.panel && <div className="activity-bar-indicator" />}
                    </button>
                ))}
            </div>
            <div className="activity-bar-bottom">
                <button
                    className="activity-bar-btn"
                    title="Settings"
                    aria-label="Settings"
                    onClick={() => setSidebarPanel('extensions')}
                >
                    <Settings size={22} />
                </button>
            </div>
        </div>
    );
}
