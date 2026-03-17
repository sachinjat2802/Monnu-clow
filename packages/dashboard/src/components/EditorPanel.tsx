import React, { useState, useEffect, useCallback } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { Play, Folder, File as FileIcon, Save, RefreshCw, X, FileDiff, Layers, Plus } from 'lucide-react';
import { useDashboardStore, EditorTab, WorkspaceItem } from '../stores/dashboard';

interface FileNode {
    name: string;
    path: string;
    isDir: boolean;
    children?: FileNode[];
    workspaceId?: string;
}

export function EditorPanel({ onRunTask }: { onRunTask: (task: string) => void }) {
    const {
        tabs, activeTabId, setActiveTabId, addTab, removeTab, updateTab,
        workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId
    } = useDashboardStore();

    const [tree, setTree] = useState<FileNode[]>([]);
    const [taskPrompt, setTaskPrompt] = useState<string>('');
    const [testResult, setTestResult] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'editor' | 'diff'>('editor');
    const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
    const [newWorkspacePath, setNewWorkspacePath] = useState('');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');

    const activeTab = tabs.find(t => t.id === activeTabId);

    const handleAddWorkspace = () => {
        if (!newWorkspacePath || !newWorkspaceName) return;
        const id = `ws-${Date.now()}`;
        setWorkspaces([...workspaces, { id, name: newWorkspaceName, path: newWorkspacePath }]);
        setActiveWorkspaceId(id);
        setNewWorkspacePath('');
        setNewWorkspaceName('');
        setIsWorkspaceModalOpen(false);
    };

    const fetchTree = useCallback(async () => {
        try {
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const res = await fetch(`/api/files/tree?root=${encodeURIComponent(root)}`);
            const data = await res.json();
            setTree(data.files || []);

            // If no workspaces, let's add the default one
            if (workspaces.length === 0) {
                setWorkspaces([{ id: 'default', name: 'Current Project', path: '.' }]);
                setActiveWorkspaceId('default');
            }
        } catch (err) {
            console.error('Failed to fetch tree', err);
        }
    }, [workspaces, activeWorkspaceId, setActiveWorkspaceId, setWorkspaces]);

    useEffect(() => {
        fetchTree();
    }, [fetchTree]);

    const handleOpenFile = async (path: string) => {
        const tabId = `${activeWorkspaceId}:${path}`;
        const existingTab = tabs.find(t => t.id === tabId);

        if (existingTab) {
            setActiveTabId(tabId);
            return;
        }

        try {
            setLoading(true);
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}&root=${encodeURIComponent(root)}`);
            const data = await res.json();
            if (res.ok) {
                const name = path.split('/').pop() || path;
                addTab({
                    id: tabId,
                    path,
                    workspaceId: activeWorkspaceId || 'default',
                    name,
                    content: data.content,
                    isDirty: false,
                    originalContent: data.content
                });
            }
        } catch (err) {
            console.error('Failed to open file', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveFile = async () => {
        if (!activeTab) return;
        try {
            setSaving(true);
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const res = await fetch('/api/files/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: activeTab.path, content: activeTab.content, root }),
            });
            if (res.ok) {
                updateTab(activeTab.id, { isDirty: false, originalContent: activeTab.content });
            }
        } catch (err) {
            console.error('Failed to save file', err);
        } finally {
            setSaving(false);
        }
    };

    const handleRunTest = async () => {
        try {
            setTestResult('Running tests...');
            const res = await fetch('/api/test', { method: 'POST' });
            const data = await res.json();
            setTestResult(data.stdout + (data.stderr ? '\n' + data.stderr : ''));
        } catch (err: any) {
            setTestResult('Failed to run tests: ' + err.message);
        }
    };

    const renderTree = (nodes: FileNode[]) => {
        return nodes.map((node) => (
            <div key={node.path} className={node.isDir ? "file-tree-node-dir" : "file-tree-node-file"}>
                <div
                    className={`file-tree-item ${activeTabId === node.path ? 'active' : ''}`}
                    onClick={() => {
                        if (!node.isDir) {
                            handleOpenFile(node.path);
                        }
                    }}
                >
                    {node.isDir ? <Folder size={14} className="file-tree-icon-dir" /> : <FileIcon size={14} className="file-tree-icon-file" />}
                    <span className="file-tree-item-name">{node.name}</span>
                </div>
                {node.isDir && node.children && (
                    <div className="file-tree-children">
                        {renderTree(node.children)}
                    </div>
                )}
            </div>
        ));
    };

    const submitTask = async () => {
        if (!taskPrompt) return;

        try {
            await fetch('/api/files/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'docs/requirements.md', content: taskPrompt }),
            });
            onRunTask(taskPrompt);
            setTaskPrompt('');
            fetchTree();
        } catch (err) {
            console.error('Failed to save tasks', err);
        }
    };

    return (
        <div className="editor-panel-container">

            {/* Top Toolbar / Task Input */}
            <div className="card editor-task-card">
                <div className="card-header editor-task-header">
                    <div className="card-title"><Play size={16} className="editor-task-icon" />Assign Task to Pipeline</div>
                </div>
                <div className="editor-task-layout">
                    <textarea
                        value={taskPrompt}
                        onChange={(e) => setTaskPrompt(e.target.value)}
                        placeholder="Describe your task Requirements here (e.g. Implement a new API endpoint)..."
                        rows={2}
                        className="editor-task-input"
                    />
                    <button type="button" className="btn btn-primary editor-task-btn" onClick={submitTask}>Start Pipeline</button>
                </div>
            </div>

            <div className="editor-main-area">

                {/* Explorer Sidebar */}
                <div className="card editor-sidebar">
                    <div className="card-header editor-sidebar-header">
                        <div className="workspace-selector">
                            <Layers size={14} />
                            <select
                                value={activeWorkspaceId || ''}
                                onChange={(e) => setActiveWorkspaceId(e.target.value)}
                                className="workspace-dropdown"
                                title="Select Workspace"
                            >
                                {workspaces.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                            <button
                                className="btn btn-ghost btn-xs"
                                title="Add Folder to Workspace"
                                aria-label="Add Folder to Workspace"
                                onClick={() => setIsWorkspaceModalOpen(true)}
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <button type="button" className="btn btn-ghost editor-sidebar-refresh" onClick={fetchTree} title="Refresh File Tree"><RefreshCw size={14} /></button>
                    </div>

                    {isWorkspaceModalOpen && (
                        <div className="modal-overlay">
                            <div className="card modal-content modal-body">
                                <h3 className="modal-title">Add Workspace Folder</h3>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Workspace Name (e.g. Project Alpha)"
                                    value={newWorkspaceName}
                                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                                />
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Relative Path (e.g. examples/project-alpha)"
                                    value={newWorkspacePath}
                                    onChange={(e) => setNewWorkspacePath(e.target.value)}
                                />
                                <div className="modal-footer">
                                    <button className="btn btn-primary" onClick={handleAddWorkspace}>Add</button>
                                    <button className="btn btn-ghost" onClick={() => setIsWorkspaceModalOpen(false)}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="card-body editor-sidebar-body explorer-view">
                        <div className="sidebar-section-title">EXPLORER</div>
                        {renderTree(tree)}
                    </div>
                </div>

                {/* Editor Area with Tabs */}
                <div className="card editor-workspace">
                    <div className="editor-tabs-container">
                        {tabs.map(tab => (
                            <div
                                key={tab.id}
                                className={`editor-tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
                                onClick={() => setActiveTabId(tab.id)}
                            >
                                <span className="tab-name">{tab.name}</span>
                                <button
                                    className="tab-close"
                                    title="Close Tab"
                                    aria-label="Close Tab"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeTab(tab.id);
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="card-header editor-workspace-header">
                        <div className="card-title">
                            {activeTab ? activeTab.path : 'Editor (Select a file)'}
                        </div>
                        {activeTab && (
                            <div className="editor-workspace-actions">
                                <button
                                    type="button"
                                    className={`btn btn-ghost editor-btn-icon ${viewMode === 'diff' ? 'active' : ''}`}
                                    onClick={() => setViewMode(v => v === 'editor' ? 'diff' : 'editor')}
                                    title="Toggle Comparison View"
                                >
                                    <FileDiff size={14} /> Compare
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost editor-btn-icon"
                                    onClick={handleRunTest}
                                >
                                    <Play size={14} /> Run Tests
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary editor-btn-icon"
                                    onClick={handleSaveFile}
                                    disabled={saving || !activeTab.isDirty}
                                >
                                    <Save size={14} /> Save
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="editor-workspace-content">
                        {activeTab ? (
                            viewMode === 'editor' ? (
                                <Editor
                                    height="100%"
                                    language={activeTab.path.endsWith('.ts') || activeTab.path.endsWith('.tsx') ? 'typescript' :
                                        activeTab.path.endsWith('.js') ? 'javascript' :
                                            activeTab.path.endsWith('.css') ? 'css' :
                                                activeTab.path.endsWith('.json') ? 'json' : 'markdown'}
                                    theme="vs-dark"
                                    value={activeTab.content}
                                    onChange={(value) => updateTab(activeTab.id, { content: value || '', isDirty: true })}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        wordWrap: 'on',
                                        automaticLayout: true,
                                    }}
                                />
                            ) : (
                                <DiffEditor
                                    height="100%"
                                    original={activeTab.originalContent || ''}
                                    modified={activeTab.content}
                                    language={activeTab.path.endsWith('.ts') || activeTab.path.endsWith('.tsx') ? 'typescript' :
                                        activeTab.path.endsWith('.js') ? 'javascript' :
                                            activeTab.path.endsWith('.css') ? 'css' :
                                                activeTab.path.endsWith('.json') ? 'json' : 'markdown'}
                                    theme="vs-dark"
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        readOnly: false,
                                        automaticLayout: true,
                                    }}
                                />
                            )
                        ) : (
                            <div className="editor-workspace-empty">
                                <div className="empty-state-icon"><Layers size={48} /></div>
                                <h3>No files open</h3>
                                <p>Select a file from the explorer to start editing</p>
                            </div>
                        )}
                        {loading && (
                            <div className="editor-loading-overlay">
                                <div className="spinner"></div>
                                Loading...
                            </div>
                        )}
                    </div>

                    {/* Console / Output Area */}
                    <div className="editor-terminal-area">
                        <div className="terminal-header">
                            <span>OUTPUT</span>
                        </div>
                        <div className="terminal-content">
                            {testResult || 'Ready...'}
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
}
