'use client';

import { useState, useEffect } from 'react';
import { Task, TaskType, TaskStatus } from '@/store/useStore';
import { X, Clock, Calendar, Type, Trash2, Save } from 'lucide-react';
import TimePicker from '@/components/TimePicker';
import DatePicker from '@/components/DatePicker';

interface EditTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task | null;
    onSave: (taskId: string, updates: Partial<Task>) => void;
    onDelete: (taskId: string) => void;
}

const typeConfig: Record<TaskType, { emoji: string; label: string; bg: string }> = {
    ADULT: { emoji: '🔵', label: 'Adult', bg: 'bg-blue-500/20 text-blue-300' },
    CHILD: { emoji: '🩷', label: 'Child', bg: 'bg-pink-500/20 text-pink-300' },
    REST: { emoji: '🟢', label: 'Rest', bg: 'bg-green-500/20 text-green-300' },
};

const durations = [
    { label: '30m', value: 30 },
    { label: '1h', value: 60 },
    { label: '1.5h', value: 90 },
    { label: '2h', value: 120 },
];

export default function EditTaskModal({ isOpen, onClose, task, onSave, onDelete }: EditTaskModalProps) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState<TaskType>('ADULT');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(30);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setType(task.type);
            setDate(task.scheduledDate || '');
            setTime(task.scheduledTime || '');
            setDuration(task.duration || 30);
        }
    }, [task]);

    if (!isOpen || !task) return null;

    const handleSave = () => {
        onSave(task.id, {
            title,
            type,
            scheduledDate: date || undefined,
            scheduledTime: time || undefined,
            duration
        });
        onClose();
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this task?')) {
            onDelete(task.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-800/50">
                    <h2 className="text-white font-bold text-lg">Edit Task</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Task Name</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                            placeholder="Task title..."
                        />
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Type</label>
                        <div className="flex gap-2">
                            {(Object.keys(typeConfig) as TaskType[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${type === t
                                        ? `${typeConfig[t].bg} border-white/20 ring-1 ring-white/20`
                                        : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'
                                        }`}
                                >
                                    <span>{typeConfig[t].emoji}</span>
                                    <span className="text-sm font-medium">{typeConfig[t].label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Schedule */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Date
                            </label>
                            <DatePicker
                                value={date}
                                onChange={setDate}
                                placeholder="Select date"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Time
                            </label>
                            <TimePicker
                                value={time}
                                onChange={setTime}
                                placeholder="Select time"
                            />
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-1">
                            Duration
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {durations.map((d) => (
                                <button
                                    key={d.value}
                                    onClick={() => setDuration(d.value)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${duration === d.value
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                            <div className="flex items-center gap-2 bg-white/5 px-2 rounded-lg border border-white/5 focus-within:border-indigo-500/50 transition-colors">
                                <input
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                                    className="w-12 bg-transparent py-1.5 text-sm text-white text-center focus:outline-none"
                                />
                                <span className="text-xs text-white/40 pr-1">min</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-slate-800/50 flex justify-between items-center">
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-colors text-sm font-medium"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!title.trim()}
                            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                        >
                            <Save className="w-4 h-4" />
                            Save Changes
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
