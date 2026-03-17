// ============================================================================
// Monnu Clow — WebSocket Hook
// Connects dashboard to server and dispatches events to Zustand store
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '../stores/dashboard';
import { useEditorStore } from '../stores/editor';

const WS_URL = `ws://${window.location.hostname}:3001/ws`;
const RECONNECT_DELAY = 3000;

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        setConnected,
        setPipeline,
        setIsRunning,
        updateAgent,
        setStability,
        addActivity,
        addTask,
        updateTask,
        addBug,
        updateBug,
        updateTab,
        addHistoricalTask,
    } = useDashboardStore();

    const handleHistoryEvent = useCallback((event: Record<string, unknown>) => {
        // Simplified handler for replaying history
        if (event.type === 'agent:status') {
            const data = event.data as { role: string; status: string; message: string };
            updateAgent(
                data.role as any,
                data.status as any,
                data.message
            );
        }
    }, [updateAgent]);

    const handleMessage = useCallback(
        (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);

                // Create activity item for most events
                const createActivity = (
                    level: 'info' | 'warn' | 'error' | 'success',
                    source: string,
                    message: string
                ) => {
                    addActivity({
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        type: data.type,
                        timestamp: data.timestamp,
                        source,
                        message,
                        level,
                    });
                };

                switch (data.type) {
                    // Init event on connection
                    case 'init':
                        setPipeline(data.data.state);
                        setIsRunning(data.data.isRunning);
                        // Replay history events
                        if (data.data.history) {
                            for (const histEvent of data.data.history.slice(-50)) {
                                handleHistoryEvent(histEvent);
                            }
                        }
                        break;

                    // Agent status updates
                    case 'agent:status':
                        updateAgent(
                            data.data.role,
                            data.data.status,
                            data.data.message
                        );
                        createActivity(
                            data.data.status === 'failed' ? 'error' :
                                data.data.status === 'completed' ? 'success' : 'info',
                            data.data.role,
                            data.data.message
                        );
                        break;

                    case 'agent:iteration':
                        // Specifically for multi-agent loops
                        const { incrementIteration } = useDashboardStore.getState();
                        incrementIteration(data.data.role);
                        createActivity('info', data.data.role, `Iteration ${data.data.iteration} complete`);
                        break;

                    // Agent actions
                    case 'agent:action':
                        createActivity(
                            data.data.result === 'failure' ? 'error' :
                                data.data.result === 'success' ? 'success' : 'info',
                            data.data.agentRole,
                            `${data.data.action}: ${data.data.detail}`
                        );
                        break;

                    // Pipeline events
                    case 'pipeline:phase-change':
                    case 'pipeline:iteration':
                    case 'pipeline:complete':
                        setPipeline(data.data);
                        if (data.type === 'pipeline:complete') {
                            setIsRunning(false);
                        }
                        break;

                    // Task events
                    case 'task:created':
                        addTask({
                            id: data.data.id,
                            title: data.data.title,
                            status: data.data.status,
                            assignedAgent: data.data.assignedAgent,
                            priority: data.data.priority,
                        });
                        break;

                    case 'task:completed':
                    case 'task:failed':
                    case 'task:updated':
                        updateTask(data.data.id, {
                            status: data.data.status,
                            assignedAgent: data.data.assignedAgent,
                        });

                        // Populate history for calendar if it's a final state
                        if (data.type === 'task:completed' || data.type === 'task:failed') {
                            addHistoricalTask({
                                id: data.data.id,
                                title: data.data.title || `Task ${data.data.id}`,
                                completedAt: Date.now(),
                                agent: data.data.assignedAgent || 'planner',
                                outcome: data.type === 'task:completed' ? 'success' : 'failure',
                            });
                        }
                        break;

                    // Bug events
                    case 'bug:detected':
                        addBug({
                            id: data.data.id,
                            file: data.data.file,
                            description: data.data.description,
                            severity: data.data.severity,
                            status: data.data.status,
                        });
                        break;

                    case 'bug:fixed':
                    case 'bug:investigating':
                    case 'bug:verified':
                        updateBug(data.data.id, {
                            status: data.data.status,
                        });
                        break;

                    case 'workflow:task-update':
                        const { setCurrentTask } = useDashboardStore.getState();
                        setCurrentTask(data.data);
                        break;

                    case 'file:patch':
                        const { tabs: openTabs, addTab: addEditorTab, updateTab: updateEditorTab, setActiveTabId: setEditorActiveTab } = useDashboardStore.getState();
                        const matchingTab = openTabs.find(t => t.path === data.data.path);
                        if (matchingTab) {
                            updateEditorTab(matchingTab.id, {
                                content: data.data.content,
                                isDirty: true
                            });
                            // Auto-switch to the file being changed so user sees it live
                            setEditorActiveTab(matchingTab.id);
                        } else {
                            // Auto-open the file being changed so it's "live"
                            const newTabId = `default:${data.data.path}`;
                            addEditorTab({
                                id: newTabId,
                                path: data.data.path,
                                workspaceId: 'default',
                                name: data.data.path.split('/').pop() || data.data.path,
                                content: data.data.content,
                                isDirty: true,
                                originalContent: data.data.content
                            });
                            setEditorActiveTab(newTabId);
                        }
                        break;

                    // Stability reports
                    case 'stability:report':
                        setStability(data.data);
                        break;

                    // Log events
                    case 'log:info':
                    case 'log:warn':
                    case 'log:error':
                    case 'log:success':
                        createActivity(
                            data.type.split(':')[1] as 'info' | 'warn' | 'error' | 'success',
                            data.data.source,
                            data.data.message
                        );

                        // Add to Copilot Chat
                        const { addChatMessage } = useEditorStore.getState();
                        addChatMessage({
                            id: `log-${Date.now()}-${Math.random()}`,
                            role: 'system',
                            content: `⚡ **${data.data.source}**: ${data.data.message}`,
                            timestamp: Date.now()
                        });
                        break;
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        },
        [
            setPipeline,
            setIsRunning,
            updateAgent,
            setStability,
            addActivity,
            addTask,
            updateTask,
            addBug,
            updateBug,
            updateTab,
            addHistoricalTask,
        ]
    );


    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('Connected to Monnu Clow server');
            setConnected(true);
        };

        ws.onmessage = handleMessage;

        ws.onclose = () => {
            console.log('Disconnected from server');
            setConnected(false);
            // Auto-reconnect
            reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
        };

        ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };

        wsRef.current = ws;
    }, [handleMessage, setConnected]);

    const sendMessage = useCallback((action: string, data?: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action, data }));
        }
    }, []);

    const { setSendMessage } = useDashboardStore();

    useEffect(() => {
        setSendMessage(sendMessage);
    }, [sendMessage, setSendMessage]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            wsRef.current?.close();
        };
    }, [connect]);

    return { sendMessage };
}
