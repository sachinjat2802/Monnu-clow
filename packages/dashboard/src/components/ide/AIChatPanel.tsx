// ============================================================================
// AI Chat Panel — Copilot-style conversational AI assistant
// ============================================================================
/// <reference types="vite/client" />

import React, { useState, useRef, useEffect } from 'react';
import {
    Send, Trash2, Copy, Check, Sparkles, Code, Bug,
    TestTube, RefreshCw, Lightbulb, Wand2, Bot, User,
    ChevronDown, Zap, Play
} from 'lucide-react';
import { useEditorStore, AIChatMessage } from '../../stores/editor';
import { useDashboardStore } from '../../stores/dashboard';

// --- AI Quick Actions ---
const QUICK_ACTIONS = [
    { icon: <Code size={13} />, label: 'Explain Code', prompt: 'Explain the selected code in detail.' },
    { icon: <Wand2 size={13} />, label: 'Refactor', prompt: 'Refactor this code for better readability and performance.' },
    { icon: <Bug size={13} />, label: 'Find Bugs', prompt: 'Find potential bugs and issues in this code.' },
    { icon: <TestTube size={13} />, label: 'Generate Tests', prompt: 'Generate comprehensive unit tests for this code.' },
    { icon: <Lightbulb size={13} />, label: 'Suggest', prompt: 'Suggest improvements and best practices for this code.' },
    { icon: <Zap size={13} />, label: 'Optimize', prompt: 'Optimize this code for better performance.' },
    { icon: <Play size={13} />, label: 'Run Workflow', prompt: 'TRIGGER_WORKFLOW' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function fetchAIResponse(userMessage: string, history: AIChatMessage[]): Promise<string> {
    try {
        const messages = history.map(m => ({
            role: m.role,
            content: m.content
        })).concat([{ role: 'user', content: userMessage }]);

        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to get AI response');
        }

        const data = await res.json();
        return data.response;
    } catch (err: any) {
        console.error('AI Chat Error:', err);
        return `⚠️ Encountered an error: ${err.message}. Please check if the backend server is running and API keys are set.`;
    }
}

// Simple markdown renderer
function renderMarkdown(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeContent = '';
    let codeLang = '';
    let blockKey = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                parts.push(
                    <div key={`code-${blockKey++}`} className="ai-code-block">
                        <div className="ai-code-header">
                            <span>{codeLang || 'code'}</span>
                            <CopyButton text={codeContent.trim()} />
                        </div>
                        <pre><code>{codeContent.trim()}</code></pre>
                    </div>
                );
                codeContent = '';
                codeLang = '';
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
                codeLang = line.slice(3).trim();
            }
        } else if (inCodeBlock) {
            codeContent += line + '\n';
        } else if (line.startsWith('## ')) {
            parts.push(<h3 key={`h-${i}`} className="ai-msg-heading">{line.slice(3)}</h3>);
        } else if (line.startsWith('### ')) {
            parts.push(<h4 key={`h-${i}`} className="ai-msg-subheading">{line.slice(4)}</h4>);
        } else if (line.startsWith('- ')) {
            parts.push(
                <div key={`li-${i}`} className="ai-msg-list-item">
                    <span>•</span>
                    <span dangerouslySetInnerHTML={{
                        __html: line.slice(2)
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/`(.*?)`/g, '<code>$1</code>')
                    }} />
                </div>
            );
        } else if (line.startsWith('✅') || line.startsWith('📊') || line.startsWith('📝')) {
            parts.push(
                <div key={`em-${i}`} className="ai-msg-emphasis" dangerouslySetInnerHTML={{
                    __html: line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`(.*?)`/g, '<code>$1</code>')
                }} />
            );
        } else if (line.trim()) {
            parts.push(
                <p key={`p-${i}`} className="ai-msg-text" dangerouslySetInnerHTML={{
                    __html: line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`(.*?)`/g, '<code>$1</code>')
                }} />
            );
        }
    }

    return <>{parts}</>;
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button className="ai-copy-btn" onClick={handleCopy} title="Copy code">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
        </button>
    );
}

export function AIChatPanel() {
    const {
        chatMessages, addChatMessage, clearChat,
        isAIThinking, setIsAIThinking, selectedText
    } = useEditorStore();
    const { activeTabId, tabs, sendMessage } = useDashboardStore();

    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [chatMessages]);

    const handleSend = async () => {
        if (!input.trim() || isAIThinking) return;

        const userMsg: AIChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input.trim(),
            timestamp: Date.now(),
        };
        addChatMessage(userMsg);
        setInput('');

        // Trigger automated workflow ALWAYS on send button
        sendMessage('workflow:start-automated', { goal: userMsg.content });

        addChatMessage({
            id: `sys-${Date.now()}`,
            role: 'system',
            content: `🚀 **Agentic Workflow Initiated**: Orchestrating Supervisor and parallel agents (3 Coders, 2 Testers) for: "${userMsg.content}". Monitoring supervision.md and live coordination.`,
            timestamp: Date.now(),
        });

        setIsAIThinking(true);
        const response = await fetchAIResponse(userMsg.content, chatMessages);
        const aiMsg: AIChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
        };
        addChatMessage(aiMsg);
        setIsAIThinking(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleQuickAction = (prompt: string) => {
        const activeTab = tabs.find(t => t.id === activeTabId);

        if (prompt === 'TRIGGER_WORKFLOW') {
            const goal = input.trim() || 'General Project Polish & Feature Build';
            sendMessage('workflow:start-automated', { goal });
            addChatMessage({
                id: `sys-${Date.now()}`,
                role: 'system',
                content: `🚀 **Multi-agent loop triggered**: "${goal}". Monitoring real-time coordination now.`,
                timestamp: Date.now(),
            });
            setInput('');
            return;
        }

        // Use selected text if available, otherwise fallback to start of file
        const contextText = selectedText || (activeTab ? activeTab.content.slice(0, 1000) : '');

        const fullPrompt = activeTab
            ? `${prompt}\n\nFile: ${activeTab.path}\n\nContext:\n\`\`\`\n${contextText}\n\`\`\``
            : `${prompt}\n\n(No active file context)`;

        setIsAIThinking(true);

        // Add to UI as just the prompt name, but send the full context to AI
        const displayMsg: AIChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: `✨ ${prompt} (Selected Code)`,
            timestamp: Date.now(),
        };
        addChatMessage(displayMsg);

        setTimeout(async () => {
            const response = await fetchAIResponse(fullPrompt, chatMessages);
            addChatMessage({
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: response,
                timestamp: Date.now(),
            });
            setIsAIThinking(false);
        }, 500);
    };

    return (
        <div className="ai-chat-panel">
            <div className="ai-chat-header">
                <div className="ai-chat-header-title">
                    <Sparkles size={16} className="ai-sparkle-icon" />
                    <span>AI Copilot</span>
                    <span className="ai-chat-badge">BETA</span>
                </div>
                <button
                    className="btn btn-ghost btn-xs"
                    onClick={clearChat}
                    title="Clear conversation"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Quick Actions */}
            <div className="ai-quick-actions">
                {QUICK_ACTIONS.map((action) => (
                    <button
                        key={action.label}
                        className="ai-quick-action-btn"
                        onClick={() => handleQuickAction(action.prompt)}
                        disabled={isAIThinking}
                    >
                        {action.icon}
                        <span>{action.label}</span>
                    </button>
                ))}
            </div>

            {/* Messages */}
            <div className="ai-chat-messages">
                {chatMessages.map((msg) => (
                    <div key={msg.id} className={`ai-chat-msg ${msg.role}`}>
                        <div className="ai-chat-msg-avatar">
                            {msg.role === 'user' ? (
                                <User size={14} />
                            ) : msg.role === 'assistant' ? (
                                <Bot size={14} />
                            ) : (
                                <Sparkles size={14} />
                            )}
                        </div>
                        <div className="ai-chat-msg-body">
                            <div className="ai-chat-msg-header">
                                <span className="ai-chat-msg-author">
                                    {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Copilot' : 'System'}
                                </span>
                                <span className="ai-chat-msg-time">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="ai-chat-msg-content">
                                {renderMarkdown(msg.content)}
                            </div>
                        </div>
                    </div>
                ))}

                {isAIThinking && (
                    <div className="ai-chat-msg assistant">
                        <div className="ai-chat-msg-avatar">
                            <Bot size={14} />
                        </div>
                        <div className="ai-chat-msg-body">
                            <div className="ai-thinking-indicator">
                                <div className="ai-thinking-dots">
                                    <span /><span /><span />
                                </div>
                                <span>Copilot is thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="ai-chat-input-area">
                <div className="ai-chat-input-wrap">
                    <textarea
                        ref={inputRef}
                        className="ai-chat-input"
                        placeholder="Ask Copilot anything... (Enter to send, Shift+Enter for new line)"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        disabled={isAIThinking}
                    />
                    <button
                        className="ai-send-btn"
                        onClick={handleSend}
                        disabled={!input.trim() || isAIThinking}
                        title="Send message"
                    >
                        <Send size={16} />
                    </button>
                </div>
                <div className="ai-chat-input-hint">
                    <span>Shift+Enter for new line</span>
                    <span>Powered by Monnu Clow AI</span>
                </div>
            </div>
        </div>
    );
}
