'use client';

import { Task, TaskType } from '@/store/useStore';

interface TaskCardProps {
    task: Task;
    onMoveForward?: () => void;
    onMoveBack?: () => void;
    onDelete: () => void;
    onEdit: () => void;
    isDone?: boolean;
}

const typeConfig: Record<TaskType, { color: string; bgColor: string; label: string }> = {
    ADULT: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'ADULT' },
    CHILD: { color: 'text-pink-500', bgColor: 'bg-pink-500/10', label: 'CHILD' },
    REST: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'REST' },
};

const format12h = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12;
    const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
    return `${displayH}${displayM}${ampm}`;
};

export default function TaskCard({
    task,
    onMoveForward,
    onMoveBack,
    onDelete,
    onEdit,
    isDone = false,
}: TaskCardProps) {
    const config = typeConfig[task.type];

    return (
        <div
            onDoubleClick={onEdit}
            className={`task-card-hover group relative bg-white/5 border border-slate-700/50 p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:border-[#5c67ff]/40 ${isDone ? 'opacity-70 grayscale-[0.5] hover:grayscale-0 hover:opacity-100' : ''
                }`}
        >
            {/* Header: Badge & Date */}
            <div className="flex justify-between items-start mb-3">
                <span
                    className={`px-2 py-0.5 rounded ${config.bgColor} ${config.color} text-[10px] font-bold tracking-widest uppercase flex items-center gap-1`}
                >
                    <span className={`w-1.5 h-1.5 rounded-full bg-current`}></span>
                    {config.label}
                </span>

                {(task.scheduledDate || task.scheduledTime) && (
                    <span className="text-[10px] font-medium text-slate-400">
                        {task.scheduledDate && (
                            <>
                                {new Date(task.scheduledDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </>
                        )}
                        {task.scheduledTime && (
                            <> • {format12h(task.scheduledTime)}</>
                        )}
                    </span>
                )}
            </div>

            {/* Content: Title */}
            <p className={`text-sm font-medium leading-relaxed text-slate-300 ${isDone ? 'line-through' : ''}`}>
                {task.title}
            </p>

            {/* Actions Footer - Visible on Hover */}
            <div className="task-actions opacity-0 group-hover:opacity-100 flex gap-2 mt-4 justify-end transition-opacity">
                {onMoveBack && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveBack(); }}
                        className="p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-[#5c67ff] transition-colors"
                        title="Move back"
                    >
                        <span className="material-icons-round text-sm">arrow_back</span>
                    </button>
                )}

                {onMoveForward && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveForward(); }}
                        className="p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-[#5c67ff] transition-colors"
                        title="Move forward"
                    >
                        <span className="material-icons-round text-sm">arrow_forward</span>
                    </button>
                )}

                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-[#5c67ff] transition-colors"
                    title="Edit task"
                >
                    <span className="material-icons-round text-sm">edit</span>
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 bg-slate-800 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                    title="Delete task"
                >
                    <span className="material-icons-round text-sm">delete</span>
                </button>
            </div>
        </div>
    );
}
