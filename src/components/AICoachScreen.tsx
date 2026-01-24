'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { X, Send, Bot, Sparkles, TrendingUp, MessageCircle, Trash2, User, PlusCircle, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Task, DailySnapshot, Goal, TaskType } from '@/types';
import { parseNaturalDateTime, format12h } from '@/lib/datePatterns';

interface AICoachScreenProps {
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
    scheduledDate?: string; // YYYY-MM-DD
    scheduledTime?: string; // HH:MM (24h or 12h)
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: SuggestedAction[];
}

export default function AICoachScreen({
    tasks,
    score,
    balance,
    history,
    goals,
}: AICoachScreenProps) {
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
    const _deprecated_parseNaturalDateTime = (input: string): { date?: string; time?: string } => {
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
        } else if (clean.match(/in\s+(\d+)\s+hours?/)) {
            const hours = parseInt(clean.match(/in\s+(\d+)\s+hours?/)![1]);
            targetDate.setHours(targetDate.getHours() + hours);
            if (!targetTime) {
                targetTime = `${targetDate.getHours().toString().padStart(2, '0')}:${targetDate.getMinutes().toString().padStart(2, '0')}`;
            }
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



    const parseActions = (text: string): { cleanText: string; actions: SuggestedAction[] } => {
        const actions: SuggestedAction[] = [];
        // Capture everything inside the brackets to parse manually
        const actionRegex = /\[ACTION: CREATE_TASK \| (.*?)\]/gi;

        const cleanText = text.replace(actionRegex, (match, content) => {
            const parts = content.split('|').map((p: string) => p.trim());

            // Format 1: [Title | Type | Duration | Time] (Legacy) - 4 parts
            // Format 2: [Title | Type | Duration | Date | Time] (New) - 5 parts

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
                    // Legacy: parts[3] is time
                    time = parts[3];
                }

                actions.push({
                    type: 'CREATE_TASK',
                    title,
                    taskType: type,
                    duration,
                    scheduledDate: date === 'any' ? undefined : date,
                    scheduledTime: parseNaturalDateTime(time || '').time,
                });
            }
            return '';
        });

        return { cleanText, actions };
    };

    const handleExecuteAction = (action: SuggestedAction, messageId: string) => {
        if (action.type === 'CREATE_TASK') {
            // Use the AI-suggested date, or fallback to today (local)
            let targetDate = action.scheduledDate;

            if (!targetDate) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                targetDate = `${year}-${month}-${day}`;
            }

            addTask(
                action.title,
                action.taskType,
                targetDate,
                action.scheduledTime,
                action.duration
            );
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleAskCoach = async (selectedMode?: CoachMode) => {
        const activeMode = selectedMode || mode;
        const currentQuestion = question;

        // Add user message if searching/chatting
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
                    localDate, // Sending local context
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
                    preferences,
                }),
            });

            if (!res.body) throw new Error('No stream body');

            // Initialize empty AI message
            const aiMsgId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, {
                id: aiMsgId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
            }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;

                // Update specific message in place
                setMessages(prev => prev.map(msg =>
                    msg.id === aiMsgId
                        ? { ...msg, content: fullText }
                        : msg
                ));
            }

            // Post-processing: Parse Actions after stream completes
            const { cleanText, actions } = parseActions(fullText);
            setMessages(prev => prev.map(msg =>
                msg.id === aiMsgId
                    ? { ...msg, content: cleanText, actions: actions.length > 0 ? actions : undefined }
                    : msg
            ));

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



    const modeButtons = [
        { mode: 'chat' as CoachMode, icon: MessageCircle, label: 'Chat' },
        { mode: 'advice' as CoachMode, icon: Sparkles, label: 'Advice' },
        { mode: 'summary' as CoachMode, icon: TrendingUp, label: 'Summary' },
        { mode: 'predict' as CoachMode, icon: Bot, label: 'Plan' },
    ];



    return (
        <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-white">AI Coach</h2>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                            <span>Score: {score}</span>
                            <span>•</span>
                            <span>{balance === 'optimal' ? 'Optimal' : 'Check Balance'}</span>
                        </div>
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
                </div>
            </div>

            {/* Mode Selector - Single row */}
            <div className="px-3 py-2 flex justify-center gap-1.5 shrink-0 border-b border-white/5">
                {modeButtons.map(({ mode: btnMode, icon: Icon, label }) => (
                    <button
                        key={btnMode}
                        onClick={() => {
                            setMode(btnMode);
                            if (btnMode !== 'chat') {
                                handleAskCoach(btnMode);
                            }
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap text-xs font-semibold ${mode === btnMode
                            ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                            }`}
                    >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
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
                    <div key={msg.id} className="space-y-2">
                        {/* Message Row */}
                        <div className={`flex items-start gap-3 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
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

                            <div className={`relative flex-1 max-w-[calc(100%-3rem)] rounded-2xl p-3 sm:p-4 shadow-xl ${msg.role === 'user'
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
                        </div>

                        {/* Action Cards - BELOW the message */}
                        {msg.actions && msg.actions.length > 0 && (
                            <div className="ml-11 space-y-2">
                                {msg.actions.map((action, idx) => {
                                    const typeColors = {
                                        ADULT: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', emoji: '🔵' },
                                        CHILD: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', emoji: '🩷' },
                                        REST: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', emoji: '🟢' },
                                    };
                                    const colors = typeColors[action.taskType] || typeColors.ADULT;
                                    return (
                                        <div
                                            key={idx}
                                            className={`${colors.bg} ${colors.border} border rounded-xl p-3 transition-all hover:scale-[1.01]`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-white text-sm">
                                                        {colors.emoji} {action.title}
                                                    </div>
                                                    <div className={`text-xs ${colors.text} mt-0.5 flex items-center gap-2 flex-wrap`}>
                                                        <span className="uppercase font-medium">{action.taskType}</span>
                                                        {action.duration && (
                                                            <>
                                                                <span className="text-white/30">•</span>
                                                                <span>{action.duration}min</span>
                                                            </>
                                                        )}
                                                        {action.scheduledDate && (
                                                            <>
                                                                <span className="text-white/30">•</span>
                                                                <span className="font-medium text-white/90">
                                                                    {new Date(action.scheduledDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                </span>
                                                            </>
                                                        )}
                                                        {action.scheduledTime && (
                                                            <>
                                                                <span className="text-white/30">@</span>
                                                                <span className="font-medium text-white/90">{format12h(action.scheduledTime)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        const btn = e.currentTarget;
                                                        handleExecuteAction(action, msg.id);
                                                        btn.disabled = true;
                                                        btn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
                                                        btn.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
                                                        btn.classList.add('bg-emerald-500', 'cursor-not-allowed');
                                                    }}
                                                    className="shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-500/20"
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
            <div className="px-4 pt-4 pb-2 border-t border-white/10">
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
                                            Detected: {parsed.date && `${new Date(parsed.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                                            {parsed.date && parsed.time && ' @ '}
                                            {parsed.time && format12h(parsed.time)}
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


            </div>
        </div>
    );
}
