'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import Portal from './Portal';

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DatePicker({ value, onChange, placeholder = 'Select date' }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const today = new Date();
    const selectedDate = value ? new Date(value + 'T00:00:00') : null;
    const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
    const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());

    useEffect(() => {
        const updatePosition = () => {
            if (isOpen && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX + (rect.width / 2)
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

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };

    const selectDate = (day: number) => {
        const dateStr = `${viewYear}-${(viewMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const goToday = () => {
        const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
        onChange(todayStr);
        setIsOpen(false);
    };

    const clear = () => {
        onChange('');
        setIsOpen(false);
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    const displayValue = selectedDate
        ? selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : placeholder;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-slate-900/80 border border-indigo-500/30 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-500/10 cursor-pointer flex items-center justify-between gap-2"
            >
                <span className={value ? 'text-white' : 'text-white/40'}>{displayValue}</span>
                <Calendar className="w-4 h-4 text-indigo-400" />
            </button>

            {isOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[9990]" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
                    <div
                        className="fixed z-[9999] bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150 w-[280px]"
                        style={{ top: coords.top, left: coords.left, transform: 'translateX(-50%)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2 px-1">
                            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-bold text-white">{MONTHS[viewMonth]} {viewYear}</span>
                            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Day Labels */}
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                            {DAYS.map(d => (
                                <div key={d} className="text-center text-[10px] font-bold text-white/40 py-1">{d}</div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-0.5">
                            {/* Empty cells for days before month start */}
                            {Array.from({ length: firstDay }).map((_, i) => (
                                <div key={`empty-${i}`} className="w-7 h-7" />
                            ))}

                            {/* Day cells */}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                                const isSelected = selectedDate && day === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear();

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => selectDate(day)}
                                        className={`w-7 h-7 rounded text-xs font-medium transition-colors flex items-center justify-center
                                            ${isSelected
                                                ? 'bg-indigo-500 text-white'
                                                : isToday
                                                    ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50'
                                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="mt-2 pt-2 border-t border-white/10 flex justify-between">
                            <button type="button" onClick={clear} className="text-[10px] text-white/50 hover:text-white px-2 py-0.5 rounded hover:bg-white/5">
                                Clear
                            </button>
                            <button type="button" onClick={goToday} className="text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded hover:bg-indigo-500/10">
                                Today
                            </button>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
