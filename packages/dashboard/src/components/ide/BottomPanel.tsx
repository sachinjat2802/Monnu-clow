// ============================================================================
// Bottom Panel — Terminal, Output, Problems, AI Suggestions
// ============================================================================
/// <reference types="vite/client" />

import React, { useState, useRef, useEffect } from 'react';
import {
    Terminal, FileOutput, AlertTriangle, Sparkles, X, ChevronUp,
    ChevronDown, Plus, Trash2, Maximize2, Minimize2, AlertCircle,
    Info, CheckCircle
} from 'lucide-react';
import { useEditorStore, BottomPanel as BottomPanelType, TerminalLine, Problem } from '../../stores/editor';
import { useDashboardStore, ActivityItem } from '../../stores/dashboard';

const TABS: { id: BottomPanelType; icon: React.ReactNode; label: string }[] = [
    { id: 'terminal', icon: <Terminal size={14} />, label: 'Terminal' },
    { id: 'output', icon: <FileOutput size={14} />, label: 'Output' },
    { id: 'problems', icon: <AlertTriangle size={14} />, label: 'Problems' },
    { id: 'ai-suggestions', icon: <Sparkles size={14} />, label: 'AI Suggestions' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function executeTerminalCommand(command: string): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
    try {
        const res = await fetch(`${API_URL}/terminal/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Execution failed');
        return data;
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

function TerminalView() {
    const { terminalLines, addTerminalLine, clearTerminal, addTerminalHistory, terminalHistory } = useEditorStore();
    const [input, setInput] = useState('');
    const [historyIndex, setHistoryIndex] = useState(-1);
    const terminalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalLines]);

    const handleCommand = async (cmd: string) => {
        if (!cmd.trim()) return;

        addTerminalHistory(cmd);
        addTerminalLine({
            id: `input-${Date.now()}`,
            content: `$ ${cmd}`,
            type: 'input',
            timestamp: Date.now(),
        });

        setInput('');
        setHistoryIndex(-1);

        if (cmd.trim().toLowerCase() === 'clear') {
            clearTerminal();
            return;
        }

        const result = await executeTerminalCommand(cmd);

        if (result.success) {
            if (result.stdout) {
                addTerminalLine({
                    id: `output-${Date.now()}`,
                    content: result.stdout.trimEnd(),
                    type: 'output',
                    timestamp: Date.now(),
                });
            }
            if (result.stderr) {
                addTerminalLine({
                    id: `error-${Date.now()}`,
                    content: result.stderr.trimEnd(),
                    type: 'error',
                    timestamp: Date.now(),
                });
            }
            // Add an empty line if completely silent output
            if (!result.stdout && !result.stderr) {
                addTerminalLine({
                    id: `output-${Date.now()}`,
                    content: '',
                    type: 'output',
                    timestamp: Date.now(),
                });
            }
        } else {
            addTerminalLine({
                id: `error-${Date.now()}`,
                content: result.stderr || result.error || 'Command execution failed.',
                type: 'error',
                timestamp: Date.now(),
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCommand(input);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (terminalHistory.length > 0) {
                const newIndex = historyIndex < terminalHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setInput(terminalHistory[terminalHistory.length - 1 - newIndex] || '');
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(terminalHistory[terminalHistory.length - 1 - newIndex] || '');
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            clearTerminal();
        }
    };

    return (
        <div className="terminal-view" onClick={() => inputRef.current?.focus()}>
            <div className="terminal-output" ref={terminalRef}>
                {terminalLines.map((line) => (
                    <div key={line.id} className={`terminal-line ${line.type}`}>
                        {line.content}
                    </div>
                ))}
            </div>
            <div className="terminal-input-line">
                <span className="terminal-prompt">$</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="terminal-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type command..."
                    spellCheck={false}
                    autoComplete="off"
                />
            </div>
        </div>
    );
}

function ProblemsView() {
    const { problems } = useEditorStore();

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'error': return <AlertCircle size={14} className="problem-icon-error" />;
            case 'warning': return <AlertTriangle size={14} className="problem-icon-warning" />;
            case 'info': return <Info size={14} className="problem-icon-info" />;
            default: return <CheckCircle size={14} className="problem-icon-hint" />;
        }
    };

    return (
        <div className="problems-view">
            <div className="problems-summary">
                <span className="problem-count error"><AlertCircle size={12} /> {problems.filter(p => p.severity === 'error').length} Errors</span>
                <span className="problem-count warning"><AlertTriangle size={12} /> {problems.filter(p => p.severity === 'warning').length} Warnings</span>
                <span className="problem-count info"><Info size={12} /> {problems.filter(p => p.severity === 'info').length} Info</span>
            </div>
            <div className="problems-list">
                {problems.length === 0 ? (
                    <div className="p-4 text-xs opacity-50">No problems detected in the workspace.</div>
                ) : (
                    problems.map((problem) => (
                        <div key={problem.id} className="problem-item">
                            {getSeverityIcon(problem.severity)}
                            <span className="problem-message">{problem.message}</span>
                            <span className="problem-source">{problem.source}</span>
                            <span className="problem-location">{problem.file}:{problem.line}:{problem.column}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function OutputView() {
    const { activities } = useDashboardStore();
    return (
        <div className="output-view">
            {activities.length === 0 ? (
                <div className="p-4 text-xs opacity-50">No output yet.</div>
            ) : (
                activities.slice(0, 100).map((act: ActivityItem) => (
                    <div key={act.id} className={`terminal-line ${act.level}`}>
                        [{new Date(act.timestamp).toLocaleTimeString()}] [{act.source}] {act.message}
                    </div>
                ))
            )}
        </div>
    );
}

function AISuggestionsView() {
    return (
        <div className="ai-suggestions-view">
            <div className="ai-suggestion-item">
                <Sparkles size={14} className="ai-sparkle-icon" />
                <div className="ai-suggestion-content">
                    <strong>Performance Optimization</strong>
                    <p>Consider using <code>React.memo()</code> for the AgentCard component — it re-renders frequently but its props rarely change.</p>
                </div>
            </div>
            <div className="ai-suggestion-item">
                <Sparkles size={14} className="ai-sparkle-icon" />
                <div className="ai-suggestion-content">
                    <strong>Type Safety</strong>
                    <p>The <code>handleSaveFile</code> function could benefit from explicit return type annotation for better type safety.</p>
                </div>
            </div>
            <div className="ai-suggestion-item">
                <Sparkles size={14} className="ai-sparkle-icon" />
                <div className="ai-suggestion-content">
                    <strong>Code Quality</strong>
                    <p>Extract the language detection logic into a shared utility function — it's duplicated in EditorPanel and StatusBar.</p>
                </div>
            </div>
        </div>
    );
}

export function BottomPanel() {
    const { bottomPanel, setBottomPanel, bottomPanelHeight, setBottomPanelHeight, problems } = useEditorStore();
    const [isMaximized, setIsMaximized] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const errorCount = problems.filter(p => p.severity === 'error').length;
    const warningCount = problems.filter(p => p.severity === 'warning').length;

    // Drag resize handler
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const windowHeight = window.innerHeight;
            const newHeight = windowHeight - e.clientY - 25; // 25 for status bar
            setBottomPanelHeight(Math.max(100, Math.min(windowHeight * 0.6, newHeight)));
        };

        const handleMouseUp = () => setIsDragging(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, setBottomPanelHeight]);

    if (!bottomPanel) return null;

    const height = isMaximized ? 'calc(100vh - 90px)' : `${bottomPanelHeight}px`;

    return (
        <div className="ide-bottom-panel" ref={panelRef} style={{ '--panel-height': height } as React.CSSProperties}>
            {/* Resize handle */}
            <div
                className="bottom-panel-resize"
                onMouseDown={() => setIsDragging(true)}
            />

            {/* Tabs */}
            <div className="bottom-panel-tabs">
                <div className="bottom-panel-tab-list">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            className={`bottom-panel-tab ${bottomPanel === tab.id ? 'active' : ''}`}
                            onClick={() => setBottomPanel(tab.id)}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.id === 'problems' && (errorCount + warningCount) > 0 && (
                                <span className="bottom-tab-badge">{errorCount + warningCount}</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="bottom-panel-actions">
                    <button
                        className="bottom-panel-action-btn"
                        onClick={() => setIsMaximized(!isMaximized)}
                        title={isMaximized ? 'Restore' : 'Maximize'}
                    >
                        {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        className="bottom-panel-action-btn"
                        onClick={() => setBottomPanel(null)}
                        title="Close Panel"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bottom-panel-content">
                {bottomPanel === 'terminal' && <TerminalView />}
                {bottomPanel === 'output' && <OutputView />}
                {bottomPanel === 'problems' && <ProblemsView />}
                {bottomPanel === 'ai-suggestions' && <AISuggestionsView />}
            </div>
        </div>
    );
}
