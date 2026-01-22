'use client';

import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { DailySnapshot } from '@/types';

interface ProgressChartProps {
    history: DailySnapshot[];
}

type TimeRange = '7days' | '30days';

// Custom hook for hydration check
function useHydration() {
    return useSyncExternalStore(
        () => () => { },
        () => true,
        () => false
    );
}

export default function ProgressChart({ history }: ProgressChartProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('7days');
    const mounted = useHydration();

    // Filter data based on time range
    const now = new Date();
    const daysToShow = timeRange === '7days' ? 7 : 30;
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - daysToShow);

    const filteredHistory = history
        .filter((snapshot) => new Date(snapshot.date) >= cutoffDate)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Generate chart data with filled gaps for missing days
    const chartData: Array<{
        date: string;
        displayDate: string;
        adult: number;
        child: number;
        rest: number;
        score: number;
    }> = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const snapshot = filteredHistory.find((h) => h.date === dateStr);

        chartData.push({
            date: dateStr,
            displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            adult: snapshot?.adultCompleted || 0,
            child: snapshot?.childCompleted || 0,
            rest: snapshot?.restCompleted || 0,
            score: snapshot?.score || 0,
        });
    }

    if (!mounted) {
        return (
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6">
                <div className="h-64 flex items-center justify-center text-white/40">
                    Loading chart...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 relative">
            {/* Close Button */}


            {/* Header */}
            <div className="flex items-center justify-between mb-4 pr-8">
                <h3 className="text-lg font-semibold text-white">📊 Progress Overview</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setTimeRange('7days')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${timeRange === '7days'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => setTimeRange('30days')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${timeRange === '30days'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                    >
                        30 Days
                    </button>
                </div>
            </div>

            {/* Chart */}
            {chartData.every((d) => d.adult === 0 && d.child === 0 && d.rest === 0) ? (
                <div className="h-64 flex items-center justify-center text-white/40">
                    No data yet. Complete some tasks to see your progress!
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                        <XAxis
                            dataKey="displayDate"
                            stroke="#ffffff60"
                            fontSize={12}
                            tickLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#ffffff60"
                            fontSize={12}
                            tickLine={false}
                            label={{
                                value: 'Tasks',
                                angle: -90,
                                position: 'insideLeft',
                                fill: '#ffffff60',
                            }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#ffffff60"
                            fontSize={12}
                            tickLine={false}
                            domain={[0, 100]}
                            label={{
                                value: 'Score',
                                angle: 90,
                                position: 'insideRight',
                                fill: '#ffffff60',
                            }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #ffffff20',
                                borderRadius: '8px',
                            }}
                            labelStyle={{ color: '#fff' }}
                        />
                        <Legend />

                        {/* Stacked Bars for Task Counts */}
                        <Bar
                            yAxisId="left"
                            dataKey="adult"
                            name="🔵 Adult"
                            stackId="tasks"
                            fill="#3b82f6"
                            radius={[0, 0, 0, 0]}
                        />
                        <Bar
                            yAxisId="left"
                            dataKey="child"
                            name="🩷 Child"
                            stackId="tasks"
                            fill="#ec4899"
                            radius={[0, 0, 0, 0]}
                        />
                        <Bar
                            yAxisId="left"
                            dataKey="rest"
                            name="🟢 Rest"
                            stackId="tasks"
                            fill="#22c55e"
                            radius={[4, 4, 0, 0]}
                        />

                        {/* Line for Score */}
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="score"
                            name="⚖️ Ego Score"
                            stroke="#f59e0b"
                            strokeWidth={3}
                            dot={{ fill: '#f59e0b', strokeWidth: 2 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            )}

            {/* Legend Hint */}
            <p className="text-xs text-white/40 mt-2 text-center">
                Higher score = better Adult/Child balance. Save daily snapshots to track progress.
            </p>
        </div>
    );
}
