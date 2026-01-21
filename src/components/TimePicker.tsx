'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';
import Portal from './Portal';

interface TimePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function TimePicker({ value, onChange, placeholder = 'Select time' }: TimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const parseTime = (timeStr: string) => {
        if (!timeStr) return { hour: 12, minute: 0, period: 'PM' };
        const [h, m] = timeStr.split(':').map(Number);
        return {
            hour: h === 0 ? 12 : h > 12 ? h - 12 : h,
            minute: m,
            period: h >= 12 ? 'PM' : 'AM'
        };
    };

    const { hour, minute, period } = parseTime(value);

    const to24h = (h: number, m: number, p: string) => {
        let h24 = h;
        if (p === 'AM' && h === 12) h24 = 0;
        else if (p === 'PM' && h !== 12) h24 = h + 12;
        return `${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const updateTime = (newHour: number, newMinute: number, newPeriod: string) => {
        onChange(to24h(newHour, newMinute, newPeriod));
    };

    const incrementHour = () => updateTime(hour >= 12 ? 1 : hour + 1, minute, period);
    const decrementHour = () => updateTime(hour <= 1 ? 12 : hour - 1, minute, period);
    const incrementMinute = () => updateTime(hour, minute >= 55 ? 0 : minute + 5, period);
    const decrementMinute = () => updateTime(hour, minute <= 0 ? 55 : minute - 5, period);
    const togglePeriod = () => updateTime(hour, minute, period === 'AM' ? 'PM' : 'AM');

    useEffect(() => {
        const updatePosition = () => {
            if (isOpen && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY + 8,
                    left: rect.left + window.scrollX
                });
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }, [isOpen]);

    const displayValue = value
        ? `${hour}:${minute.toString().padStart(2, '0')} ${period}`
        : placeholder;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-slate-900/80 border border-indigo-500/30 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-500/10 cursor-pointer flex items-center justify-between gap-2"
            >
                <span className={value ? 'text-white' : 'text-white/40'}>{displayValue}</span>
                <Clock className="w-4 h-4 text-indigo-400" />
            </button>

            {isOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[9990]" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
                    <div
                        className="fixed z-[9999] bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150"
                        style={{ top: coords.top, left: coords.left, transform: 'translateX(-50%)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Spinners Row */}
                        <div className="flex justify-center items-center gap-2">
                            {/* Hour */}
                            <div className="flex flex-col items-center">
                                <button type="button" onClick={incrementHour} className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white">
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <div className="w-10 h-8 flex items-center justify-center bg-indigo-500/20 rounded text-lg font-bold text-white">
                                    {hour}
                                </div>
                                <button type="button" onClick={decrementHour} className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white">
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>

                            <span className="text-lg font-bold text-white/30">:</span>

                            {/* Minute */}
                            <div className="flex flex-col items-center">
                                <button type="button" onClick={incrementMinute} className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white">
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <div className="w-10 h-8 flex items-center justify-center bg-indigo-500/20 rounded text-lg font-bold text-white">
                                    {minute.toString().padStart(2, '0')}
                                </div>
                                <button type="button" onClick={decrementMinute} className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white">
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>

                            {/* AM/PM */}
                            <button
                                type="button"
                                onClick={togglePeriod}
                                className="w-10 h-8 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 rounded text-xs font-bold text-white transition-colors"
                            >
                                {period}
                            </button>
                        </div>

                        {/* Quick Presets */}
                        <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1 justify-center">
                            {['9 AM', '12 PM', '3 PM', '6 PM', '9 PM'].map((preset) => {
                                const parts = preset.split(' ');
                                const pH = parseInt(parts[0]);
                                const p = parts[1];
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => { updateTime(pH, 0, p); setIsOpen(false); }}
                                        className="px-2 py-0.5 text-[10px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded transition-colors"
                                    >
                                        {preset}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Done */}
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="w-full mt-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </Portal>
            )}
        </div>
    );
}
