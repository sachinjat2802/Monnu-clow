// ============================================================================
// Editor Area — Monaco Editor with tabs and split views
// ============================================================================

import React, { useRef, useEffect } from 'react';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';
import { X, FileDiff, Play, Save, ChevronRight, SplitSquareHorizontal } from 'lucide-react';
import { useDashboardStore, AgentRole } from '../../stores/dashboard';
import { useEditorStore } from '../../stores/editor';
import { Network, Cpu, Bot, ShieldCheck, Zap, Code, Shield, Search } from 'lucide-react';

const ROLE_ICONS: Record<string, React.ReactNode> = {
    supervisor: <ShieldCheck size={14} />,
    planner: <Zap size={14} />,
    coder: <Code size={14} />,
    tester: <Search size={14} />,
    reviewer: <Shield size={14} />,
    debugger: <Search size={14} />,
    'coder-1': <Code size={14} />,
    'coder-2': <Code size={14} />,
    'coder-3': <Code size={14} />,
    'tester-1': <Search size={14} />,
    'tester-2': <Search size={14} />,
    'fullstack-1': <Code size={14} />,
    'fullstack-2': <Code size={14} />,
    'fullstack-3': <Code size={14} />,
    'ba': <Zap size={14} />,
    'manager': <ShieldCheck size={14} />,
    'architect': <Zap size={14} />,
    'senior-dev': <Code size={14} />,
    'functional-reviewer': <Shield size={14} />,
    'security': <ShieldCheck size={14} />
};

interface EditorAreaProps {
    onRunTask: (task: string) => void;
}

export function EditorArea({ onRunTask }: EditorAreaProps) {
    const { tabs, activeTabId, setActiveTabId, removeTab, updateTab, agents } = useDashboardStore();
    const {
        showMinimap, wordWrap, fontSize, setCursorPosition,
        inlineSuggestion, setInlineSuggestion, setCommandPaletteOpen,
        setSelectedText
    } = useEditorStore();

    const [viewMode, setViewMode] = React.useState<'editor' | 'diff'>('editor');
    const activeTab = tabs.find(t => t.id === activeTabId);
    const currentTask = useDashboardStore(state => state.currentTask);
    const runningAgents = Object.values(agents).filter(a => a.status === 'working' && a.enabled);

    // Setup Monaco instance
    const monaco = useMonaco();

    useEffect(() => {
        if (monaco) {
            // Apply custom theme
            monaco.editor.defineTheme('monnu-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
                    { token: 'keyword', foreground: 'ff79c6' },
                    { token: 'string', foreground: 'f1fa8c' },
                    { token: 'number', foreground: 'bd93f9' },
                    { token: 'identifier', foreground: 'f8f8f2' },
                    { token: 'type', foreground: '8be9fd' },
                ],
                colors: {
                    'editor.background': '#16161f',
                    'editor.foreground': '#f8f8f2',
                    'editorCursor.foreground': '#f8f8f0',
                    'editor.lineHighlightBackground': '#21222c',
                    'editorLineNumber.foreground': '#6272a4',
                    'editorIndentGuide.background': '#282a36',
                    'editorIndentGuide.activeBackground': '#44475a',
                    'editorSuggestWidget.background': '#21222c',
                    'editorSuggestWidget.border': '#44475a',
                    'editorSuggestWidget.foreground': '#f8f8f2',
                    'editorSuggestWidget.selectedBackground': '#44475a',
                    'editorWidget.background': '#21222c',
                    'editorWidget.border': '#44475a',
                }
            });
            monaco.editor.setTheme('monnu-dark');
        }
    }, [monaco]);

    const handleSaveFile = async () => {
        if (!activeTab || !activeTab.isDirty) return;
        try {
            const root = '.'; // Assuming root is '.' for now or fetch from workspace
            const res = await fetch('/api/files/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: activeTab.path,
                    content: activeTab.content,
                    root
                })
            });

            if (res.ok) {
                updateTab(activeTab.id, { isDirty: false, originalContent: activeTab.content });
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save');
            }
        } catch (err) {
            console.error('Failed to save file', err);
            alert(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleEditorChange = (value: string | undefined) => {
        if (activeTab && value !== undefined) {
            updateTab(activeTab.id, { content: value, isDirty: true });
        }
    };

    const handleEditorMount = (editor: any, monaco: any) => {
        // Track cursor position
        editor.onDidChangeCursorPosition((e: any) => {
            setCursorPosition({
                line: e.position.lineNumber,
                column: e.position.column
            });
        });

        // Track selection
        editor.onDidChangeCursorSelection((e: any) => {
            const selection = editor.getSelection();
            if (selection) {
                const text = editor.getModel().getValueInRange(selection);
                setSelectedText(text);
            }
        });

        // Add command palette shortcut
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
            setCommandPaletteOpen(true);
        });
    };

    return (
        <div className="ide-editor-area">
            {/* Editor Tabs */}
            <div className="ide-tabs-container">
                {tabs.length === 0 ? (
                    <div className="ide-no-tabs" />
                ) : (
                    tabs.map(tab => (
                        <div
                            key={tab.id}
                            className={`ide-tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
                            onClick={() => setActiveTabId(tab.id)}
                            onAuxClick={(e) => {
                                if (e.button === 1) removeTab(tab.id); // Middle click closes
                            }}
                            title={tab.path}
                        >
                            <span className="ide-tab-name">{tab.name}</span>
                            <button
                                className="ide-tab-close"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeTab(tab.id);
                                }}
                                title="Close tab"
                                aria-label="Close tab"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))
                )}

                {tabs.length > 0 && (
                    <div className="ide-tab-actions">
                        <button
                            className={`ide-tab-action-btn ${viewMode === 'diff' ? 'active' : ''}`}
                            onClick={() => setViewMode(v => v === 'editor' ? 'diff' : 'editor')}
                            title="Compare with saved"
                        >
                            <FileDiff size={14} />
                        </button>
                        <button className="ide-tab-action-btn" title="Split Editor Right">
                            <SplitSquareHorizontal size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Breadcrumbs */}
            {activeTab && (
                <div className="ide-breadcrumbs">
                    <span>{activeTab.workspaceId === 'default' ? 'workspace' : activeTab.workspaceId}</span>
                    <ChevronRight size={12} className="breadcrumb-separator" />
                    {activeTab.path.split('/').map((part, i, arr) => (
                        <React.Fragment key={i}>
                            <span className={i === arr.length - 1 ? 'breadcrumb-current' : ''}>{part}</span>
                            {i < arr.length - 1 && <ChevronRight size={12} className="breadcrumb-separator" />}
                        </React.Fragment>
                    ))}

                    {/* Running Agent Overlay - Inline with breadcrumbs for space saving */}
                    {runningAgents.length > 0 && (
                        <div className="running-agents-track">
                            {runningAgents.map(agent => (
                                <div key={agent.role} className="agent-running-pill">
                                    {ROLE_ICONS[agent.role]}
                                    <span>{agent.role}</span>
                                    {agent.iterations > 0 && <span className="iter-count">v{agent.iterations}</span>}
                                    <span className="running-dot" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Editor Content */}
            <div className={`ide-editor-content ${runningAgents.length > 0 ? 'agent-active-glow' : ''}`}>
                {/* Working Status Overlay */}
                {runningAgents.length > 0 && (
                    <div className="editor-agent-overlay">
                        <div className="overlay-content">
                            <Bot className="pulse-icon" size={24} />
                            <div className="overlay-text-container">
                                <div className="overlay-agent-identity">
                                    {runningAgents.length > 1
                                        ? `${runningAgents.length} Agents Collaborating`
                                        : `${runningAgents[0].role.toUpperCase()} is working`}
                                </div>
                                <div className="overlay-task-detail">
                                    {currentTask?.detail || 'Analyzing codebase...'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab ? (
                    viewMode === 'editor' ? (
                        <Editor
                            height="100%"
                            language={
                                activeTab.path.endsWith('.ts') || activeTab.path.endsWith('.tsx') ? 'typescript' :
                                    activeTab.path.endsWith('.js') ? 'javascript' :
                                        activeTab.path.endsWith('.css') ? 'css' :
                                            activeTab.path.endsWith('.json') ? 'json' :
                                                activeTab.path.endsWith('.html') ? 'html' :
                                                    activeTab.path.endsWith('.md') ? 'markdown' : 'plaintext'
                            }
                            theme="monnu-dark"
                            value={activeTab.content}
                            onChange={handleEditorChange}
                            onMount={handleEditorMount}
                            options={{
                                minimap: { enabled: showMinimap },
                                fontSize,
                                wordWrap: wordWrap ? 'on' : 'off',
                                automaticLayout: true,
                                scrollBeyondLastLine: false,
                                smoothScrolling: true,
                                cursorBlinking: 'smooth',
                                cursorSmoothCaretAnimation: 'on',
                                formatOnPaste: true,
                                inlineSuggest: { enabled: true },
                                padding: { top: 16 },
                                readOnly: runningAgents.some(a => a.role === 'coder' && a.status === 'working')
                            }}
                        />
                    ) : (
                        <DiffEditor
                            height="100%"
                            original={activeTab.originalContent || ''}
                            modified={activeTab.content}
                            language={
                                activeTab.path.endsWith('.ts') || activeTab.path.endsWith('.tsx') ? 'typescript' :
                                    activeTab.path.endsWith('.js') ? 'javascript' :
                                        activeTab.path.endsWith('.css') ? 'css' :
                                            activeTab.path.endsWith('.json') ? 'json' : 'markdown'
                            }
                            theme="monnu-dark"
                            options={{
                                minimap: { enabled: showMinimap },
                                fontSize,
                                wordWrap: wordWrap ? 'on' : 'off',
                                automaticLayout: true,
                                renderSideBySide: true,
                            }}
                        />
                    )
                ) : (
                    <div className="ide-empty-state">
                        <div className="ide-empty-logo">M</div>
                        <h2>Monnu Clow IDE</h2>
                        <div className="ide-shortcuts">
                            <div className="ide-shortcut">
                                <span>Show Command Palette</span>
                                <kbd>Ctrl+Shift+P</kbd>
                            </div>
                            <div className="ide-shortcut">
                                <span>Go to File</span>
                                <kbd>Ctrl+P</kbd>
                            </div>
                            <div className="ide-shortcut">
                                <span>Toggle Terminal</span>
                                <kbd>Ctrl+`</kbd>
                            </div>
                            <div className="ide-shortcut">
                                <span>Open AI Copilot</span>
                                <kbd>Ctrl+Shift+I</kbd>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
