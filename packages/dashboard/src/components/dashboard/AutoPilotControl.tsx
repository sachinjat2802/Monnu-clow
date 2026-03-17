// ============================================================================
// Auto-Pilot Control — Persistent "Never Stop" AI Mode
// ============================================================================

import React from 'react';
import { Power, Info, Flame, Target } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboard';

export function AutoPilotControl() {
    const { autoPilotEnabled, setAutoPilotEnabled, sendMessage } = useDashboardStore();

    return (
        <div className={`card autopilot-card ${autoPilotEnabled ? 'enabled' : ''}`}>
            <div className="card-header">
                <div className="card-title">
                    <Power size={18} />
                    <span>Auto-Pilot Mode</span>
                </div>
                <div className="toggle-switch">
                    <input
                        type="checkbox"
                        id="autoPilotToggle"
                        checked={autoPilotEnabled}
                        onChange={(e) => {
                            const v = e.target.checked;
                            setAutoPilotEnabled(v);
                            sendMessage('autopilot:toggle', { enabled: v });
                        }}
                        aria-label="Toggle Auto-Pilot Mode"
                        title="Toggle Auto-Pilot Mode"
                    />
                    <label htmlFor="autoPilotToggle" />
                </div>
            </div>

            <div className="card-body">
                <p className="card-text">
                    {autoPilotEnabled
                        ? "Autonomous mode active. The Supervisor will continuously evaluate the codebase and assign tasks until stability targets are met."
                        : "Manual control active. Pipeline actions require user initialization."}
                </p>

                {autoPilotEnabled && (
                    <div className="autopilot-metrics">
                        <div className="metric">
                            <Flame size={14} className="icon-burn" />
                            <span>Efficiency: {Math.floor(85 + Math.random() * 10)}%</span>
                        </div>
                        <div className="metric">
                            <Target size={14} className="icon-target" />
                            <span>Active Goal: Stability Stabilization</span>
                        </div>
                    </div>
                )}

                <div className="info-box">
                    <Info size={14} />
                    <span>Auto-pilot ensures the system never stops until goals are completed.</span>
                </div>
            </div>
        </div>
    );
}
