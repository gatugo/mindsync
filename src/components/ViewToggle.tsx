'use client';

interface ViewToggleProps {
    view: 'kanban' | 'timeline';
    onViewChange: (view: 'kanban' | 'timeline') => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
    return (
        <div className="inline-flex p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <button
                onClick={() => onViewChange('kanban')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all text-sm font-semibold ${view === 'kanban'
                        ? 'bg-[#5c67ff] text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <span className="material-icons-round text-[18px]">grid_view</span>
                <span>Kanban</span>
            </button>
            <button
                onClick={() => onViewChange('timeline')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all text-sm font-semibold ${view === 'timeline'
                        ? 'bg-[#5c67ff] text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                <span className="material-icons-round text-[18px]">schedule</span>
                <span>Timeline</span>
            </button>
        </div>
    );
}
