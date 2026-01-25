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
    const [user, setUser] = useState<any>(null);
    const [showDataModal, setShowDataModal] = useState(false);
    const router = useRouter();
    const { preferences, updatePreferences, resetStore } = useStore();

    const [tempPrefs, setTempPrefs] = useState(preferences);
    const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    // Keep tempPrefs in sync with store when it hydrates
    useEffect(() => {
        setTempPrefs(preferences);
    }, [preferences]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        resetStore();
        setUser(null);
        router.refresh();
    };

    const handleSavePrefs = () => {
        updatePreferences(tempPrefs);
    };

    const handleAddTag = (key: 'hobbies' | 'interests' | 'passions' | 'work', value: string) => {
        if (!value.trim()) return;
        setTempPrefs(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), value.trim()]
        }));
    };

    const handleRemoveTag = (key: 'hobbies' | 'interests' | 'passions' | 'work', index: number) => {
        setTempPrefs(prev => ({
            ...prev,
            [key]: prev[key].filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="h-full p-4 space-y-6 relative overflow-y-auto pb-32">
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

            {/* Brain Balance Preferences */}
            <div className={`bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden transition-all duration-300 border border-transparent ${isPersonalizationOpen ? 'dark:border-indigo-500/20 shadow-lg shadow-indigo-500/5' : ''}`}>
                <button
                    onClick={() => setIsPersonalizationOpen(!isPersonalizationOpen)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isPersonalizationOpen ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
                            <span className="material-icons-round text-xl">psychology</span>
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-slate-900 dark:text-white">Brain Personalization</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Customize your AI Coach</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Save Indicator */}
                        {(tempPrefs !== preferences) && (
                            <span
                                onClick={(e) => { e.stopPropagation(); handleSavePrefs(); }}
                                className="text-xs font-bold bg-indigo-500 text-white px-3 py-1.5 rounded-full shadow-lg shadow-indigo-500/30 animate-pulse hover:bg-indigo-600 transition-colors cursor-pointer mr-1"
                            >
                                Save Changes
                            </span>
                        )}

                        {!user && (
                            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                                <span className="material-icons-round text-amber-500 text-[10px]">cloud_off</span>
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wide">
                                    Local Only
                                </span>
                            </div>
                        )}

                        <span className={`material-icons-round text-slate-400 transition-transform duration-300 ${isPersonalizationOpen ? 'rotate-180' : ''}`}>
                            expand_more
                        </span>
                    </div>
                </button>

                <div className={`transition-all duration-300 ease-in-out ${isPersonalizationOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-5 pt-0 border-t border-slate-200 dark:border-white/5 space-y-6">

                        {/* Guest Warning */}
                        {!user && (
                            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start">
                                <span className="material-icons-round text-amber-500 text-lg mt-0.5">info</span>
                                <div>
                                    <p className="text-xs font-semibold text-amber-200">Guest Mode Active</p>
                                    <p className="text-[10px] text-amber-200/70 leading-relaxed">
                                        Your personalization settings are saved to this browser only. <Link href="/login" className="underline hover:text-white">Log in</Link> to sync them across devices.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Sleep Schedule */}
                        <div className="space-y-3 mt-4">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                                <span className="material-icons-round text-indigo-400 text-lg">bedtime</span>
                                Sleep Schedule
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold ml-1">Sleep At</span>
                                    <input
                                        type="time"
                                        value={tempPrefs.sleepStartTime || '23:00'}
                                        onChange={(e) => setTempPrefs(p => ({ ...p, sleepStartTime: e.target.value }))}
                                        className="w-full bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono appearance-none"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold ml-1">Wake Up</span>
                                    <input
                                        type="time"
                                        value={tempPrefs.sleepEndTime || '07:00'}
                                        onChange={(e) => setTempPrefs(p => ({ ...p, sleepEndTime: e.target.value }))}
                                        className="w-full bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono appearance-none"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Hobbies / Interests / Passions / Work */}
                        {(['work', 'hobbies', 'interests', 'passions'] as const).map((key) => (
                            <div key={key} className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 capitalize">
                                    <span className="material-icons-round text-slate-400 text-lg">
                                        {key === 'hobbies' ? 'sports_esports' : key === 'interests' ? 'auto_awesome' : key === 'passions' ? 'favorite' : 'work'}
                                    </span>
                                    {key === 'work' ? 'Work / Skills' : key}
                                </label>
                                <div className="flex flex-wrap gap-2 bg-slate-200/50 dark:bg-black/20 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                    {(tempPrefs[key] || []).map((tag, i) => (
                                        <span
                                            key={i}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-white/5 group transition-all hover:border-red-500/30"
                                        >
                                            {tag}
                                            <button
                                                onClick={() => handleRemoveTag(key, i)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-icons-round text-[14px]">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        placeholder={`+ Add ${key.slice(0, -1)}`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleAddTag(key, (e.target as HTMLInputElement).value);
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }}
                                        className="bg-transparent px-2 py-1 text-xs text-slate-700 dark:text-white focus:outline-none placeholder:text-slate-400 min-w-[100px]"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>



            {/* Data Management (Protected) */}
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
                <button
                    onClick={() => setShowDataModal(true)}
                    className="flex items-center justify-between w-full group"
                >
                    <div className="flex items-center gap-3">
                        <span className="material-icons-round text-slate-400 group-hover:text-indigo-400 transition-colors">dns</span>
                        <div className="text-left">
                            <span className="font-medium text-slate-700 dark:text-slate-200 block">Data Management</span>
                            {!user && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Backup Required</span>}
                        </div>
                    </div>
                    <span className="material-icons-round text-slate-400">chevron_right</span>
                </button>
            </div>

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
                                        <div className="text-xs text-slate-400">Download JSON backup</div>
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
