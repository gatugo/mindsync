import { Task, TaskType } from '@/types';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Pencil, Check, X, Trash2, Plus, Clock, ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutList, Grid, Bot, Loader2, Sparkles } from 'lucide-react';

interface TimelineViewProps {
    tasks: Task[];
    onMoveTask: (taskId: string, newStatus: 'TODO' | 'START' | 'DONE') => void;
    onDeleteTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'scheduledTime' | 'duration'>>) => void;
    onAddTask: (title: string, type: TaskType, date: string, time: string) => void;
    onEditTask: (task: Task) => void;
}

const typeConfig: Record<TaskType, { emoji: string; bg: string; border: string; label: string }> = {
    ADULT: { emoji: '🔵', bg: 'bg-blue-500/20', border: 'border-blue-500/50', label: 'Adult' },
    CHILD: { emoji: '🩷', bg: 'bg-pink-500/20', border: 'border-pink-500/50', label: 'Child' },
    REST: { emoji: '🟢', bg: 'bg-green-500/20', border: 'border-green-500/50', label: 'Rest' },
};

const DURATION_OPTIONS = [
    { value: 15, label: '15m' },
    { value: 30, label: '30m' },
    { value: 60, label: '1h' },
    { value: 90, label: '1.5h' },
    { value: 120, label: '2h' },
];

type ViewMode = 'day' | 'week' | 'month';

export default function TimelineView({
    tasks,
    onMoveTask,
    onDeleteTask,
    onUpdateTask,
    onAddTask,
    onEditTask,
}: TimelineViewProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [currentDate, setCurrentDate] = useState(new Date());

    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

    // New Task State
    const [creatingSlot, setCreatingSlot] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskType, setNewTaskType] = useState<TaskType>('ADULT');
    const [isAILoading, setIsAILoading] = useState(false);
    const [aiError, setAIError] = useState<string | null>(null);

    // AI-Assisted Scheduling (Smart Add)
    const handleSmartAdd = async () => {
        if (!newTaskTitle.trim()) {
            setAIError('Enter title first');
            return;
        }

        setIsAILoading(true);
        setAIError(null);

        try {
            // Capture Local Time context
            const now = new Date();
            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const localTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const response = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'schedule_assist',
                    taskTitle: newTaskTitle,
                    localDate,
                    localTime,
                    tasks: [] // Minimal context
                })
            });

            const data = await response.json();
            if (data.success && data.response) {
                let jsonStr = data.response;
                jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const suggestion = JSON.parse(jsonStr);

                const suggestedType = (suggestion.suggestedType && ['ADULT', 'CHILD', 'REST'].includes(suggestion.suggestedType))
                    ? suggestion.suggestedType
                    : newTaskType || 'ADULT';

                // If AI suggests a specific time (e.g. user typed "Lunch at 1pm"), use it.
                // Otherwise fallback to the slot the user clicked on.
                const finalTime = suggestion.suggestedTime || creatingSlot;
                const finalDate = suggestion.suggestedDate || formatDateKey(currentDate);

                // Immediate Add
                onAddTask(newTaskTitle.trim(), suggestedType as TaskType, finalDate, finalTime);

                // Close modal
                setCreatingSlot(null);
                setNewTaskTitle('');
                setNewTaskType('ADULT');
            }
        } catch (err) {
            console.error(err);
            setAIError('AI failed');
        } finally {
            setIsAILoading(false);
        }
    };

    // Natural Language Date/Time Parser
    const parseNaturalDateTime = (input: string): { date?: string; time?: string } => {
        const clean = input.toLowerCase().trim();
        const now = new Date();
        let targetDate = new Date(now);
        let targetTime: string | undefined;

        // 1. Extract Date first (so we don't confuse date numbers with time)
        const months = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
        const dateRegex = new RegExp(`(?:${months})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?`);
        const dateMatch = clean.match(dateRegex);

        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            // Find the month index
            const monthStr = clean.match(new RegExp(`(${months})`))![0];
            const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthStr.substring(0, 3));

            // Set date (handle year rollover if needed, simple approach for now: current year)
            // If month is before current month, assume next year? Or just current year.
            targetDate.setMonth(monthIndex);
            targetDate.setDate(day);
            if (targetDate < new Date(new Date().setHours(0, 0, 0, 0))) {
                // If date is in past, assume next year? (Optional logic)
                targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
        }
        else if (clean.includes('tomorrow')) {
            targetDate.setDate(targetDate.getDate() + 1);
        } else if (clean.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDayName = clean.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)![1];
            const targetDayIndex = dayNames.indexOf(targetDayName);
            const currentDayIndex = targetDate.getDay();
            let daysToAdd = targetDayIndex - currentDayIndex;
            if (daysToAdd <= 0) daysToAdd += 7;
            targetDate.setDate(targetDate.getDate() + daysToAdd);
        }

        // 2. Extract Time
        // Avoid matching if preceded by month name (handled by removing date match from string?)
        // Better: Use a stricter regex or check if the match overlaps with dateMatch
        // Simple fix: if it looks like a time "at 5" "5pm" "17:00"

        let timeSearchStr = clean;
        if (dateMatch) {
            timeSearchStr = clean.replace(dateMatch[0], ''); // Remove date part to avoid false positive
        }

        const timeMatch = timeSearchStr.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
        if (timeMatch) {
            let h = parseInt(timeMatch[1]);
            const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3];

            // Fix: If simple number "5" without am/pm/colon, ensure it's not just a stray number?
            // "at 5" is safe. "5pm" is safe. "5" alone is risky?
            // Existing logic allowed "5" -> 05:00. 
            // Let's keep existing logic but apply it on text WITHOUT the date.

            if (ampm === 'pm' && h < 12) h += 12;
            if (ampm === 'am' && h === 12) h = 0;

            if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                targetTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }
        }

        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const todayStr = formatDateKey(new Date());

        return {
            // Only return date if it changed from "today" (or if user explicitly typed a date that happened to be today? Logic implies diff check)
            date: dateStr !== todayStr ? dateStr : undefined,
            time: targetTime
        };
    };

    // --- Helpers ---
    const format12h = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'pm' : 'am';
        const displayH = h % 12 || 12;
        const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
        return `${displayH}${displayM}${ampm}`;
    };

    const getDaysInWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Adjust to Sunday start
        const sunday = new Date(d.setDate(diff));
        const days = [];
        for (let i = 0; i < 7; i++) {
            const next = new Date(sunday);
            next.setDate(sunday.getDate() + i);
            days.push(next);
        }
        return days;
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const formatDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- Navigation ---
    const navigate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (viewMode === 'day') newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        else if (viewMode === 'week') newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        else newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        setCurrentDate(newDate);
    };

    const goToday = () => setCurrentDate(new Date());

    // --- Data Preparation ---
    const filteredTasks = useMemo(() => {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);

        if (viewMode === 'week') {
            const days = getDaysInWeek(currentDate);
            start.setTime(days[0].getTime());
            end.setTime(days[6].getTime());
            end.setHours(23, 59, 59, 999);
        } else if (viewMode === 'month') {
            start.setDate(1);
            const nextMonth = new Date(start);
            nextMonth.setMonth(start.getMonth() + 1);
            end.setTime(nextMonth.getTime() - 1);
        }

        return tasks.filter(t => {
            if (!t.scheduledDate) return false;
            // Interpret YYYY-MM-DD as local midnight to align with "start" and "end" which are local dates
            const tDate = new Date(t.scheduledDate + 'T00:00:00');
            return tDate >= start && tDate <= end;
        });
    }, [tasks, currentDate, viewMode]);


    // -- Daily View Logic (Reused) --
    // Generate time slots (every 30 mins) starting from 5 AM to 12:30 AM (next day)
    const timeSlots = useMemo(() => {
        const slots: { key: string; hour: number; minute: number }[] = [];
        const startHour = 5;
        const endHour = 25; // Goes up to 24:30 (12:30 AM next day)
        for (let h = startHour; h < endHour; h++) {
            slots.push({ key: `${h.toString().padStart(2, '0')}:00`, hour: h, minute: 0 });
            slots.push({ key: `${h.toString().padStart(2, '0')}:30`, hour: h, minute: 30 });
        }
        return slots;
    }, []);

    const tasksBySlot = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        // Only for DAY view we strictly group by time on the specific day
        // For Week/Month we use Date keys
        filteredTasks.forEach(task => {
            if (viewMode === 'day' && task.scheduledTime) {
                const [hStr, mStr] = task.scheduledTime.split(':');
                const h = parseInt(hStr);
                const m = parseInt(mStr);

                // Find closest slot
                const slotIndex = timeSlots.findIndex(s => {
                    const slotMin = s.hour * 60 + s.minute;
                    const taskMin = h * 60 + m;
                    return taskMin >= slotMin && taskMin < slotMin + 30;
                });

                if (slotIndex !== -1) {
                    const key = timeSlots[slotIndex].key;
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(task);
                }
            } else if (viewMode !== 'day') {
                // Group by DATE
                const dateKey = task.scheduledDate;
                if (dateKey) {
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(task);
                }
            }
        });
        return grouped;
    }, [filteredTasks, viewMode]);

    // Calculate spans to enable visual merging (Day View Only for now)
    const slotConfigs = useMemo(() => {
        if (viewMode !== 'day') return [];
        const skipSlots = new Set<string>();
        return timeSlots.map((slot, index) => {
            if (skipSlots.has(slot.key)) return { ...slot, isSkipped: true };
            const slotTasks = tasksBySlot[slot.key] || [];
            slotTasks.forEach(task => {
                const duration = task.duration || 30;
                if (duration > 30) {
                    const slotsToSkip = Math.floor(duration / 30) - 1;
                    for (let i = 1; i <= slotsToSkip; i++) {
                        if (index + i < timeSlots.length) skipSlots.add(timeSlots[index + i].key);
                    }
                }
            });
            return { ...slot, isSkipped: false };
        });
    }, [timeSlots, tasksBySlot, viewMode]);


    // --- Actions ---
    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, slotKey: string, dateKey?: string) => {
        e.preventDefault();
        setDragOverSlot(null);
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) {
            const updates: Partial<Task> = {};
            if (slotKey) updates.scheduledTime = slotKey;
            if (dateKey) updates.scheduledDate = dateKey;
            onUpdateTask(taskId, updates);
        }
    };

    const saveNewTask = (slotKey: string) => {
        if (newTaskTitle.trim()) {
            onAddTask(newTaskTitle.trim(), newTaskType, formatDateKey(currentDate), slotKey);
        }
        setCreatingSlot(null); setNewTaskTitle(''); setNewTaskType('ADULT');
    };
    const updateDuration = (taskId: string, minutes: number) => { onUpdateTask(taskId, { duration: minutes }); };


    // --- Formatters ---
    const formatTimeDisplay = (hour: number, minute: number) => {
        const displayHour = hour >= 24 ? hour - 24 : hour;
        const ampm = displayHour >= 12 ? 'PM' : 'AM';
        const h = displayHour % 12 || 12;
        const m = minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;
        return `${h}${m} ${ampm}`;
    };

    const getHeaderLabel = (abbreviated = false) => {
        if (viewMode === 'day') {
            if (abbreviated) {
                return currentDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            }
            return currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        }
        if (viewMode === 'week') {
            const days = getDaysInWeek(currentDate);
            return `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        }
        return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    };

    // Auto-scroll current time (Day view only)
    const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
    useEffect(() => {
        if (viewMode !== 'day') return;
        setTimeout(() => {
            const now = new Date();
            const h = now.getHours(); const m = now.getMinutes();
            const slotMinute = m < 30 ? 0 : 30;
            const currentKey = `${h.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`;
            const currentEl = slotRefs.current[currentKey];
            if (currentEl && scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                container.scrollTo({ top: currentEl.offsetTop - container.clientHeight / 2 + currentEl.clientHeight / 2, behavior: 'smooth' });
            }
        }, 100);
    }, [viewMode, currentDate]);


    return (
        <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-slate-900/40 flex flex-col gap-4 sm:flex-row justify-between items-center shrink-0">
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                    <div className="flex bg-white/5 p-1 rounded-lg">
                        <button onClick={() => setViewMode('day')} className={`p-1.5 rounded-md transition-all ${viewMode === 'day' ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white'}`}><LayoutList className="w-4 h-4" /></button>
                        <button onClick={() => setViewMode('week')} className={`p-1.5 rounded-md transition-all ${viewMode === 'week' ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white'}`}><CalendarIcon className="w-4 h-4" /></button>
                        <button onClick={() => setViewMode('month')} className={`p-1.5 rounded-md transition-all ${viewMode === 'month' ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white'}`}><Grid className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('prev')} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={goToday} className="text-xs font-bold px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/70 hover:text-white transition-colors">Today</button>
                        <button onClick={() => navigate('next')} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                    <h3 className="text-white font-bold text-xs sm:text-sm md:text-base min-w-[100px] sm:min-w-[140px] text-center">
                        <span className="sm:hidden">{getHeaderLabel(true)}</span>
                        <span className="hidden sm:inline">{getHeaderLabel(false)}</span>
                    </h3>
                </div>
                <span className="text-[10px] text-white/30 font-medium italic hidden sm:block">Secure the Perimeter</span>
            </div>

            {/* Content Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-hide relative">

                {/* DAY VIEW */}
                {viewMode === 'day' && (
                    <div className="relative">
                        {slotConfigs.map((slot) => {
                            if (slot.isSkipped) return null;
                            const slotTasks = tasksBySlot[slot.key] || [];
                            const isHalfHour = slot.minute === 30;
                            const maxDuration = Math.max(30, ...slotTasks.map(t => t.duration || 30));
                            const slotsSpan = Math.ceil(maxDuration / 30);
                            const minHeight = isHalfHour ? 60 : 80;

                            // Highlight Logic
                            const now = new Date();
                            const isToday = formatDateKey(currentDate) === formatDateKey(now);
                            const isCurrentHour = isToday && slot.hour === now.getHours();

                            return (
                                <div
                                    key={slot.key}
                                    ref={(el) => { slotRefs.current[slot.key] = el; }}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverSlot(slot.key); }}
                                    onDragLeave={() => setDragOverSlot(null)}
                                    onDrop={(e) => handleDrop(e, slot.key)}
                                    style={{ minHeight: `${minHeight * slotsSpan}px` }}
                                    className={`flex border-b border-white/5 relative ${dragOverSlot === slot.key
                                        ? 'bg-indigo-500/10'
                                        : isCurrentHour
                                            ? 'bg-indigo-500/5 shadow-[inset_4px_0_0_0_#6366f1]'
                                            : isHalfHour
                                                ? 'bg-slate-900/10'
                                                : ''
                                        }`}
                                >
                                    <div className={`w-20 shrink-0 flex flex-col items-center py-4 border-r border-white/5 bg-slate-900/20 text-xs font-bold ${isCurrentHour ? 'text-indigo-400' : 'text-white/30'}`}>
                                        {formatTimeDisplay(slot.hour, slot.minute)}
                                    </div>
                                    <div className="flex-1 p-2 flex flex-wrap gap-2 content-start">
                                        {slotTasks.map(task => (
                                            <div key={task.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, task.id)}
                                                className={`bg-white/5 backdrop-blur-sm rounded-lg p-2 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all shadow-sm group flex gap-2 overflow-hidden ${task.status === 'DONE' ? 'opacity-50' : ''}`}
                                                style={{ minHeight: `${(task.duration || 30) / 30 * 60}px` }}
                                            >
                                                {/* Inline Complete Button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onMoveTask(task.id, task.status === 'DONE' ? 'TODO' : 'DONE'); }}
                                                    className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.status === 'DONE'
                                                        ? 'bg-green-500 border-green-500 text-white'
                                                        : 'border-white/30 hover:border-green-400 hover:bg-green-500/20 text-transparent hover:text-green-400'
                                                        }`}
                                                    title={task.status === 'DONE' ? 'Mark incomplete' : 'Mark complete'}
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                {/* Task Content */}
                                                <div className="flex-1 cursor-pointer" onClick={() => onEditTask(task)}>
                                                    <div className="flex items-center justify-between gap-1 w-full">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${typeConfig[task.type].bg} ${typeConfig[task.type].border} text-white/90 truncate max-w-[70%]`}>
                                                            {typeConfig[task.type].emoji} {typeConfig[task.type].label}
                                                        </span>
                                                        <span className="text-[10px] text-white/40 font-mono tracking-tight shrink-0 whitespace-nowrap">
                                                            {task.scheduledTime ? format12h(task.scheduledTime) : ''}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium text-white/90 text-sm leading-snug break-words line-clamp-2">
                                                        {task.title}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex-1 min-h-[40px] group cursor-pointer flex items-center justify-center"
                                            onClick={() => { setCreatingSlot(slot.key); setNewTaskTitle(''); }}>
                                            <Plus className="w-4 h-4 text-white/10 group-hover:text-white/40" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {/* Creation Modal (Improved Design) */}
                        {creatingSlot && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200" onClick={() => setCreatingSlot(null)}>
                                <div
                                    className="bg-gradient-to-b from-slate-800 to-slate-900 p-5 rounded-2xl w-80 shadow-2xl border border-white/10 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {/* Header with Time and Close */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                                <Clock className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-2xl font-bold text-white tracking-tight">{format12h(creatingSlot)}</div>
                                                <div className="text-[10px] text-white/40 uppercase tracking-wider">New Task</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setCreatingSlot(null)}
                                            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Input with AI Button */}
                                    <div className="relative mb-3">
                                        <input
                                            autoFocus
                                            value={newTaskTitle}
                                            onChange={e => setNewTaskTitle(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && saveNewTask(creatingSlot)}
                                            className="w-full bg-slate-950/80 p-3 pr-12 rounded-xl text-white border border-white/10 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-white/30"
                                            placeholder="What needs to be done?"
                                        />
                                        <button
                                            onClick={handleSmartAdd}
                                            disabled={isAILoading || !newTaskTitle.trim()}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
                                            title="Smart Add"
                                        >
                                            {isAILoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* AI Error */}
                                    {aiError && <div className="text-xs text-red-400 mb-2 px-1">{aiError}</div>}

                                    {/* Natural Language Preview */}
                                    {newTaskTitle.trim() && (() => {
                                        const parsed = parseNaturalDateTime(newTaskTitle);
                                        if (parsed.date || parsed.time) {
                                            return (
                                                <div className="mb-3 text-xs text-indigo-300/80 flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                                                    <Sparkles className="w-3 h-3" />
                                                    <span>
                                                        Detected: {parsed.date && `${new Date(parsed.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                                                        {parsed.date && parsed.time && ' @ '}
                                                        {parsed.time && format12h(parsed.time)}
                                                    </span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Type Selector - Colored Pills */}
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            onClick={() => setNewTaskType('ADULT')}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${newTaskType === 'ADULT'
                                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10'
                                                }`}
                                        >
                                            🔵 Adult
                                        </button>
                                        <button
                                            onClick={() => setNewTaskType('CHILD')}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${newTaskType === 'CHILD'
                                                ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                                                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10'
                                                }`}
                                        >
                                            🩷 Child
                                        </button>
                                        <button
                                            onClick={() => setNewTaskType('REST')}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${newTaskType === 'REST'
                                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10'
                                                }`}
                                        >
                                            🟢 Rest
                                        </button>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setCreatingSlot(null)}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all border border-white/10"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => saveNewTask(creatingSlot)}
                                            disabled={!newTaskTitle.trim()}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Task
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* WEEK VIEW */}
                {viewMode === 'week' && (
                    <div className="grid grid-cols-7 h-full min-w-[800px]">
                        {getDaysInWeek(currentDate).map((day, i) => {
                            const dayKey = formatDateKey(day);
                            const dayTasks = filteredTasks.filter(t => t.scheduledDate === dayKey);
                            const isToday = dayKey === formatDateKey(new Date());
                            return (
                                <div key={i}
                                    className={`border-r border-white/5 last:border-0 flex flex-col cursor-pointer hover:bg-white/[0.02] ${isToday ? 'bg-white/5' : ''}`}
                                    onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                                >
                                    <div className="p-2 text-center border-b border-white/5">
                                        <div className="text-xs text-white/50 uppercase">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                        <div className={`text-sm font-bold ${isToday ? 'text-indigo-400' : 'text-white'}`}>{day.getDate()}</div>
                                    </div>
                                    <div className="flex-1 p-1 space-y-2 overflow-y-auto">
                                        {dayTasks.map(task => (
                                            <div key={task.id}
                                                className={`p-1.5 rounded text-[10px] border truncate text-white/90 shadow-sm ${typeConfig[task.type].bg} ${typeConfig[task.type].border}`}
                                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                            >
                                                {typeConfig[task.type].emoji} {task.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MONTH VIEW */}
                {viewMode === 'month' && (
                    <div className="grid grid-cols-7 auto-rows-fr h-full">
                        {/* Headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="p-2 text-center text-xs font-bold text-white/40 border-b border-white/5">{d}</div>
                        ))}
                        {/* Padding for first week */}
                        {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
                            <div key={`pad-${i}`} className="border-r border-b border-white/5 bg-slate-900/20" />
                        ))}
                        {getDaysInMonth(currentDate).map((day) => {
                            const dayKey = formatDateKey(day);
                            const dayTasks = filteredTasks.filter(t => t.scheduledDate === dayKey);
                            return (
                                <div key={dayKey}
                                    className="border-r border-b border-white/5 p-1 min-h-[80px] hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                                >
                                    <div className="text-right text-xs text-white/50 mb-1">{day.getDate()}</div>
                                    <div className="space-y-1">
                                        {dayTasks.slice(0, 3).map(task => (
                                            <div key={task.id}
                                                className={`h-1.5 rounded-full w-full ${typeConfig[task.type].bg.replace('/20', '/80')} cursor-pointer`}
                                                title={task.title}
                                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                            />
                                        ))}
                                        {dayTasks.length > 3 && <div className="text-[9px] text-white/30 text-center">+{dayTasks.length - 3} more</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
