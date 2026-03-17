// ============================================================================
// Task Calendar — Date-wise filtering for completed tasks
// ============================================================================

import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboard';

export function TaskCalendar() {
    const { calendarDate, setCalendarDate, historicalTasks } = useDashboardStore();

    // Simple calendar logic
    const today = new Date();
    const [viewDate, setViewDate] = React.useState(new Date(calendarDate));

    const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

    const renderDays = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const days = daysInMonth(month, year);

        const dayElements = [];
        for (let i = 0; i < firstDay; i++) {
            dayElements.push(<div key={`empty-${i}`} className="calendar-day empty" />);
        }

        for (let d = 1; d <= days; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = calendarDate === dateStr;
            const isToday = today.toISOString().split('T')[0] === dateStr;
            const hasTasks = historicalTasks.some(t => new Date(t.completedAt).toISOString().split('T')[0] === dateStr);

            dayElements.push(
                <div
                    key={dateStr}
                    className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''}`}
                    onClick={() => setCalendarDate(dateStr)}
                >
                    {d}
                    {hasTasks && <div className="task-dot" />}
                </div>
            );
        }

        return dayElements;
    };

    const changeMonth = (offset: number) => {
        const next = new Date(viewDate);
        next.setMonth(next.getMonth() + offset);
        setViewDate(next);
    };

    return (
        <div className="card calendar-card">
            <div className="card-header">
                <div className="card-title">
                    <CalendarIcon size={18} />
                    <span>Productivity Calendar</span>
                </div>
                <div className="calendar-nav">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="btn-icon"
                        title="Previous Month"
                        aria-label="Previous Month"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="current-month">
                        {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        onClick={() => changeMonth(1)}
                        className="btn-icon"
                        title="Next Month"
                        aria-label="Next Month"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
            <div className="calendar-grid">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <div key={day} className="calendar-weekday">{day}</div>
                ))}
                {renderDays()}
            </div>
            <div className="calendar-footer">
                <div className="legend">
                    <div className="legend-item"><span className="dot dot-task" /> Tasks</div>
                    <div className="legend-item"><span className="dot dot-today" /> Today</div>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={() => setCalendarDate(today.toISOString().split('T')[0])}>
                    Reset to Today
                </button>
            </div>
        </div>
    );
}
