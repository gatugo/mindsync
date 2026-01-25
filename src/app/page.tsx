'use client';

import { useState, useEffect, useSyncExternalStore, useRef } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { TaskType, Task } from '@/types';
import AddTaskPanel from '@/components/AddTaskPanel';
import ProgressChart from '@/components/ProgressChart';

import EditTaskModal from '@/components/EditTaskModal';
import GoalsPanel from '@/components/GoalsPanel';
import TimelineView from '@/components/TimelineView';
import BottomNav from '@/components/BottomNav';

import AICoachScreen from '@/components/AICoachScreen';
import SettingsTab from '@/components/SettingsTab';
// ... (rest of imports)

// ... inside page component ...


function useHydration() {
  return useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  );
}

export default function Home() {
  const isHydrated = useHydration();
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'stats' | 'coach' | 'settings'>('today');
  const [activeCoachMode, setActiveCoachMode] = useState<'advice' | 'chat' | 'summary' | 'predict'>('advice');
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ... (rest of the state stays the same, adding plan results in small changes to types)

  // Zustand store
  const {
    tasks,
    history,
    goals,
    addTask,
    updateTask,
    moveTask,
    deleteTask,
    saveDailySnapshot,
    addGoal,
    editGoal,
    toggleGoal,
    deleteGoal,
    getDailyScore,
    getTasksByStatus,
    exportData,
    importData,
    _hasHydrated,
  } = useStore();

  // Hydration / Data Fetching
  const { fetchInitialData } = useStore();

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Dropdown click-away listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsHeaderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close Add Task panel when switching tabs
  useEffect(() => {
    setIsAddTaskOpen(false);
  }, [activeTab]);

  const { score, balance } = getDailyScore();

  const handleAddNewTask = (title: string, type: TaskType, date?: string, time?: string, duration?: number) => {
    addTask(title, type, date, time, duration);
    // Optional: setIsAddTaskOpen(false); if we want auto-close
  };

  const handleExport = () => {
    const data = exportData();
    // Use data URI instead of blob URL for better filename reliability
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = 'brain-balance-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsHeaderDropdownOpen(false);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          const success = importData(result);
          if (success) {
            alert('Data imported successfully!');
          } else {
            alert('Failed to import data. Invalid format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
    setIsHeaderDropdownOpen(false);
  };

  const getBalanceEmoji = () => {
    if (balance === 'optimal') return '✨';
    if (balance === 'anxiety') return '😰';
    if (balance === 'depression') return '😔';
    return '🤯';
  };

  if (!isHydrated || !_hasHydrated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-slate-400 flex items-center gap-2">
          <span className="material-icons-round animate-pulse">psychology</span>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors duration-200">
      {/* Header - Only show on Today tab */}
      {activeTab === 'today' && (
        <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-[#0f172a]/90 backdrop-blur-xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <div
              onClick={() => setActiveTab('today')}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <span className="material-icons-round text-lg sm:text-2xl">psychology</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">MindSync</h1>
                <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none hidden md:block">Sync. Focus. Flow.</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 lg:gap-6">
              {/* Score Badge */}
              <div className="flex items-center gap-1.5 sm:gap-2 bg-[#1e293b] py-1 px-2 sm:py-1.5 sm:px-3 rounded-full border border-slate-700/50 score-glow relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-lg sm:text-xldrop-shadow-sm filter grayscale-[0.2] group-hover:grayscale-0 transition-all transform group-hover:scale-110 duration-200" role="img" aria-label="mood">{getBalanceEmoji()}</span>
                <div className="flex flex-col leading-none">
                  <span className="text-sm sm:text-base lg:text-lg font-bold text-white tracking-tight">{score}</span>
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest hidden lg:block">Score</span>
                </div>
              </div>

              {/* Goals Toggle (Moved to Header) */}
              <button
                onClick={() => setShowGoals(!showGoals)}
                className={`flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-full font-medium transition-all border ${showGoals
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 border-transparent'
                  }`}
                title={showGoals ? "Hide Goals" : "Show Goals"}
              >
                <span className={`material-icons-round text-lg sm:text-xl ${showGoals ? 'text-amber-500' : 'text-slate-400'}`}>flag</span>
                <span className="hidden lg:inline text-xs sm:text-sm">{showGoals ? 'Hide' : 'Goals'}</span>
              </button>

              {/* New Task Button */}
              <button
                onClick={() => setIsAddTaskOpen(!isAddTaskOpen)}
                className={`flex items-center gap-1.5 p-2 sm:px-4 sm:py-2 rounded-full font-semibold transition-all shadow-lg active:scale-95 border border-white/10 ${isAddTaskOpen
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white hover:brightness-110 shadow-indigo-500/40'
                  }`}
              >
                <span className={`material-icons-round text-lg sm:text-xl transition-transform ${isAddTaskOpen ? 'rotate-45' : ''}`}>add</span>
                <span className="hidden sm:inline whitespace-nowrap text-xs sm:text-sm font-bold tracking-wide">New Task</span>
              </button>


            </div>
          </div>
        </header>
      )}

      <main className={`mx-auto flex flex-col overflow-hidden transition-all duration-300 ${activeTab === 'coach' ? 'max-w-4xl h-[calc(100dvh-56px)] p-0' : 'max-w-md h-[calc(100dvh-140px)] p-4 space-y-4'}`}>
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'today' && (
            <div className="h-full flex flex-col overflow-hidden pb-4">
              {showGoals && (
                <GoalsPanel
                  goals={goals}
                  onAddGoal={addGoal}
                  onEditGoal={editGoal}
                  onToggleGoal={toggleGoal}
                  onDeleteGoal={deleteGoal}
                  onClose={() => setShowGoals(false)}
                />
              )}
              <div className="flex-1 min-h-0 mt-4">
                <TimelineView
                  tasks={tasks}
                  onMoveTask={moveTask}
                  onDeleteTask={deleteTask}
                  onUpdateTask={updateTask}
                  onAddTask={addTask}
                  onEditTask={setEditingTask}
                />
              </div>
            </div>
          )}



          {activeTab === 'stats' && (
            <div className="p-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Daily Balance</h2>
              <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-2xl">
                <ProgressChart history={history} />
              </div>
            </div>
          )}

          {activeTab === 'coach' && (
            <AICoachScreen
              tasks={tasks}
              score={score}
              balance={balance}
              history={history}
              goals={goals}
              initialMode={activeTab === 'coach' ? activeCoachMode : 'advice'}
              onClose={() => setActiveTab('today')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              showGoals={showGoals}
              setShowGoals={setShowGoals}
              handleImport={handleImport}
              handleExport={handleExport}
            />
          )}
        </div>
      </main>

      <AddTaskPanel
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={handleAddNewTask}
      />

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'coach' && activeTab !== 'coach') {
            setActiveCoachMode('advice');
          }
          setActiveTab(tab);
        }}
      />



      <EditTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onSave={updateTask}
        onDelete={deleteTask}
      />
    </div>
  );
}
