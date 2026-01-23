'use client';

import { Home, BarChart2, MessageSquare, Settings } from 'lucide-react';

interface BottomNavProps {
    currentTab: 'today' | 'stats' | 'coach' | 'settings';
    onTabChange: (tab: 'today' | 'stats' | 'coach' | 'settings') => void;
}

export default function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#0f172a]/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 pb-safe z-50 transition-all duration-300">
            <div className="flex items-center justify-around h-16 max-w-md mx-auto">
                <button
                    onClick={() => onTabChange('today')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'today' ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    <Home className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Home</span>
                </button>

                <button
                    onClick={() => onTabChange('coach')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'coach' ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    <MessageSquare className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Coach</span>
                </button>

                <button
                    onClick={() => onTabChange('stats')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'stats' ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    <BarChart2 className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Stats</span>
                </button>

                {/* Settings */}
                <button
                    onClick={() => onTabChange('settings')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'settings' ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    <Settings className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Settings</span>
                </button>
            </div>
        </nav>
    );
}
