// ============================================================================
// Status Bar — VS Code-style bottom status bar
// ============================================================================

import React from 'react';
import {
    GitBranch, AlertTriangle, AlertCircle, Info, CheckCircle,
    Wifi, WifiOff, Bell, Sparkles, Columns, Zap
} from 'lucide-react';
import { useEditorStore } from '../../stores/editor';
import { useDashboardStore } from '../../stores/dashboard';

function getLanguageFromPath(path: string): string {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'TypeScript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'JavaScript';
    if (path.endsWith('.css') || path.endsWith('.scss')) return 'CSS';
    if (path.endsWith('.html')) return 'HTML';
    if (path.endsWith('.json')) return 'JSON';
    if (path.endsWith('.md')) return 'Markdown';
    if (path.endsWith('.py')) return 'Python';
    if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'YAML';
    if (path.endsWith('.rs')) return 'Rust';
    if (path.endsWith('.go')) return 'Go';
    return 'Plain Text';
}

export function StatusBar() {
    const { cursorPosition, gitBranch, problems, fontSize, wordWrap, showMinimap,
        notifications, setCommandPaletteOpen, setSidebarPanel } = useEditorStore();
    const { connected, tabs, activeTabId, dailyIterations, totalEarnings } = useDashboardStore();

    const activeTab = tabs.find(t => t.id === activeTabId);
    const errorCount = problems.filter(p => p.severity === 'error').length;
    const warningCount = problems.filter(p => p.severity === 'warning').length;
    const language = activeTab ? getLanguageFromPath(activeTab.path) : 'Plain Text';

    return (
        <div className="ide-status-bar" id="status-bar">
            {/* Left side */}
            <div className="status-bar-left">
                <button className="status-bar-item git-branch" onClick={() => setSidebarPanel('git')}>
                    <GitBranch size={13} />
                    <span>{gitBranch}</span>
                </button>

                <button className="status-bar-item status-bar-errors">
                    <AlertCircle size={13} />
                    <span>{errorCount}</span>
                    <AlertTriangle size={13} />
                    <span>{warningCount}</span>
                </button>

                {connected ? (
                    <div className="status-bar-item connected">
                        <Wifi size={13} />
                        <span>Connected</span>
                    </div>
                ) : (
                    <div className="status-bar-item disconnected">
                        <WifiOff size={13} />
                        <span>Disconnected</span>
                    </div>
                )}

                <div className="status-bar-item metrics">
                    <Zap size={13} />
                    <span>{dailyIterations} it/day</span>
                </div>

                <div className="status-bar-item earnings">
                    <span>${totalEarnings.toFixed(2)}</span>
                </div>
            </div>

            {/* Right side */}
            <div className="status-bar-right">
                <button
                    className="status-bar-item ai-status"
                    onClick={() => setSidebarPanel('ai-chat')}
                    title="AI Copilot"
                >
                    <Sparkles size={13} />
                    <span>Copilot</span>
                </button>

                <div className="status-bar-item">
                    <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
                </div>

                <div className="status-bar-item">
                    <span>Spaces: 4</span>
                </div>

                <div className="status-bar-item">
                    <span>UTF-8</span>
                </div>

                <button className="status-bar-item language-selector">
                    <span>{language}</span>
                </button>

                <button
                    className="status-bar-item"
                    onClick={() => setCommandPaletteOpen(true)}
                    title="Command Palette (Ctrl+Shift+P)"
                >
                    <span>Ctrl+Shift+P</span>
                </button>

                {notifications.length > 0 && (
                    <div className="status-bar-item notification-badge">
                        <Bell size={13} />
                        <span className="notif-count">{notifications.length}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
