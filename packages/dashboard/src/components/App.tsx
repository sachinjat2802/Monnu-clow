// ============================================================================
// Monnu Clow — Root App Component
// ============================================================================

import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { IDE } from './ide/IDE';
import { useDashboardStore } from '../stores/dashboard';

export function App() {
    // Initialize WebSocket connection
    const { sendMessage } = useWebSocket();
    const { isRunning } = useDashboardStore();

    const handleStart = () => sendMessage('start');

    return (
        <IDE
            onRunTask={(task) => handleStart()}
        />
    );
}
