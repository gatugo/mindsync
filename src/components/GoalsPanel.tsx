
'use client';

import { useState } from 'react';
import { Goal } from '@/types';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';

interface GoalsPanelProps {
    goals: Goal[];
    onAddGoal: (title: string, targetDate: string, startTime?: string) => void;
    onEditGoal: (goalId: string, title: string, targetDate: string, startTime?: string) => void;
    onToggleGoal: (goalId: string) => void;
    onDeleteGoal: (goalId: string) => void;
    onClose: () => void;
}

export default function GoalsPanel({
    goals,
    onAddGoal,
    onEditGoal,
    onToggleGoal,
    onDeleteGoal,
    onClose,
}: GoalsPanelProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTitle.trim() && newDate) {
            onAddGoal(newTitle.trim(), newDate, newTime || undefined);
            setNewTitle('');
            setNewDate('');
            setNewTime('');
            setIsAdding(false);
        }
    };

    const startEditing = (goal: Goal) => {
        setEditingId(goal.id);
        setEditTitle(goal.title);
        setEditDate(goal.targetDate);
        setEditTime(goal.startTime || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditTitle('');
        setEditDate('');
        setEditTime('');
    };

    const saveEdit = () => {
        if (editingId && editTitle.trim() && editDate) {
            onEditGoal(editingId, editTitle.trim(), editDate, editTime || undefined);
            cancelEditing();
        }
    };

    const activeGoals = goals.filter((g) => !g.completed);
    const completedGoals = goals.filter((g) => g.completed);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatTime = (timeStr: string) => {
        if (!timeStr) return '';
        try {
            const [hours, minutes] = timeStr.split(':');
            const hour = parseInt(hours);
            if (isNaN(hour)) return timeStr;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
        } catch (e) {
            return timeStr;
        }
    };

    return (
        <div className="bg-white/90 dark:bg-slate-900/40 backdrop-blur-2xl rounded-2xl border border-indigo-500/50 p-4 sm:p-6 flex flex-col max-h-[50vh] shadow-[0_0_40px_-15px_rgba(99,102,241,0.3)] animate-in slide-in-from-top-5 fade-in duration-300 ease-out flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/10">
                        <span className="material-icons-round text-white text-xl">gps_fixed</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold dark:text-white text-slate-900 tracking-tight">Goals</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{activeGoals.length} Active Targets</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isAdding ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 rotate-45' : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-600'}`}
                        title={isAdding ? "Close form" : "Add new goal"}
                    >
                        <span className="material-icons-round text-xl">add</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
                        title="Close Panel"
                    >
                        <span className="material-icons-round text-xl">expand_less</span>
                    </button>
                </div>
            </div>

            {/* Add Goal Form */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="mb-6 p-5 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-2xl border border-indigo-500/20 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="relative">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-sm">edit</span>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="What is your goal?"
                            className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <DatePicker
                            value={newDate}
                            onChange={setNewDate}
                            placeholder="Date"
                        />
                        <TimePicker
                            value={newTime}
                            onChange={setNewTime}
                            placeholder="Time"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!newTitle.trim() || !newDate}
                            className="flex-[2] py-3 rounded-xl bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:shadow-none"
                        >
                            Start Journey
                        </button>
                    </div>
                </form>
            )}

            {/* Goals List */}
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1 pb-2">
                {activeGoals.map((goal) => (
                    <div key={goal.id}>
                        {editingId === goal.id ? (
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-indigo-500/30 space-y-3">
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                />
                                <div className="flex gap-2">
                                    <DatePicker
                                        value={editDate}
                                        onChange={setEditDate}
                                    />
                                    <TimePicker
                                        value={editTime}
                                        onChange={setEditTime}
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={cancelEditing} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                                    <button onClick={saveEdit} className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-500 text-white shadow-md shadow-indigo-500/20">Save Changes</button>
                                </div>
                            </div>
                        ) : (
                            <div className="group bg-white/50 dark:bg-slate-800/40 backdrop-blur-md p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-slate-200/50 dark:border-white/5 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all duration-300">
                                {/* Goal Icon with ring glow */}
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0 ring-4 ring-indigo-500/10 group-hover:ring-indigo-500/20 transition-all">
                                    <span className="material-icons-round text-white text-xl">gps_fixed</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3
                                        className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate cursor-pointer hover:text-indigo-400 transition-colors tracking-tight"
                                        onClick={() => startEditing(goal)}
                                    >
                                        {goal.title}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                            Goal
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                            <span className="material-icons-round text-xs">calendar_today</span>
                                            {formatDate(goal.targetDate)}
                                        </span>
                                        {goal.startTime && (
                                            <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                                <span className="material-icons-round text-xs">schedule</span>
                                                {formatTime(goal.startTime)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onToggleGoal(goal.id)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700/30 text-slate-400 hover:bg-green-500 hover:text-white transition-all shadow-sm border border-transparent hover:border-green-400/50"
                                        title="Mark Complete"
                                    >
                                        <span className="material-icons-round text-xl">check</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Completed Goals Section (Achievements Look) */}
                {completedGoals.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/5">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Achieved</h4>
                            <span className="text-[10px] font-bold bg-green-500/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20">{completedGoals.length} Success</span>
                        </div>
                        <div className="space-y-3">
                            {completedGoals.map((goal) => (
                                <div key={goal.id} className="group bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl flex items-center gap-4 opacity-60 hover:opacity-100 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/5">
                                    {editingId === goal.id ? (
                                        <div className="flex-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-3 border border-indigo-500/30 space-y-2">
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="w-full bg-white dark:bg-slate-800 border-none rounded-lg px-2 py-1 text-sm dark:text-white"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={saveEdit} className="text-xs font-bold text-indigo-500">Save</button>
                                                <button onClick={cancelEditing} className="text-xs text-slate-500">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-shrink-0">
                                                <div className="w-12 h-12 rounded-2xl bg-green-500/5 border border-green-500/10 flex items-center justify-center text-green-500/50 group-hover:text-green-500 transition-colors">
                                                    <span className="material-icons-round text-xl">emoji_events</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3
                                                    className="font-bold text-slate-500 dark:text-slate-500 line-through truncate cursor-pointer hover:text-indigo-400 transition-colors text-sm"
                                                    onClick={() => startEditing(goal)}
                                                >
                                                    {goal.title}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400/60">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-icons-round text-[12px]">event</span>
                                                        {formatDate(goal.targetDate)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => onToggleGoal(goal.id)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all border border-green-500/20"
                                                    title="Mark Incomplete"
                                                >
                                                    <span className="material-icons-round text-lg">undo</span>
                                                </button>
                                                <button
                                                    onClick={() => onDeleteGoal(goal.id)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete"
                                                >
                                                    <span className="material-icons-round text-lg">delete_outline</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

