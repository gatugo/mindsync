'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { TaskType } from '@/types';

interface QuickAddBarProps {
    onAdd: (title: string, type: TaskType, date?: string, time?: string) => void;
}

export default function QuickAddBar({ onAdd }: QuickAddBarProps) {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const tasks = useStore((state) => state.tasks);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        setIsLoading(true);
        const taskTitle = input.trim();

        try {
            // Attempt to parse with AI
            const response = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'schedule_assist',
                    taskTitle: taskTitle,
                    tasks: [], // Minimal context for speed
                }),
            });

            const data = await response.json();

            let suggestedType: TaskType = 'ADULT';
            let suggestedDate = new Date().toISOString().split('T')[0];
            let suggestedTime = undefined;

            if (data.success) {
                let jsonStr = data.response;
                jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const suggestion = JSON.parse(jsonStr);

                if (suggestion.suggestedType && ['ADULT', 'CHILD', 'REST'].includes(suggestion.suggestedType)) {
                    suggestedType = suggestion.suggestedType;
                }
                if (suggestion.suggestedDate) {
                    suggestedDate = suggestion.suggestedDate;
                }
                if (suggestion.suggestedTime) {
                    suggestedTime = suggestion.suggestedTime;
                }
            }

            // Add the task
            onAdd(taskTitle, suggestedType, suggestedDate, suggestedTime);
            setInput('');
        } catch (error) {
            console.error('Quick Add Error:', error);
            // Fallback: Add as basic ADULT task for today
            onAdd(taskTitle, 'ADULT', new Date().toISOString().split('T')[0]);
            setInput('');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 pt-4 bg-gradient-to-t from-white via-white to-transparent dark:from-[#0f172a] dark:via-[#0f172a] dark:to-transparent">
            <div className="max-w-md mx-auto">
                <form onSubmit={handleSubmit} className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type to add (e.g., 'Gym at 5pm')..."
                        disabled={isLoading}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-full py-3.5 pl-5 pr-12 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 shadow-lg shadow-indigo-500/10 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1.5 p-2 rounded-full bg-indigo-500 text-white disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-all hover:scale-105 active:scale-95"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
