'use client';

import { useState, useEffect, useSyncExternalStore, useRef } from 'react';
import Link from 'next/link';
import { useStore, TaskType, Task } from '@/store/useStore';
import AddTaskPanel from '@/components/AddTaskPanel';
import ProgressChart from '@/components/ProgressChart';

import EditTaskModal from '@/components/EditTaskModal';
import GoalsPanel from '@/components/GoalsPanel';
import TimelineView from '@/components/TimelineView';
import BottomNav from '@/components/BottomNav';
import QuickAddBar from '@/components/QuickAddBar';
import AICoachScreen from '@/components/AICoachScreen';


// Custom hook for hydration check
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
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const { score, balance } = getDailyScore();

  const handleAddNewTask = (title: string, type: TaskType, date?: string, time?: string) => {
    addTask(title, type, date, time);
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
        <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-4">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <a href="https://mindsync-topaz.vercel.app/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <span className="material-icons-round text-2xl">psychology</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">MindSync</h1>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] hidden md:block">Sync. Focus. Flow.</p>
              </div>
            </a>

            <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
              {/* Score Badge */}
              <div className="flex items-center gap-2 sm:gap-3 bg-slate-100 dark:bg-slate-800 py-2 px-4 rounded-full border border-slate-200 dark:border-slate-700/50 score-glow">
                <span className="text-xl">{getBalanceEmoji()}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{score}</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden md:inline">Score</span>
                </div>
              </div>

              {/* New Task Button */}
              <button
                onClick={() => setIsAddTaskOpen(!isAddTaskOpen)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-full font-semibold transition-all shadow-lg active:scale-95 ${isAddTaskOpen
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  : 'bg-[#5c67ff] text-white hover:bg-opacity-90 shadow-[#5c67ff]/30'
                  }`}
              >
                <span className={`material-icons-round text-lg transition-transform ${isAddTaskOpen ? 'rotate-45' : ''}`}>add</span>
                <span className="hidden sm:inline">New Task</span>
              </button>

              {/* More Actions Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                  className={`p-2.5 rounded-full transition-colors flex items-center justify-center ${isHeaderDropdownOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-[#5c67ff]'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                  <span className="material-icons-round">more_vert</span>
                </button>

                {isHeaderDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-2 dropdown-enter">
                    <button
                      onClick={() => { setShowGoals(!showGoals); setIsHeaderDropdownOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      <span className={`material-icons-round text-lg ${showGoals ? 'text-amber-500' : 'text-amber-400/70'}`}>flag</span>
                      <span>{showGoals ? 'Hide Goals' : 'Show Goals'}</span>
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-1 mx-2" />

                    <button
                      onClick={handleImport}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      <span className="material-icons-round text-lg text-emerald-500">file_download</span>
                      <span>Import Data</span>
                    </button>

                    <button
                      onClick={handleExport}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      <span className="material-icons-round text-lg text-cyan-500">file_upload</span>
                      <span>Export Report</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={`max-w-md mx-auto p-4 flex flex-col overflow-hidden space-y-4 ${activeTab === 'today' ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-80px)]'}`}>
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'today' && (
            <div className="h-full overflow-y-auto custom-scrollbar pb-24">
              <TimelineView
                tasks={tasks}
                onMoveTask={moveTask}
                onDeleteTask={deleteTask}
                onUpdateTask={updateTask}
                onAddTask={addTask}
                onEditTask={setEditingTask}
              />
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
            />
          )}

          {activeTab === 'settings' && (
            <div className="h-full p-4 space-y-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h2>

              {/* Goals Toggle */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
                <button
                  onClick={() => setShowGoals(!showGoals)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-icons-round text-amber-500">flag</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Show Goals on Today</span>
                  </div>
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors ${showGoals ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${showGoals ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>

              {/* Data Management */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl space-y-3">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data</h3>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-icons-round text-emerald-500">file_download</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Import Data</span>
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-icons-round text-cyan-500">file_upload</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Export Report</span>
                </button>
              </div>

              {/* App Info */}
              <div className="text-center text-sm text-slate-400 pt-4">
                <p>MindSync v2.0</p>
                <p className="text-xs">Sync. Focus. Flow.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Persistent Quick Add Bar (only on Today tab) */}
      {activeTab === 'today' && <QuickAddBar onAdd={handleAddNewTask} />}

      {/* Bottom Navigation */}
      <BottomNav currentTab={activeTab} onTabChange={setActiveTab} />



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
