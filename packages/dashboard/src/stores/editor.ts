// ============================================================================
// Monnu Clow IDE — Editor Store
// State management for the VS Code-like IDE interface
// ============================================================================

import { create } from 'zustand';

export type SidebarPanel = 'explorer' | 'search' | 'git' | 'ai-chat' | 'workflows' | 'extensions' | null;
export type BottomPanel = 'terminal' | 'output' | 'problems' | 'ai-suggestions' | null;

export interface AIChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    codeBlock?: string;
    language?: string;
}

export interface AIInlineSuggestion {
    line: number;
    column: number;
    text: string;
    displayText: string;
}

export interface TerminalLine {
    id: string;
    content: string;
    type: 'input' | 'output' | 'error' | 'info';
    timestamp: number;
}

export interface SearchResult {
    file: string;
    line: number;
    column: number;
    match: string;
    context: string;
}

export interface Problem {
    id: string;
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    source: string;
}

export interface CommandItem {
    id: string;
    label: string;
    description?: string;
    shortcut?: string;
    category?: string;
    icon?: string;
    action: () => void;
}

export interface GitChange {
    file: string;
    status: 'modified' | 'added' | 'deleted' | 'untracked';
}

interface EditorStore {
    // Sidebar
    sidebarPanel: SidebarPanel;
    setSidebarPanel: (panel: SidebarPanel) => void;
    sidebarWidth: number;
    setSidebarWidth: (w: number) => void;

    // Bottom panel
    bottomPanel: BottomPanel;
    setBottomPanel: (panel: BottomPanel) => void;
    bottomPanelHeight: number;
    setBottomPanelHeight: (h: number) => void;

    // Command Palette
    commandPaletteOpen: boolean;
    setCommandPaletteOpen: (open: boolean) => void;

    // AI Chat
    chatMessages: AIChatMessage[];
    addChatMessage: (msg: AIChatMessage) => void;
    clearChat: () => void;
    isAIThinking: boolean;
    setIsAIThinking: (v: boolean) => void;

    // AI Inline Suggestions
    inlineSuggestion: AIInlineSuggestion | null;
    setInlineSuggestion: (s: AIInlineSuggestion | null) => void;

    // Terminal
    terminalLines: TerminalLine[];
    addTerminalLine: (line: TerminalLine) => void;
    clearTerminal: () => void;
    terminalHistory: string[];
    addTerminalHistory: (cmd: string) => void;

    // Search
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    searchResults: SearchResult[];
    setSearchResults: (r: SearchResult[]) => void;
    isSearching: boolean;
    setIsSearching: (v: boolean) => void;

    // Problems
    problems: Problem[];
    addProblem: (p: Problem) => void;
    clearProblems: () => void;

    // Git
    gitChanges: GitChange[];
    setGitChanges: (c: GitChange[]) => void;
    gitBranch: string;
    setGitBranch: (b: string) => void;

    // Editor state
    cursorPosition: { line: number; column: number };
    setCursorPosition: (pos: { line: number; column: number }) => void;
    showMinimap: boolean;
    toggleMinimap: () => void;
    wordWrap: boolean;
    toggleWordWrap: () => void;
    fontSize: number;
    setFontSize: (size: number) => void;
    selectedText: string;
    setSelectedText: (text: string) => void;

    // Notifications
    notifications: { id: string; message: string; type: 'info' | 'warning' | 'error' | 'success'; timestamp: number }[];
    addNotification: (msg: string, type: 'info' | 'warning' | 'error' | 'success') => void;
    removeNotification: (id: string) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
    // Sidebar
    sidebarPanel: 'explorer',
    setSidebarPanel: (panel) => set((state) => ({
        sidebarPanel: state.sidebarPanel === panel ? null : panel
    })),
    sidebarWidth: 280,
    setSidebarWidth: (w) => set({ sidebarWidth: w }),

    // Bottom panel
    bottomPanel: 'terminal',
    setBottomPanel: (panel) => set((state) => ({
        bottomPanel: state.bottomPanel === panel ? null : panel
    })),
    bottomPanelHeight: 220,
    setBottomPanelHeight: (h) => set({ bottomPanelHeight: h }),

    // Command Palette
    commandPaletteOpen: false,
    setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

    // AI Chat
    chatMessages: [{
        id: 'welcome',
        role: 'system',
        content: '👋 Welcome to **Monnu Clow AI Copilot**! I can help you write code, explain concepts, debug issues, generate tests, and more. Just ask me anything!',
        timestamp: Date.now(),
    }],
    addChatMessage: (msg) =>
        set((state) => ({
            chatMessages: [...state.chatMessages, msg],
        })),
    clearChat: () =>
        set({
            chatMessages: [{
                id: 'welcome',
                role: 'system',
                content: '👋 Chat cleared! How can I help you?',
                timestamp: Date.now(),
            }],
        }),
    isAIThinking: false,
    setIsAIThinking: (v) => set({ isAIThinking: v }),

    // AI Inline
    inlineSuggestion: null,
    setInlineSuggestion: (s) => set({ inlineSuggestion: s }),

    // Terminal
    terminalLines: [
        { id: 'welcome', content: 'Monnu Clow IDE Terminal v1.0.0', type: 'info', timestamp: Date.now() },
        { id: 'prompt', content: 'Type a command and press Enter...', type: 'info', timestamp: Date.now() },
    ],
    addTerminalLine: (line) =>
        set((state) => ({
            terminalLines: [...state.terminalLines, line].slice(-500),
        })),
    clearTerminal: () =>
        set({
            terminalLines: [
                { id: `cleared-${Date.now()}`, content: 'Terminal cleared.', type: 'info', timestamp: Date.now() },
            ],
        }),
    terminalHistory: [],
    addTerminalHistory: (cmd) =>
        set((state) => ({
            terminalHistory: [...state.terminalHistory, cmd].slice(-100),
        })),

    // Search
    searchQuery: '',
    setSearchQuery: (q) => set({ searchQuery: q }),
    searchResults: [],
    setSearchResults: (r) => set({ searchResults: r }),
    isSearching: false,
    setIsSearching: (v) => set({ isSearching: v }),

    // Problems
    problems: [],
    addProblem: (p) =>
        set((state) => ({
            problems: [...state.problems.filter((x) => x.id !== p.id), p],
        })),
    clearProblems: () => set({ problems: [] }),

    // Git
    gitChanges: [],
    setGitChanges: (c) => set({ gitChanges: c }),
    gitBranch: 'main',
    setGitBranch: (b) => set({ gitBranch: b }),

    // Editor state
    cursorPosition: { line: 1, column: 1 },
    setCursorPosition: (pos) => set({ cursorPosition: pos }),
    showMinimap: true,
    toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
    wordWrap: true,
    toggleWordWrap: () => set((state) => ({ wordWrap: !state.wordWrap })),
    fontSize: 14,
    setFontSize: (size) => set({ fontSize: Math.max(10, Math.min(24, size)) }),
    selectedText: '',
    setSelectedText: (text) => set({ selectedText: text }),

    // Notifications
    notifications: [],
    addNotification: (message, type) => {
        const id = `notif-${Date.now()}`;
        set((state) => ({
            notifications: [...state.notifications, { id, message, type, timestamp: Date.now() }],
        }));
        // Auto-remove after 5 seconds
        setTimeout(() => {
            set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id),
            }));
        }, 5000);
    },
    removeNotification: (id) =>
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        })),
}));
