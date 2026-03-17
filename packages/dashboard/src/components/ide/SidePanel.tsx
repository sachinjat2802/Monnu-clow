// ============================================================================
// Sidebar Panel — File Explorer, Search, Git, Extensions
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
    Files, Search, GitBranch, Puzzle, Folder, File as FileIcon,
    ChevronRight, ChevronDown, RefreshCw, Plus, FolderPlus,
    Star, Download, Check, Layers, Settings, X,
    GitCommit, GitMerge, FilePlus, Trash2, Edit2, ExternalLink,
    Copy, Clipboard as ClipboardIcon
} from 'lucide-react';
import { useEditorStore, SidebarPanel, SearchResult, GitChange } from '../../stores/editor';
import { useDashboardStore, WorkspaceItem } from '../../stores/dashboard';
import { AIChatPanel } from './AIChatPanel';
import { OrchestrationTree } from '../dashboard/OrchestrationTree';

// ===================== Workflows Panel =====================

function WorkflowsPanel() {
    const activities = useDashboardStore(state => state.activities);
    const currentTask = useDashboardStore(state => state.currentTask);

    return (
        <div className="sidebar-workflows">
            {currentTask && (
                <div className="active-mission-card">
                    <div className="mission-label">ACTIVE MISSION</div>
                    <div className="mission-title">{currentTask.title}</div>
                    <div className="mission-status-row">
                        <div className="status-indicator">
                            <span className={`status-dot ${currentTask.status}`} />
                            <span className="status-text">{currentTask.status}</span>
                        </div>
                        <div className="mission-detail">{currentTask.detail}</div>
                    </div>
                </div>
            )}

            <div className="sidebar-section-label">AGENT ORCHESTRATION</div>
            <OrchestrationTree compact />

            <div className="sidebar-section-label">ACTIVITY FEED</div>
            <div className="sidebar-activity-feed">
                {activities.slice(0, 30).map(activity => (
                    <div key={activity.id} className="sidebar-activity-item">
                        <span className={`activity-dot ${activity.level}`} />
                        <div className="activity-content">
                            <span className="activity-source">{activity.source}:</span>
                            <span className="activity-text">{activity.message}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ===================== File Explorer =====================

interface FileNode {
    name: string;
    path: string;
    isDir: boolean;
    children?: FileNode[];
}

interface FileExplorerProps {
    handleOpenFile: (path: string) => void;
}

function FileExplorer({ handleOpenFile }: FileExplorerProps) {
    const {
        activeTabId, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId, workspaces
    } = useDashboardStore();

    const [tree, setTree] = useState<FileNode[]>([]);
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [newWorkspacePath, setNewWorkspacePath] = useState('');

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: FileNode } | null>(null);
    const [clipboard, setClipboard] = useState<{ path: string, name: string, isCut?: boolean } | null>(null);
    const [dragOverPath, setDragOverPath] = useState<string | null>(null);
    const [renamingNode, setRenamingNode] = useState<string | null>(null);
    const [renamingValue, setRenamingValue] = useState('');
    const [newEntity, setNewEntity] = useState<{ type: 'file' | 'dir', parentPath: string } | null>(null);
    const [newEntityValue, setNewEntityValue] = useState('');

    const fetchTree = useCallback(async () => {
        try {
            setLoading(true);
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const res = await fetch(`/api/files/tree?root=${encodeURIComponent(root)}`);
            const data = await res.json();
            setTree(data.files || []);
            if (workspaces.length === 0) {
                setWorkspaces([{ id: 'default', name: 'Current Project', path: '.' }]);
                setActiveWorkspaceId('default');
            }
        } catch (err) {
            console.error('Failed to fetch tree:', err);
            setTree([]);
        } finally {
            setLoading(false);
        }
    }, [workspaces, activeWorkspaceId, setWorkspaces, setActiveWorkspaceId]);

    useEffect(() => { fetchTree(); }, [fetchTree]);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const toggleDir = (path: string) => {
        setExpandedDirs(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const handleAddWorkspace = () => {
        if (!newWorkspacePath || !newWorkspaceName) return;
        const id = `ws-${Date.now()}`;
        setWorkspaces([...workspaces, { id, name: newWorkspaceName, path: newWorkspacePath }]);
        setActiveWorkspaceId(id);
        setNewWorkspacePath('');
        setNewWorkspaceName('');
        setIsWorkspaceModalOpen(false);
    };

    const getFileIcon = (name: string): string => {
        if (name.endsWith('.tsx') || name.endsWith('.ts')) return '🟦';
        if (name.endsWith('.jsx') || name.endsWith('.js')) return '🟨';
        if (name.endsWith('.css') || name.endsWith('.scss')) return '🎨';
        if (name.endsWith('.json')) return '📋';
        if (name.endsWith('.md')) return '📄';
        if (name.endsWith('.html')) return '🌐';
        if (name.endsWith('.yaml') || name.endsWith('.yml')) return '⚙️';
        if (name.endsWith('.env')) return '🔒';
        if (name === '.gitignore') return '🚫';
        return '📄';
    };

    const handleRename = async () => {
        if (!renamingNode || !renamingValue.trim()) return;
        try {
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const oldPath = renamingNode;
            const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + renamingValue.trim();

            const res = await fetch('/api/files/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath, newPath, root })
            });
            if (res.ok) fetchTree();
        } catch (err) {
            console.error('Rename failed:', err);
        } finally {
            setRenamingNode(null);
        }
    };

    const handleDelete = async (path: string) => {
        if (!confirm(`Are you sure you want to delete ${path}?`)) return;
        try {
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const res = await fetch(`/api/files/delete?path=${encodeURIComponent(path)}&root=${encodeURIComponent(root)}`, {
                method: 'DELETE'
            });
            if (res.ok) fetchTree();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleCreate = async () => {
        if (!newEntity || !newEntityValue.trim()) return;
        try {
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const entityPath = newEntity.parentPath ? `${newEntity.parentPath}/${newEntityValue.trim()}` : newEntityValue.trim();

            const res = await fetch('/api/files/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: entityPath, type: newEntity.type, root })
            });
            if (res.ok) fetchTree();
        } catch (err) {
            console.error('Create failed:', err);
        } finally {
            setNewEntity(null);
            setNewEntityValue('');
        }
    };

    const handleReveal = async (path: string) => {
        try {
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            await fetch('/api/files/reveal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, root })
            });
        } catch (err) {
            console.error('Reveal failed:', err);
        }
    };

    const handleCopy = (node: FileNode) => {
        setClipboard({ path: node.path, name: node.name });
        setContextMenu(null);
    };

    const handlePaste = async (destDir: string) => {
        if (!clipboard) return;
        try {
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            // Dest is destDir + clipboard.name
            const destPath = destDir === '.' ? clipboard.name : `${destDir}/${clipboard.name}`;

            await fetch('/api/files/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ srcPath: clipboard.path, destPath, root })
            });
            fetchTree();
            setContextMenu(null);
        } catch (err) {
            console.error('Paste failed:', err);
        }
    };

    const handleMove = async (srcPath: string, destDir: string) => {
        if (srcPath === destDir) return;
        try {
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const name = srcPath.split('/').pop() || '';
            const destPath = destDir === '.' ? name : `${destDir}/${name}`;

            if (srcPath === destPath) return;

            await fetch('/api/files/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ srcPath, destPath, root })
            });
            fetchTree();
        } catch (err) {
            console.error('Move failed:', err);
        }
    };

    const renderTree = (nodes: FileNode[], depth: number = 0) => (
        nodes.map((node) => {
            const isExpanded = expandedDirs.has(node.path);
            const isActive = activeTabId?.endsWith(`:${node.path}`);
            const isRenaming = renamingNode === node.path;

            return (
                <div
                    key={node.path}
                    className={`file-tree-node ${dragOverPath === node.path ? 'drag-over' : ''}`}
                    onDragOver={(e) => {
                        if (node.isDir) {
                            e.preventDefault();
                            setDragOverPath(node.path);
                        }
                    }}
                    onDragLeave={() => setDragOverPath(null)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOverPath(null);
                        const data = e.dataTransfer.getData('text/plain');
                        if (data && node.isDir) {
                            handleMove(data, node.path);
                        }
                    }}
                >
                    <div
                        className={`file-tree-item ${isActive ? 'active' : ''}`}
                        style={{ '--depth': depth } as React.CSSProperties}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', node.path);
                        }}
                        onClick={() => {
                            if (node.isDir) toggleDir(node.path);
                            else handleOpenFile(node.path);
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, node });
                        }}
                    >
                        {node.isDir ? (
                            <>
                                {isExpanded ? <ChevronDown size={14} className="tree-chevron" /> : <ChevronRight size={14} className="tree-chevron" />}
                                <Folder size={15} className="file-tree-icon-dir" />
                            </>
                        ) : (
                            <>
                                <span className="tree-spacer" />
                                <span className="file-tree-file-icon">{getFileIcon(node.name)}</span>
                            </>
                        )}
                        {isRenaming ? (
                            <input
                                autoFocus
                                onFocus={e => e.target.select()}
                                className="file-tree-rename-input"
                                value={renamingValue}
                                onChange={e => setRenamingValue(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleRename();
                                    if (e.key === 'Escape') setRenamingNode(null);
                                }}
                            />
                        ) : (
                            <span className="file-tree-item-name">{node.name}</span>
                        )}
                    </div>
                    {node.isDir && isExpanded && (
                        <div className="file-tree-children-expanded">
                            {newEntity && newEntity.parentPath === node.path && (
                                <div className="file-tree-item new-entity" style={{ '--depth': depth + 1 } as React.CSSProperties}>
                                    {newEntity.type === 'dir' ? <Folder size={15} className="file-tree-icon-dir" /> : <span className="file-tree-file-icon">📄</span>}
                                    <input
                                        autoFocus
                                        onFocus={e => e.target.select()}
                                        className="file-tree-rename-input"
                                        value={newEntityValue}
                                        onChange={e => setNewEntityValue(e.target.value)}
                                        onBlur={handleCreate}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleCreate();
                                            if (e.key === 'Escape') setNewEntity(null);
                                        }}
                                        placeholder={`New ${newEntity.type}...`}
                                    />
                                </div>
                            )}
                            {node.children && renderTree(node.children, depth + 1)}
                        </div>
                    )}
                </div>
            );
        })
    );

    return (
        <div className="sidebar-explorer">
            <div className="sidebar-explorer-header">
                <div className="workspace-selector">
                    <Layers size={13} />
                    <select
                        value={activeWorkspaceId || ''}
                        onChange={(e) => setActiveWorkspaceId(e.target.value)}
                        className="workspace-dropdown"
                        title="Select workspace"
                        aria-label="Select workspace"
                    >
                        {workspaces.length === 0 && <option value="">No workspace</option>}
                        {workspaces.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <button className="sidebar-icon-btn" onClick={() => setIsWorkspaceModalOpen(true)} title="Add Workspace">
                        <Plus size={14} />
                    </button>
                    <button className="sidebar-icon-btn" onClick={() => {
                        setNewEntity({ type: 'file', parentPath: '' });
                        setNewEntityValue('');
                    }} title="New File">
                        <FilePlus size={14} />
                    </button>
                    <button className="sidebar-icon-btn" onClick={() => {
                        setNewEntity({ type: 'dir', parentPath: '' });
                        setNewEntityValue('');
                    }} title="New Folder">
                        <FolderPlus size={14} />
                    </button>
                </div>
                <button className="sidebar-icon-btn" onClick={fetchTree} title="Refresh">
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                </button>
            </div>

            {isWorkspaceModalOpen && (
                <div className="modal-overlay" onClick={() => setIsWorkspaceModalOpen(false)}>
                    <div className="card modal-content modal-body" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Add Workspace Folder</h3>
                        <input type="text" aria-label="Workspace Name" className="input-field" placeholder="Workspace Name" value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} />
                        <input type="text" aria-label="Relative Path" className="input-field" placeholder="Relative Path" value={newWorkspacePath} onChange={e => setNewWorkspacePath(e.target.value)} />
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={handleAddWorkspace}>Add</button>
                            <button className="btn btn-ghost" onClick={() => setIsWorkspaceModalOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="sidebar-section-label">EXPLORER</div>
            <div className="file-tree-container">
                {newEntity && newEntity.parentPath === '' && (
                    <div className="file-tree-item new-entity" style={{ '--depth': 0 } as React.CSSProperties}>
                        {newEntity.type === 'dir' ? <Folder size={15} className="file-tree-icon-dir" /> : <span className="file-tree-file-icon">📄</span>}
                        <input
                            autoFocus
                            onFocus={e => e.target.select()}
                            className="file-tree-rename-input"
                            value={newEntityValue}
                            onChange={e => setNewEntityValue(e.target.value)}
                            onBlur={handleCreate}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleCreate();
                                if (e.key === 'Escape') setNewEntity(null);
                            }}
                            placeholder={`New ${newEntity.type}...`}
                        />
                    </div>
                )}
                {renderTree(tree)}
            </div>

            {contextMenu && (
                <div
                    className="file-tree-context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={e => e.stopPropagation()}
                >
                    <button className="context-menu-item" onClick={() => {
                        setRenamingNode(contextMenu.node.path);
                        setRenamingValue(contextMenu.node.name);
                        setContextMenu(null);
                    }}>
                        <Edit2 size={13} /> Rename
                    </button>
                    {contextMenu.node.isDir && (
                        <>
                            <button className="context-menu-item" onClick={() => {
                                setNewEntity({ type: 'file', parentPath: contextMenu.node.path });
                                if (!expandedDirs.has(contextMenu.node.path)) toggleDir(contextMenu.node.path);
                                setContextMenu(null);
                            }}>
                                <FilePlus size={13} /> New File
                            </button>
                            <button className="context-menu-item" onClick={() => {
                                setNewEntity({ type: 'dir', parentPath: contextMenu.node.path });
                                if (!expandedDirs.has(contextMenu.node.path)) toggleDir(contextMenu.node.path);
                                setContextMenu(null);
                            }}>
                                <FolderPlus size={13} /> New Folder
                            </button>
                        </>
                    )}
                    <button className="context-menu-item danger" onClick={() => {
                        handleDelete(contextMenu.node.path);
                        setContextMenu(null);
                    }}>
                        <Trash2 size={13} /> Delete
                    </button>
                    <div className="context-menu-separator" />
                    <button className="context-menu-item" onClick={() => handleCopy(contextMenu.node)}>
                        <Copy size={13} /> Copy
                    </button>
                    <button
                        className="context-menu-item"
                        disabled={!clipboard}
                        onClick={() => {
                            const dest = contextMenu.node.isDir ? contextMenu.node.path : contextMenu.node.path.split('/').slice(0, -1).join('/') || '.';
                            handlePaste(dest);
                        }}
                    >
                        <ClipboardIcon size={13} /> Paste
                    </button>
                    <div className="context-menu-separator" />
                    <button className="context-menu-item" onClick={() => {
                        const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
                        const fullPath = contextMenu.node.path; // Already absolute if root is absolute, but usually relative to root
                        // For full path we'd need to join root and node.path
                        const absolutePath = root.endsWith('/') || root.endsWith('\\') ? root + contextMenu.node.path : root + '/' + contextMenu.node.path;
                        navigator.clipboard.writeText(absolutePath);
                        setContextMenu(null);
                    }}>
                        <Copy size={13} /> Copy Path
                    </button>
                    <button className="context-menu-item" onClick={() => {
                        navigator.clipboard.writeText(contextMenu.node.path);
                        setContextMenu(null);
                    }}>
                        <ClipboardIcon size={13} /> Copy Relative Path
                    </button>
                    <div className="context-menu-separator" />
                    <button className="context-menu-item" onClick={() => {
                        handleReveal(contextMenu.node.path);
                        setContextMenu(null);
                    }}>
                        <ExternalLink size={13} /> Reveal in Explorer
                    </button>
                </div>
            )}
        </div>
    );
}

// ===================== Search Panel =====================

interface SearchPanelProps {
    handleOpenFile: (path: string) => void;
}

function SearchPanel({ handleOpenFile }: SearchPanelProps) {
    const { searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, setIsSearching } = useEditorStore();
    const [replaceValue, setReplaceValue] = useState('');
    const [showReplace, setShowReplace] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery })
            });
            const data = await res.json();
            if (res.ok) {
                setSearchResults(data.results);
            }
        } catch (err) {
            console.error('Search Error:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="sidebar-search">
            <div className="sidebar-section-label">SEARCH</div>
            <div className="search-input-area">
                <div className="search-input-wrap">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                {showReplace && (
                    <div className="search-input-wrap">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Replace..."
                            value={replaceValue}
                            onChange={(e) => setReplaceValue(e.target.value)}
                        />
                    </div>
                )}
                <div className="search-options">
                    <button className={`search-option-btn ${showReplace ? 'active' : ''}`} onClick={() => setShowReplace(!showReplace)} title="Toggle Replace">
                        Aa
                    </button>
                </div>
            </div>

            <div className="search-results">
                {isSearching && <div className="search-loading">Searching...</div>}
                {!isSearching && searchResults.length > 0 && (
                    <>
                        <div className="search-result-count">{searchResults.length} results in {new Set(searchResults.map(r => r.file)).size} files</div>
                        {searchResults.map((result, idx) => (
                            <div
                                key={idx}
                                className="search-result-item"
                                onClick={() => handleOpenFile(result.file)}
                            >
                                <div className="search-result-file">
                                    <FileIcon size={13} />
                                    <span>{result.file}</span>
                                </div>
                                <div className="search-result-line">
                                    <span className="search-line-num">{result.line}</span>
                                    <span className="search-context">{result.context}</span>
                                </div>
                            </div>
                        ))}
                    </>
                )}
                {!isSearching && searchQuery && searchResults.length === 0 && (
                    <div className="search-empty">No results found</div>
                )}
            </div>
        </div>
    );
}

// ===================== Git Panel =====================

interface GitPanelProps {
    handleOpenFile: (path: string) => void;
}

function GitPanel({ handleOpenFile }: GitPanelProps) {
    const { gitChanges, setGitChanges, gitBranch, setGitBranch } = useEditorStore();
    const [loading, setLoading] = useState(false);

    const fetchGitData = useCallback(async () => {
        try {
            setLoading(true);
            const statusRes = await fetch('/api/git/status');
            const statusData = await statusRes.json();
            if (statusRes.ok) setGitChanges(statusData.changes);

            const branchRes = await fetch('/api/git/branch');
            const branchData = await branchRes.json();
            if (branchRes.ok) setGitBranch(branchData.branch);
        } catch (err) {
            console.error('Git Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    }, [setGitChanges, setGitBranch]);

    useEffect(() => {
        fetchGitData();
        const interval = setInterval(fetchGitData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchGitData]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'modified': return <span className="git-badge modified">M</span>;
            case 'added': return <span className="git-badge added">A</span>;
            case 'deleted': return <span className="git-badge deleted">D</span>;
            case 'untracked': return <span className="git-badge untracked">U</span>;
            default: return null;
        }
    };

    const [commitMessage, setCommitMessage] = useState('');

    const handleCommit = async () => {
        if (!commitMessage.trim()) return;
        try {
            setLoading(true);
            const res = await fetch('/api/git/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: commitMessage })
            });
            if (res.ok) {
                setCommitMessage('');
                fetchGitData();
            }
        } catch (err) {
            console.error('Commit Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sidebar-git">
            <div className="sidebar-section-label">SOURCE CONTROL</div>
            <div className="git-branch-info">
                <GitBranch size={14} />
                <span>{gitBranch}</span>
            </div>

            <div className="git-commit-area">
                <input
                    type="text"
                    className="git-commit-input"
                    placeholder="Message (Ctrl+Enter to commit)"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) handleCommit();
                    }}
                />
                <button
                    className="btn btn-primary btn-sm git-commit-btn"
                    onClick={handleCommit}
                    disabled={loading || !commitMessage.trim()}
                >
                    <Check size={13} /> {loading ? '...' : 'Commit'}
                </button>
            </div>

            {gitChanges.length > 0 && (
                <>
                    <div className="sidebar-section-sublabel">
                        Changes ({gitChanges.length})
                    </div>
                    <div className="git-changes-list">
                        {gitChanges.map((change) => (
                            <div
                                key={change.file}
                                className="git-change-item"
                                onClick={() => handleOpenFile(change.file)}
                            >
                                <FileIcon size={13} />
                                <span className="git-change-file">{change.file.split('/').pop()}</span>
                                <span className="git-change-path">{change.file}</span>
                                {getStatusBadge(change.status)}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ===================== Extensions Panel =====================

function ExtensionsPanel() {
    const [extensions, setExtensions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchExtensions = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/extensions');
            const data = await res.json();
            if (res.ok) setExtensions(data.extensions);
        } catch (err) {
            console.error('Extensions Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExtensions();
    }, [fetchExtensions]);

    return (
        <div className="sidebar-extensions">
            <div className="sidebar-section-label">EXTENSIONS</div>
            <div className="extensions-search">
                <Search size={14} />
                <input type="text" aria-label="Search extensions" placeholder="Search extensions..." className="search-input" />
            </div>
            {loading && <div className="p-4 text-xs opacity-50">Loading extensions...</div>}
            <div className="sidebar-section-sublabel">INSTALLED</div>
            <div className="extensions-list">
                {extensions.filter(e => e.installed).map(ext => (
                    <div key={ext.name} className="extension-item">
                        <span className="extension-icon">{ext.icon}</span>
                        <div className="extension-info">
                            <span className="extension-name">{ext.name}</span>
                            <span className="extension-author">{ext.author}</span>
                            <span className="extension-desc">{ext.desc}</span>
                        </div>
                        <span className="extension-installed-badge"><Check size={12} /></span>
                    </div>
                ))}
            </div>
            <div className="sidebar-section-sublabel">RECOMMENDED</div>
            <div className="extensions-list">
                {extensions.filter(e => !e.installed).map(ext => (
                    <div key={ext.name} className="extension-item">
                        <span className="extension-icon">{ext.icon}</span>
                        <div className="extension-info">
                            <span className="extension-name">{ext.name}</span>
                            <span className="extension-author">{ext.author}</span>
                            <span className="extension-desc">{ext.desc}</span>
                        </div>
                        <button className="btn btn-ghost btn-xs extension-install-btn">
                            <Download size={12} /> Install
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ===================== Main Sidebar =====================

export function SidePanel() {
    const { sidebarPanel, sidebarWidth } = useEditorStore();
    const { tabs, setActiveTabId, addTab, activeWorkspaceId, workspaces } = useDashboardStore();

    const handleOpenFile = useCallback(async (path: string) => {
        const tabId = `${activeWorkspaceId || 'default'}:${path}`;
        const existingTab = tabs.find(t => t.id === tabId);

        if (existingTab) {
            setActiveTabId(tabId);
            return;
        }

        try {
            const root = workspaces.find(w => w.id === activeWorkspaceId)?.path || '.';
            const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}&root=${encodeURIComponent(root)}`);
            const data = await res.json();
            if (res.ok) {
                const name = path.split('/').pop() || path;
                addTab({
                    id: tabId, path, workspaceId: activeWorkspaceId || 'default',
                    name, content: data.content, isDirty: false, originalContent: data.content
                });
            }
        } catch (err) {
            console.error('Failed to open file:', err);
        }
    }, [activeWorkspaceId, tabs, setActiveTabId, addTab, workspaces]);

    if (!sidebarPanel) return null;

    return (
        <div className="ide-side-panel" style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
            {sidebarPanel === 'explorer' && <FileExplorer handleOpenFile={handleOpenFile} />}
            {sidebarPanel === 'search' && <SearchPanel handleOpenFile={handleOpenFile} />}
            {sidebarPanel === 'git' && <GitPanel handleOpenFile={handleOpenFile} />}
            {sidebarPanel === 'ai-chat' && <AIChatPanel />}
            {sidebarPanel === 'workflows' && <WorkflowsPanel />}
            {sidebarPanel === 'extensions' && <ExtensionsPanel />}
        </div>
    );
}
