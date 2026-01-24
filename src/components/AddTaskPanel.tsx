'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, ChevronDown, Bot, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { TaskType } from '@/types';
import TimePicker from './TimePicker';
import DatePicker from './DatePicker';
import Portal from './Portal';

interface AddTaskPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (title: string, type: TaskType, date?: string, time?: string) => void;
}

const typeConfig: Record<TaskType, { emoji: string; label: string; color: string }> = {
    ADULT: { emoji: '🔵', label: 'Adult', color: 'bg-blue-500' },
    CHILD: { emoji: '🩷', label: 'Child', color: 'bg-pink-500' },
    REST: { emoji: '🟢', label: 'Rest', color: 'bg-green-500' },
};

export default function AddTaskPanel({ isOpen, onClose, onAdd }: AddTaskPanelProps) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<TaskType>('ADULT');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('');
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);
    const [aiError, setAIError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const typeButtonRef = useRef<HTMLButtonElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    // Get tasks from store for AI context
    const tasks = useStore((state) => state.tasks);

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Calculate position for Type Dropdown (Portal-based)
    useEffect(() => {
        const updatePosition = () => {
            if (isTypeDropdownOpen && typeButtonRef.current) {
                const rect = typeButtonRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX
                });
            }
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isTypeDropdownOpen]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (title.trim()) {
            onAdd(title.trim(), type, date || undefined, time || undefined);
            setTitle('');
            setDate('');
            setTime('');
            setAIError(null);
            onClose();
        }
    };

    // AI-Assisted Scheduling (Smart Add)
    const handleSmartAdd = async () => {
        if (!title.trim()) {
            setAIError('Enter a task description first!');
            return;
        }

        setIsAILoading(true);
        setAIError(null);

        try {
            const response = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'schedule_assist',
                    taskTitle: title.trim(),
                    tasks: [], // Minimal context for speed
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'AI request failed');
            }

            let jsonStr = data.response;
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const suggestion = JSON.parse(jsonStr);

            const newType = (suggestion.suggestedType && ['ADULT', 'CHILD', 'REST'].includes(suggestion.suggestedType))
                ? suggestion.suggestedType
                : 'ADULT';
            const newDate = suggestion.suggestedDate || new Date().toISOString().split('T')[0];
            const newTime = suggestion.suggestedTime;

            // Immediately add the task
            onAdd(title.trim(), newType as TaskType, newDate, newTime);

            // Reset and close
            setTitle(''); setDate(''); setTime(''); setAIError(null);
            onClose();

        } catch (error) {
            console.error('AI Smart Add error:', error);
            setAIError(error instanceof Error ? error.message : 'Failed to smart add');
        } finally {
            setIsAILoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-[81px] left-0 right-0 z-40 flex justify-center px-4 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
            <div className="w-full max-w-md pointer-events-auto bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] ring-1 ring-white/10 relative overflow-visible group">

                {/* Close Button (subtle) */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 pt-2">
                    {/* Main Input */}
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); setAIError(null); }}
                            placeholder="Type to add (e.g., 'Gym at 5pm')..."
                            className="w-full bg-transparent text-xl sm:text-2xl font-semibold text-white placeholder:text-white/30 focus:outline-none py-2 pr-8 leading-relaxed"
                        />
                    </div>

                    {/* AI Error Message */}
                    {aiError && (
                        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 font-medium animate-in fade-in slide-in-from-top-1">
                            {aiError}
                        </div>
                    )}

                    {/* Details Section - Responsive Layout */}
                    <div className="flex flex-col gap-3 sm:gap-5">
                        {/* Row 1: Type, Date, Time */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {/* Type Selector - uses Portal to escape stacking context */}
                            <div className="relative">
                                <button
                                    ref={typeButtonRef}
                                    type="button"
                                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                    className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-white/5 hover:border-white/10 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-white/90 transition-all font-medium"
                                >
                                    <span>{typeConfig[type].emoji}</span>
                                    <span>{typeConfig[type].label}</span>
                                    <ChevronDown className="w-3 h-3 text-white/50" />
                                </button>

                                {isTypeDropdownOpen && (
                                    <Portal>
                                        {/* Invisible backdrop to catch outside clicks */}
                                        <div
                                            className="fixed inset-0 z-[9990]"
                                            onClick={(e) => { e.stopPropagation(); setIsTypeDropdownOpen(false); }}
                                        />
                                        {/* Dropdown menu rendered at document.body level */}
                                        <div
                                            className="fixed z-[9999] bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[140px] animate-in fade-in zoom-in-95 duration-100 p-1"
                                            style={{ top: coords.top, left: coords.left }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {(Object.keys(typeConfig) as TaskType[]).map((t) => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setType(t);
                                                        setIsTypeDropdownOpen(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg text-sm transition-colors ${type === t ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                                >
                                                    <span>{typeConfig[t].emoji}</span>
                                                    <span className="font-medium">{typeConfig[t].label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </Portal>
                                )}
                            </div>

                            <div className="hidden sm:block h-5 w-px bg-white/10" />

                            {/* Date Picker Wrapper */}
                            <div className="flex-1 min-w-[110px] sm:min-w-[120px] max-w-[140px]">
                                <DatePicker value={date} onChange={setDate} placeholder="Today" />
                            </div>

                            {/* Time Picker Wrapper */}
                            <div className="flex-1 min-w-[90px] sm:min-w-[100px] max-w-[120px]">
                                <TimePicker value={time} onChange={setTime} placeholder="Any time" />
                            </div>
                        </div>

                        {/* Row 2: AI Button + Add Task */}
                        <div className="flex items-center justify-between gap-3 sm:gap-4 pt-1">
                            {/* AI Smart Add Button */}
                            <button
                                type="button"
                                onClick={handleSmartAdd}
                                disabled={isAILoading || !title.trim()}
                                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 sm:gap-2.5 hover:scale-[1.02] active:scale-95 border border-white/10"
                            >
                                {isAILoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4" />
                                )}
                                <span className="whitespace-nowrap">Smart Add</span>
                            </button>

                            {/* Add Button */}
                            <button
                                type="submit"
                                disabled={!title.trim()}
                                className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 border border-white/5"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="whitespace-nowrap">Add Task</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
