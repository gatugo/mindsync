'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';

interface SettingsTabProps {
    showGoals: boolean;
    setShowGoals: (show: boolean) => void;
    handleImport: () => void;
    handleExport: () => void;
}

export default function SettingsTab({ showGoals, setShowGoals, handleImport, handleExport }: SettingsTabProps) {
    const [showDataModal, setShowDataModal] = useState(false);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        resetStore();
        setUser(null);
        router.refresh();
    };

    return (
        <div className="h-full p-4 space-y-6 relative">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h2>

            {/* Account Panel */}
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                {user ? (
                    <div className="space-y-4 relative">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                {user.email?.[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900 dark:text-white">Logged In</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full py-2 bg-slate-200 dark:bg-slate-700 hover:bg-red-500 hover:text-white text-slate-700 dark:text-slate-300 rounded-xl transition-all font-medium text-sm"
                        >
                            Log Out
                        </button>
                    </div>
                ) : (
                    <div className="text-center space-y-4 relative py-2">
                        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto flex items-center justify-center">
                            <span className="material-icons-round text-slate-400 text-2xl">person_outline</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">Guest Mode</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sign in to securely sync & backup data</p>
                        </div>
                        <Link
                            href="/login"
                            className="block w-full py-2.5 bg-[#5c67ff] hover:bg-indigo-600 text-white rounded-xl transition-colors font-semibold shadow-lg shadow-indigo-500/20"
                        >
                            Log In / Sign Up
                        </Link>
                    </div>
                )}
            </div>

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

            {/* Data Management (Protected) */}
            {user && (
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
                    <button
                        onClick={() => setShowDataModal(true)}
                        className="flex items-center justify-between w-full group"
                    >
                        <div className="flex items-center gap-3">
                            <span className="material-icons-round text-slate-400 group-hover:text-indigo-400 transition-colors">dns</span>
                            <span className="font-medium text-slate-700 dark:text-slate-200">Data Management</span>
                        </div>
                        <span className="material-icons-round text-slate-400">chevron_right</span>
                    </button>
                </div>
            )}

            {/* App Info */}
            <div className="text-center text-sm text-slate-400 pt-4">
                <p>MindSync</p>
                <p className="text-xs">Sync. Focus. Flow.</p>
            </div>

            {/* Data Management Modal */}
            {showDataModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDataModal(false)}>
                    <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="text-center space-y-2">
                            <div className="w-12 h-12 bg-indigo-500/20 rounded-full mx-auto flex items-center justify-center">
                                <span className="material-icons-round text-indigo-400 text-2xl">dns</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Data Management</h3>
                            <p className="text-sm text-slate-400">Securely manage your MindSync data</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => { handleExport(); setShowDataModal(false); }}
                                className="flex items-center justify-between w-full p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-round text-cyan-500 bg-cyan-500/10 p-2 rounded-lg">file_upload</span>
                                    <div className="text-left">
                                        <div className="font-bold text-white text-sm">Export Report</div>
                                        <div className="text-xs text-slate-400">Download CSV backup</div>
                                    </div>
                                </div>
                                <span className="material-icons-round text-slate-500 group-hover:text-white transition-colors">download</span>
                            </button>

                            <button
                                onClick={() => { handleImport(); setShowDataModal(false); }}
                                className="flex items-center justify-between w-full p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-round text-emerald-500 bg-emerald-500/10 p-2 rounded-lg">file_download</span>
                                    <div className="text-left">
                                        <div className="font-bold text-white text-sm">Import Data</div>
                                        <div className="text-xs text-slate-400">Restore from backup</div>
                                    </div>
                                </div>
                                <span className="material-icons-round text-slate-500 group-hover:text-white transition-colors">upload</span>
                            </button>
                        </div>

                        <div className="pt-2 border-t border-white/10">
                            <div className="flex gap-2 items-start p-3 bg-amber-500/10 rounded-lg">
                                <span className="material-icons-round text-amber-500 text-sm mt-0.5">warning</span>
                                <p className="text-[10px] text-amber-200/80 leading-snug">
                                    Importing data will <strong>overwrite</strong> your current tasks. Make sure to export a backup first.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowDataModal(false)}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
