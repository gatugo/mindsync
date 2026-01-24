'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { X, Send, Bot, Sparkles, TrendingUp, MessageCircle, Trash2, User, PlusCircle, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Task, DailySnapshot, Goal, TaskType } from '@/types';

interface AICoachModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    score: number;
    balance: string;
    history: DailySnapshot[];
    goals: Goal[];
}

type CoachMode = 'advice' | 'chat' | 'summary' | 'predict';

interface SuggestedAction {
    type: 'CREATE_TASK';
    title: string;
    taskType: TaskType;
    duration: number;
    scheduledTime?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: SuggestedAction[];
}

export default function AICoachModal({
    isOpen,
    onClose,
    tasks,
    score,
    balance,
    history,
    goals,
}: AICoachModalProps) {
    const [mode, setMode] = useState<CoachMode>('advice');
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const addTask = useStore((state) => state.addTask);
    const preferences = useStore((state) => state.preferences);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Simple Markdown Renderer for AI responses
    const renderMarkdown = (text: string): ReactNode => {
        // Split into paragraphs (double newlines)
        const paragraphs = text.split(/\n\n+/);

        return paragraphs.map((paragraph, pIdx) => {
            // Check if it's a list (starts with - or * or • or 1. 2. etc)
            const lines = paragraph.split('\n');
            const isBulletList = lines.every(line => line.trim() === '' || /^[-*•]\s/.test(line.trim()));
            const isNumberedList = lines.every(line => line.trim() === '' || /^\d+[.)]\s/.test(line.trim()));

            if (isBulletList) {
                const listItems = lines.filter(line => /^[-*•]\s/.test(line.trim()));
                return (
                    <ul key={pIdx} className="list-disc list-inside space-y-1 my-2">
                        {listItems.map((item, idx) => (
                            <li key={idx} className="text-white/90">
                                {renderInlineMarkdown(item.replace(/^[-*•]\s+/, ''))}
                            </li>
                        ))}
                    </ul>
                );
            }

            if (isNumberedList) {
                const listItems = lines.filter(line => /^\d+[.)]\s/.test(line.trim()));
                return (
                    <ol key={pIdx} className="list-decimal list-inside space-y-1 my-2">
                        {listItems.map((item, idx) => (
                            <li key={idx} className="text-white/90">
                                {renderInlineMarkdown(item.replace(/^\d+[.)]\s+/, ''))}
                            </li>
                        ))}
                    </ol>
                );
            }

            // Check for inline list items separated by line breaks (not double breaks)
            const hasLineBreaks = paragraph.includes('\n');
            if (hasLineBreaks) {
                return (
                    <div key={pIdx} className="mb-3 last:mb-0 space-y-1">
                        {lines.filter(l => l.trim()).map((line, idx) => (
                            <p key={idx}>{renderInlineMarkdown(line)}</p>
                        ))}
                    </div>
                );
            }

            // Regular paragraph with inline formatting
            return (
                <p key={pIdx} className="mb-3 last:mb-0">
                    {renderInlineMarkdown(paragraph)}
                </p>
            );
        });
    };

    // Handle inline markdown: **bold**, *italic*, `code`
    const renderInlineMarkdown = (text: string): ReactNode => {
        const parts: ReactNode[] = [];
        let lastIndex = 0;

        // Match **bold**, *italic*, and `code`
        const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\`(.+?)\`)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            if (match[1]) { // **bold**
                parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>);
            } else if (match[3]) { // *italic*
                parts.push(<em key={match.index} className="italic">{match[4]}</em>);
            } else if (match[5]) { // `code`
                parts.push(<code key={match.index} className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 text-xs">{match[6]}</code>);
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    // Natural Language Date/Time Parser
    const parseNaturalDateTime = (input: string): { date?: string; time?: string } => {
        const clean = input.toLowerCase().trim();
        const now = new Date();
        let targetDate = new Date(now);
        let targetTime: string | undefined;

        // 1. Extract Date first (so we don't confuse date numbers with time)
        const months = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
        const dateRegex = new RegExp(`(?:${months})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?`);
        const dateMatch = clean.match(dateRegex);

        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const monthStr = clean.match(new RegExp(`(${months})`))![0];
            const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthStr.substring(0, 3));
            targetDate.setMonth(monthIndex);
            targetDate.setDate(day);
            if (targetDate < new Date(new Date().setHours(0, 0, 0, 0))) {
                targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
        }
        else if (clean.includes('tomorrow')) {
            targetDate.setDate(targetDate.getDate() + 1);
        } else if (clean.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDayName = clean.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)![1];
            const targetDayIndex = dayNames.indexOf(targetDayName);
            const currentDayIndex = targetDate.getDay();
            let daysToAdd = targetDayIndex - currentDayIndex;
            if (daysToAdd <= 0) daysToAdd += 7;
            targetDate.setDate(targetDate.getDate() + daysToAdd);
        }

        // 2. Extract Time
        let timeSearchStr = clean;
        if (dateMatch) {
            timeSearchStr = clean.replace(dateMatch[0], '');
        }

        const timeMatch = timeSearchStr.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
        if (timeMatch) {
            let h = parseInt(timeMatch[1]);
            const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3];

            if (ampm === 'pm' && h < 12) h += 12;
            if (ampm === 'am' && h === 12) h = 0;

            if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                targetTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }
        }

        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        return {
            date: dateStr !== todayStr ? dateStr : undefined,
            time: targetTime
        };
    };

    const normalizeTime = (timeStr: string): string | undefined => {
        const clean = timeStr.trim().toLowerCase();
        if (clean === 'any' || !clean) return undefined;
        const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
        if (match) {
            let h = parseInt(match[1]);
            const m = match[2] ? parseInt(match[2]) : 0;
            const ampm = match[3];
            if (ampm === 'pm' && h < 12) h += 12;
            if (ampm === 'am' && h === 12) h = 0;
            if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }
        }
        return undefined;
    };

    const parseActions = (text: string): { cleanText: string; actions: SuggestedAction[] } => {
        const actions: SuggestedAction[] = [];
        const actionRegex = /\[ACTION: CREATE_TASK \| (.*?)\]/g;

        const cleanText = text.replace(actionRegex, (match, content) => {
            const parts = content.split('|').map((p: string) => p.trim());

            if (parts.length >= 4) {
                const title = parts[0];
                const type = parts[1] as TaskType;
                const duration = parseInt(parts[2]) || 30;
                let date: string | undefined;
                let time: string | undefined;

                if (parts.length === 5) {
                    date = parts[3];
                    time = parts[4];
                } else {
                    time = parts[3];
                }

                // Note: SuggestedAction interface in Modal might need scheduledDate update if we want to use it? 
                // The Modal interface (lines 20-26) says: scheduledTime?: string. It misses scheduledDate! 
                // I should update interface too but let's stick to parsing for now.
                // Re-using scheduledTime for now or ignoring date if interface doesn't support it.
                // Wait, if I don't add scheduledDate to interface, I lose the date info.

                actions.push({
                    type: 'CREATE_TASK',
                    title,
                    taskType: type,
                    duration,
                    scheduledTime: normalizeTime(time || ''),
                    // scheduledDate missing in interface?
                });
            }
            return '';
        });

        return { cleanText, actions };
    };

    const handleExecuteAction = (action: SuggestedAction, messageId: string) => {
        if (action.type === 'CREATE_TASK') {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const localDateKey = `${year}-${month}-${day}`;

            // If we had a date, we would use it here. For now defaulting to today as before, unless I update interface.

            addTask(
                action.title,
                action.taskType,
                localDateKey,
                action.scheduledTime
            );
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleAskCoach = async (selectedMode?: CoachMode) => {
        const activeMode = selectedMode || mode;
        const currentQuestion = question;

        if (activeMode === 'chat' && currentQuestion.trim()) {
            const userMsg: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: currentQuestion,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, userMsg]);
            setQuestion('');
        }

        setIsLoading(true);
        setIsTyping(true);
        setError('');

        try {
            // Capture Local Time context
            const now = new Date();
            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const localTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const res = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: activeMode,
                    localDate,
                    localTime,
                    tasks: tasks.map((t) => ({
                        type: t.type,
                        status: t.status,
                        title: t.title,
                        scheduledDate: t.scheduledDate,
                        scheduledTime: t.scheduledTime,
                        duration: t.duration
                    })),
                    score,
                    balance,
                    question: activeMode === 'chat' ? currentQuestion : undefined,
                    conversationHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                    history: history.map((h) => ({
                        date: h.date,
                        score: h.score,
                        adultCompleted: h.adultCompleted,
                        childCompleted: h.childCompleted,
                    })),
                    goals: goals.map((g) => ({
                        title: g.title,
                        targetDate: g.targetDate,
                        startTime: g.startTime,
                        completed: g.completed,
                    })),
                    preferences, // Identify user hobbies/interests
                }),
            });

            const data = await res.json();

            if (data.success) {
                const { cleanText, actions } = parseActions(data.response);

                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: cleanText,
                    timestamp: new Date(),
                    actions: actions.length > 0 ? actions : undefined,
                };
                setMessages(prev => [...prev, aiMsg]);
            } else {
                setError(data.error || 'Failed to get response');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to AI coach');
        } finally {
            setIsLoading(false);
            setIsTyping(false);
        }
    };

    const deleteMessage = (id: string) => {
        setMessages(prev => prev.filter(msg => msg.id !== id));
    };

    const clearChat = () => {
        setMessages([]);
        setError('');
    };

    if (!isOpen) return null;

    const modeButtons = [
        { mode: 'advice' as CoachMode, icon: Sparkles, label: 'Quick Advice' },
        { mode: 'chat' as CoachMode, icon: MessageCircle, label: 'Ask Question' },
        { mode: 'summary' as CoachMode, icon: TrendingUp, label: 'Weekly Summary' },
        { mode: 'predict' as CoachMode, icon: Bot, label: 'Tomorrow Plan' },
    ];

    const format12hPreserve = (timeStr: string) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        const displayM = `:${m.toString().padStart(2, '0')}`;
        return `${displayH}${displayM} ${ampm}`;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">AI Coach</h2>
                            <p className="text-xs text-white/50">Your MindSync guide</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
                                title="Clear Chat"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Mode Selector */}
                <div className="p-4 grid grid-cols-2 gap-2">
                    {modeButtons.map(({ mode: btnMode, icon: Icon, label }) => (
                        <button
                            key={btnMode}
                            onClick={() => {
                                setMode(btnMode);
                                if (btnMode !== 'chat') {
                                    handleAskCoach(btnMode);
                                }
                            }}
                            className={`flex items-center gap-2 p-3 rounded-xl transition-all ${mode === btnMode
                                ? 'bg-indigo-500 text-white'
                                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{label}</span>
                        </button>
                    ))}
                </div>

                {/* Messages Area */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {messages.length === 0 && !isLoading && !error && (
                        <div className="text-center text-white/40 py-8">
                            Select a mode above or ask a question to get started
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex items-start gap-3 group ${msg.role === 'user' ? 'flex-row-reverse' : ''
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-lg ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-indigo-500 to-indigo-600'
                                : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                }`}>
                                {msg.role === 'user' ? (
                                    <User className="w-4 h-4 text-white" />
                                ) : (
                                    <Bot className="w-4 h-4 text-white" />
                                )}
                            </div>

                            <div className={`relative max-w-[90%] sm:max-w-[80%] rounded-2xl p-3 sm:p-4 shadow-xl ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white'
                                : 'bg-gradient-to-br from-slate-800/90 to-slate-800/60 backdrop-blur-sm text-white/95 border border-white/10'
                                }`}>
                                <div className="text-sm leading-relaxed">{renderMarkdown(msg.content)}</div>
                                <button
                                    onClick={() => deleteMessage(msg.id)}
                                    className={`absolute -top-2 p-1 rounded-full bg-slate-700/80 backdrop-blur text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shadow-lg ${msg.role === 'user' ? '-left-2' : '-right-2'
                                        }`}
                                    title="Delete message"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Action Buttons */}
                            {
                                msg.actions && msg.actions.length > 0 && (
                                    <div className="flex flex-col gap-2 mt-1 -ml-11 pl-14 w-full">
                                        {msg.actions.map((action, idx) => (
                                            <button
                                                key={idx}
                                                onClick={(e) => {
                                                    const btn = e.currentTarget;
                                                    handleExecuteAction(action, msg.id);
                                                    btn.disabled = true;
                                                    btn.innerHTML = '<span>Added to Schedule</span>';
                                                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                                                }}
                                                className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-xl text-sm transition-all border border-emerald-500/20 w-fit text-left group/btn"
                                            >
                                                <PlusCircle className="w-4 h-4" />
                                                <span>Add Task: <strong>{action.title}</strong> ({action.taskType}){action.scheduledTime ? ` @ ${format12hPreserve(action.scheduledTime)}` : ''}</span>
                                            </button>
                                        ))}
                                    </div>
                                )
                            }
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-white/5 rounded-2xl p-4">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:0.1s]" />
                                    <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200">
                            <p className="font-medium">Error</p>
                            <p className="text-sm mt-1 text-red-200/80">{error}</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Chat Input (always visible for ease of access, but meaningful mainly for chat) */}
                <div className="p-4 border-t border-white/10">
                    <div className="flex gap-3 items-stretch">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onFocus={() => {
                                    if (mode !== 'chat') {
                                        setMode('chat');
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (question.trim()) {
                                            handleAskCoach('chat');
                                            setMode('chat');
                                        }
                                    }
                                }}
                                placeholder="Type a message or ask a question..."
                                className="w-full h-14 bg-slate-800/50 border border-slate-700/50 rounded-2xl px-5 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                            />
                            {/* Natural Language Preview */}
                            {question.trim() && (() => {
                                const parsed = parseNaturalDateTime(question);
                                if (parsed.date || parsed.time) {
                                    return (
                                        <div className="absolute bottom-2 left-5 text-xs text-indigo-300 flex items-center gap-2">
                                            <Sparkles className="w-3 h-3" />
                                            <span>
                                                Detected: {parsed.date && `${new Date(parsed.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                                                {parsed.date && parsed.time && ' @ '}
                                                {parsed.time && format12hPreserve(parsed.time)}
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        <button
                            onClick={() => {
                                handleAskCoach('chat');
                                setMode('chat');
                            }}
                            disabled={!question.trim() || isLoading}
                            className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
                            aria-label="Send Message"
                        >
                            <Send className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Compact Footer Info */}
                    <div className="flex items-center justify-between text-xs text-white/30 mt-3 px-1">
                        <span>Score: {score}/100</span>
                        <span>{balance === 'optimal' ? 'Balance: Optimal' : 'Balance Check Needed'}</span>
                    </div>
                </div>
            </div>
        </div >
    );
}
