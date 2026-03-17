// ============================================================================
// Command Palette — VS Code Ctrl+Shift+P overlay
// ============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Search, FileText, Settings, Play, Trash2, RotateCcw,
    Terminal, Bot, GitBranch, ChevronRight, Sparkles,
    Palette, Type, WrapText, Map as MapIcon, Sun, Moon
} from 'lucide-react';
import { useEditorStore, CommandItem } from '../../stores/editor';
import { useDashboardStore } from '../../stores/dashboard';

export function CommandPalette() {
    const { commandPaletteOpen, setCommandPaletteOpen, setSidebarPanel, setBottomPanel,
        toggleMinimap, toggleWordWrap, setFontSize, fontSize, clearTerminal,
        clearChat, addNotification, showMinimap, wordWrap } = useEditorStore();
    const { tabs, activeTabId, setActiveTabId } = useDashboardStore();

    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const commands: CommandItem[] = useMemo(() => [
        {
            id: 'open-file',
            label: 'Go to File...',
            description: 'Quick open a file by name',
            shortcut: 'Ctrl+P',
            category: 'File',
            icon: '📄',
            action: () => setSidebarPanel('explorer')
        },
        {
            id: 'toggle-terminal',
            label: 'Toggle Terminal',
            shortcut: 'Ctrl+`',
            category: 'View',
            icon: '💻',
            action: () => setBottomPanel('terminal')
        },
        {
            id: 'toggle-ai-chat',
            label: 'Open AI Copilot Chat',
            shortcut: 'Ctrl+Shift+I',
            category: 'AI',
            icon: '🤖',
            action: () => setSidebarPanel('ai-chat')
        },
        {
            id: 'ai-explain',
            label: 'AI: Explain Code',
            category: 'AI',
            icon: '🧠',
            action: () => {
                setSidebarPanel('ai-chat');
                addNotification('AI Copilot: Analyzing selected code...', 'info');
            }
        },
        {
            id: 'ai-refactor',
            label: 'AI: Refactor Selection',
            category: 'AI',
            icon: '✨',
            action: () => {
                setSidebarPanel('ai-chat');
                addNotification('AI Copilot: Refactoring...', 'info');
            }
        },
        {
            id: 'ai-generate-tests',
            label: 'AI: Generate Tests',
            category: 'AI',
            icon: '🧪',
            action: () => {
                setSidebarPanel('ai-chat');
                addNotification('AI Copilot: Generating unit tests...', 'info');
            }
        },
        {
            id: 'ai-fix-bugs',
            label: 'AI: Find & Fix Bugs',
            category: 'AI',
            icon: '🔧',
            action: () => {
                setSidebarPanel('ai-chat');
                addNotification('AI Copilot: Scanning for bugs...', 'info');
            }
        },
        {
            id: 'toggle-minimap',
            label: `${showMinimap ? 'Hide' : 'Show'} Minimap`,
            category: 'View',
            icon: '🗺️',
            action: () => toggleMinimap()
        },
        {
            id: 'toggle-wordwrap',
            label: `${wordWrap ? 'Disable' : 'Enable'} Word Wrap`,
            shortcut: 'Alt+Z',
            category: 'View',
            icon: '↩️',
            action: () => toggleWordWrap()
        },
        {
            id: 'increase-font',
            label: 'Increase Font Size',
            shortcut: 'Ctrl+=',
            category: 'View',
            icon: '🔠',
            action: () => setFontSize(fontSize + 1)
        },
        {
            id: 'decrease-font',
            label: 'Decrease Font Size',
            shortcut: 'Ctrl+-',
            category: 'View',
            icon: '🔡',
            action: () => setFontSize(fontSize - 1)
        },
        {
            id: 'clear-terminal',
            label: 'Clear Terminal',
            category: 'Terminal',
            icon: '🧹',
            action: () => clearTerminal()
        },
        {
            id: 'clear-chat',
            label: 'Clear AI Chat History',
            category: 'AI',
            icon: '🗑️',
            action: () => clearChat()
        },
        {
            id: 'show-problems',
            label: 'Show Problems Panel',
            shortcut: 'Ctrl+Shift+M',
            category: 'View',
            icon: '⚠️',
            action: () => setBottomPanel('problems')
        },
        {
            id: 'show-output',
            label: 'Show Output Panel',
            category: 'View',
            icon: '📤',
            action: () => setBottomPanel('output')
        },
        {
            id: 'show-explorer',
            label: 'Show File Explorer',
            shortcut: 'Ctrl+Shift+E',
            category: 'View',
            icon: '📁',
            action: () => setSidebarPanel('explorer')
        },
        {
            id: 'show-search',
            label: 'Search in Files',
            shortcut: 'Ctrl+Shift+F',
            category: 'Search',
            icon: '🔍',
            action: () => setSidebarPanel('search')
        },
        {
            id: 'show-git',
            label: 'Show Source Control',
            shortcut: 'Ctrl+Shift+G',
            category: 'Git',
            icon: '🌲',
            action: () => setSidebarPanel('git')
        },
        // Add open tabs as go-to options
        ...tabs.map(tab => ({
            id: `goto-${tab.id}`,
            label: tab.name,
            description: tab.path,
            category: 'Open Files',
            icon: '📄',
            action: () => setActiveTabId(tab.id)
        }))
    ], [tabs, showMinimap, wordWrap, fontSize, setSidebarPanel, setBottomPanel,
        toggleMinimap, toggleWordWrap, setFontSize, clearTerminal, clearChat,
        addNotification, setActiveTabId]);

    const filtered = useMemo(() => {
        if (!query.trim()) return commands;
        const q = query.toLowerCase();
        return commands.filter(c =>
            c.label.toLowerCase().includes(q) ||
            c.category?.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q)
        );
    }, [query, commands]);

    useEffect(() => {
        if (commandPaletteOpen && inputRef.current) {
            inputRef.current.focus();
            setQuery('');
            setSelectedIndex(0);
        }
    }, [commandPaletteOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Scroll the selected item into view
    useEffect(() => {
        if (listRef.current) {
            const el = listRef.current.children[selectedIndex] as HTMLElement;
            if (el) el.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const executeCommand = useCallback((cmd: CommandItem) => {
        cmd.action();
        setCommandPaletteOpen(false);
    }, [setCommandPaletteOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && filtered[selectedIndex]) {
            executeCommand(filtered[selectedIndex]);
        } else if (e.key === 'Escape') {
            setCommandPaletteOpen(false);
        }
    };

    // Global keyboard shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                setCommandPaletteOpen(!commandPaletteOpen);
            }
            if (e.key === 'Escape' && commandPaletteOpen) {
                setCommandPaletteOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [commandPaletteOpen, setCommandPaletteOpen]);

    if (!commandPaletteOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={() => setCommandPaletteOpen(false)}>
            <div className="command-palette" onClick={(e) => e.stopPropagation()}>
                <div className="command-palette-input-wrap">
                    <Sparkles size={16} className="command-palette-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-palette-input"
                        placeholder="Type a command or search..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <kbd className="command-palette-shortcut-hint">ESC</kbd>
                </div>
                <div className="command-palette-list" ref={listRef}>
                    {filtered.length === 0 ? (
                        <div className="command-palette-empty">
                            No matching commands found
                        </div>
                    ) : (
                        filtered.map((cmd, idx) => (
                            <div
                                key={cmd.id}
                                className={`command-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                                onClick={() => executeCommand(cmd)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                            >
                                <span className="command-palette-item-icon">{cmd.icon}</span>
                                <div className="command-palette-item-content">
                                    <span className="command-palette-item-label">{cmd.label}</span>
                                    {cmd.description && (
                                        <span className="command-palette-item-desc">{cmd.description}</span>
                                    )}
                                </div>
                                {cmd.category && (
                                    <span className="command-palette-item-category">{cmd.category}</span>
                                )}
                                {cmd.shortcut && (
                                    <kbd className="command-palette-item-shortcut">{cmd.shortcut}</kbd>
                                )}
                            </div>
                        ))
                    )}
                </div>
                <div className="command-palette-footer">
                    <span>⬆⬇ Navigate</span>
                    <span>↵ Select</span>
                    <span>ESC Close</span>
                </div>
            </div>
        </div>
    );
}
