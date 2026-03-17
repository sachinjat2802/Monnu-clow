// ============================================================================
// Main IDE Component — Root VS Code layout
// ============================================================================

import React, { useEffect, useRef } from 'react';
import { ActivityBar } from './ActivityBar';
import { SidePanel } from './SidePanel';
import { EditorArea } from './EditorArea';
import { BottomPanel } from './BottomPanel';
import { StatusBar } from './StatusBar';
import { CommandPalette } from './CommandPalette';
import { useEditorStore } from '../../stores/editor';

export function IDE({ onRunTask, onBackToDashboard }: { onRunTask: (task: string) => void, onBackToDashboard?: () => void }) {
    const { sidebarPanel, sidebarWidth, setSidebarWidth } = useEditorStore();
    const [isResizingSidebar, setIsResizingSidebar] = React.useState(false);

    // Sidebar Resize Logic
    useEffect(() => {
        if (!isResizingSidebar) return;

        const handleMouseMove = (e: MouseEvent) => {
            // Activity bar is 48px wide, min sidebar width 150px, max 800px
            const newWidth = Math.max(150, Math.min(800, e.clientX - 48));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => setIsResizingSidebar(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingSidebar, setSidebarWidth]);

    return (
        <div className="ide-layout">
            <div className="ide-main-row">
                <ActivityBar onBackToDashboard={onBackToDashboard} />

                <div className={`ide-sidebar-container ${!sidebarPanel ? 'hidden' : ''}`} style={{
                    width: sidebarWidth,
                    minWidth: sidebarWidth
                }}>
                    <SidePanel />
                </div>

                {/* Resize Handle for Sidebar */}
                {sidebarPanel && (
                    <div
                        className="ide-resize-handle-v"
                        onMouseDown={() => setIsResizingSidebar(true)}
                    />
                )}

                <div className="ide-editor-column">
                    <EditorArea onRunTask={onRunTask} />
                    <BottomPanel />
                </div>
            </div>

            <StatusBar />
            <CommandPalette />
        </div>
    );
}
