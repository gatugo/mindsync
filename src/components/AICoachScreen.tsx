'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { X, Send, Bot, Sparkles, TrendingUp, MessageCircle, Trash2, User, PlusCircle, CheckCircle2, RotateCw } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Task, DailySnapshot, Goal, TaskType } from '@/types';
import { parseNaturalDateTime, format12h } from '@/lib/datePatterns';

interface AICoachScreenProps {
    tasks: Task[];
    score: number;
    balance: string;
    history: DailySnapshot[];
    goals: Goal[];
    initialMode?: CoachMode;
    onClose?: () => void;
}

type CoachMode = 'advice' | 'chat' | 'summary' | 'predict';

interface SuggestedAction {
    type: 'CREATE_TASK';
    title: string;
    taskType: TaskType;
    duration: number;
    scheduledDate?: string;
    scheduledTime?: string;
    projectedScore?: number; // Predicted impact on Ego Score (+5, -3, etc.)
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
    initialMode = 'advice',
    onClose
}: AICoachScreenProps) {
    const [mode, setMode] = useState<CoachMode>(initialMode);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const addTask = useStore((state) => state.addTask);
    const preferences = useStore((state) => state.preferences);
    const hasAutoTriggered = useRef(false);

    // Sync mode with initialMode
    useEffect(() => {
        if (initialMode) setMode(initialMode);
    }, [initialMode]);

    // Auto-trigger on mount or mode change from outside
    useEffect(() => {
        if (initialMode && initialMode !== 'advice' && !hasAutoTriggered.current) {
            handleAskCoach(initialMode);
            hasAutoTriggered.current = true;
        }
    }, [initialMode]);

    const handleSuggestAnother = (action: SuggestedAction) => {
        const prompt = `I'd like another suggestion for "${action.title}". Provide an alternative task of type ${action.taskType} that would fit my schedule for ${action.scheduledDate || 'today'}.`;
        setQuestion(prompt);
        handleAskCoach('chat');
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Simple Markdown Renderer for AI responses
    const renderMarkdown = (text: string): ReactNode => {
        const paragraphs = text.split(/\n\n+/);
        return paragraphs.map((paragraph, pIdx) => {
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

            return (
                <p key={pIdx} className="mb-3 last:mb-0">
                    {renderInlineMarkdown(paragraph)}
                </p>
            );
        });
    };

    const renderInlineMarkdown = (text: string): ReactNode => {
        const parts: ReactNode[] = [];
        let lastIndex = 0;
        const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\`(.+?)\`)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            if (match[1]) parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>);
            else if (match[3]) parts.push(<em key={match.index} className="italic">{match[4]}</em>);
            else if (match[5]) parts.push(<code key={match.index} className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 text-xs">{match[6]}</code>);
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) parts.push(text.slice(lastIndex));
        return parts.length > 0 ? parts : text;
    };

    // Unified Parser for Thought and Actions
    const parseResponse = (text: string): { cleanText: string; actions: SuggestedAction[]; thought?: string } => {
        let cleanText = text;
        let thought: string | undefined;

        // 1. Extract Thought
        const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/;
        const thoughtMatch = cleanText.match(thoughtRegex);
        if (thoughtMatch) {
            thought = thoughtMatch[1].trim();
            cleanText = cleanText.replace(thoughtRegex, '').trim();
        }

        // 2. Extract Actions
        const actions: SuggestedAction[] = [];
        const actionRegex = /\[ACTION: CREATE_TASK \| ([^\]]+)\]/gi;
        cleanText = cleanText.replace(actionRegex, (match, content) => {
            const parts = content.split('|').map((p: string) => p.trim());
            if (parts.length >= 4) {
                let projectedScore: number | undefined;
                const lastPart = parts[parts.length - 1];
                if (/^[+-]\d+$/.test(lastPart)) {
                    projectedScore = parseInt(lastPart);
                    parts.pop();
                }

                actions.push({
                    type: 'CREATE_TASK',
                    title: parts[0],
                    taskType: parts[1] as TaskType,
                    duration: parseInt(parts[2]) || 30,
                    scheduledDate: parts.length >= 5 ? parts[3] : undefined,
                    scheduledTime: parts.length >= 5 ? parts[4] : parts[3],
                    projectedScore,
                });
            }
            return '';
        });

        return { cleanText, actions, thought };
    };

    const handleExecuteAction = (action: SuggestedAction, messageId: string) => {
        if (action.type === 'CREATE_TASK') {
            const now = new Date();
            const localDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            addTask(
                action.title,
                action.taskType,
                action.scheduledDate || localDateKey,
                action.scheduledTime,
                action.duration
            );
        }
    };

    const handleAskCoach = async (selectedMode?: CoachMode) => {
        // ... (existing setup code stays same, just updated the parsing call below)
        const activeMode = selectedMode || mode;
        const currentQuestion = question;

        if (activeMode === 'chat' && currentQuestion.trim()) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: currentQuestion, timestamp: new Date() }]);
            setQuestion('');
        }

        setIsLoading(true);
        setIsTyping(true);
        setError('');

        try {
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
                    tasks: tasks.map(t => ({ type: t.type, status: t.status, title: t.title, scheduledDate: t.scheduledDate, scheduledTime: t.scheduledTime, duration: t.duration })),
                    score,
                    balance,
                    question: activeMode === 'chat' ? currentQuestion : undefined,
                    conversationHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                    history: history.map(h => ({ date: h.date, score: h.score, adultCompleted: h.adultCompleted, childCompleted: h.childCompleted })),
                    goals: goals.map(g => ({ title: g.title, targetDate: g.targetDate, startTime: g.startTime, completed: g.completed })),
                    preferences,
                }),
            });

            if (!res.body) throw new Error('No stream body');
            const aiMsgId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date() }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                
                // Real-time update (raw text for now, parsed at end to prevent flickering)
                setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: fullText } : msg));
            }

            // Final Parse
            const { cleanText, actions, thought } = parseResponse(fullText);
            setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: cleanText, actions: actions.length > 0 ? actions : undefined, thought } : msg));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to AI coach');
        } finally {
            setIsLoading(false);
            setIsTyping(false);
        }
    };

    const deleteMessage = (id: string) => setMessages(prev => prev.filter(msg => msg.id !== id));
    const clearChat = () => { setMessages([]); setError(''); };

    const modeButtons = [
        { mode: 'chat' as CoachMode, icon: MessageCircle, label: 'Chat' },
        { mode: 'advice' as CoachMode, icon: Sparkles, label: 'Advice' },
        { mode: 'summary' as CoachMode, icon: TrendingUp, label: 'Summary' },
        { mode: 'predict' as CoachMode, icon: Bot, label: 'Plan' },
    ];

    return (
        <div className="h-full flex flex-col bg-slate-900 overflow-hidden text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/10">
                        <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="font-bold text-white text-sm leading-none mb-0.5">AI Coach</h2>
                        <div className="flex items-center gap-1.5 text-[9px] text-white/40 uppercase tracking-wider font-bold">
                            <span>{score}</span>
                            <span>•</span>
                            <span className={balance === 'optimal' ? 'text-emerald-500/70' : 'text-amber-500/70'}>{balance}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                        <button onClick={clearChat} className="p-2.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-red-400 transition-all active:scale-90" title="Clear Chat">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90 flex items-center justify-center" title="Exit Coach">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Mode Selector */}
            <div className="px-4 py-3 shrink-0 bg-slate-900/50 backdrop-blur-sm z-10">
                <div className="flex bg-slate-950/50 p-1 rounded-2xl border border-white/5 relative overflow-hidden">
                    {modeButtons.map(({ mode: btnMode, icon: Icon, label }) => {
                        const isActive = mode === btnMode;
                        return (
                            <button
                                key={btnMode}
                                onClick={() => { setMode(btnMode); if (btnMode !== 'chat') handleAskCoach(btnMode); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 relative z-10 ${isActive ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {isActive && (
                                    <div className="absolute inset-0 bg-indigo-600 rounded-xl -z-10 animate-in zoom-in-95 duration-200 shadow-indigo-500/20 shadow-lg border border-indigo-400/20" />
                                )}
                                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-100' : ''}`} />
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 px-2 py-0 overflow-y-auto space-y-3 custom-scrollbar scroll-smooth">
                {messages.length === 0 && !isLoading && !error && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-40 animate-in fade-in zoom-in-95 duration-500">
                        <Sparkles className="w-12 h-12 mb-4 text-indigo-400" />
                        <p className="text-sm font-medium">Ready to optimize your day.<br />Select a mode or ask anything.</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-lg border border-white/10 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-gradient-to-br from-purple-600 to-indigo-600'}`}>
                                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>
                            <div className={`relative max-w-[85%] rounded-2xl p-4 shadow-xl backdrop-blur-md border ${msg.role === 'user' ? 'bg-indigo-500/20 border-indigo-500/30 text-white' : 'bg-slate-800/60 border-white/10 text-white/95'}`}>
                                <div className="text-sm leading-relaxed">{renderMarkdown(msg.content)}</div>
                                <button onClick={() => deleteMessage(msg.id)} className={`absolute -top-2 p-1 rounded-full bg-slate-800 border border-white/10 text-white/40 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 ${msg.role === 'user' ? '-left-2' : '-right-2'}`} title="Delete"><X className="w-3 h-3" /></button>
                            </div>
                        </div>

                        {msg.actions && (
                            <div className={`${msg.role === 'user' ? 'mr-11' : 'ml-11'} space-y-3`}>
                                {msg.actions.map((action, idx) => {
                                    const colors = action.taskType === 'CHILD' ? { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', emoji: '🩷' } : { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', emoji: '🔵' };
                                    return (
                                        <div key={idx} className={`${colors.bg} ${colors.border} border rounded-2xl p-4 shadow-lg overflow-hidden backdrop-blur-sm hover:translate-y-[-2px] transition-all duration-300`}>
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-sm flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span>{colors.emoji}</span>
                                                            <span>{action.title}</span>
                                                        </div>
                                                        
                                                        {/* Time Capsule Badge */}
                                                        {(action.scheduledTime || action.scheduledDate) && (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/40 border border-white/10 shrink-0">
                                                                <span className="text-[10px] font-bold text-white/90">
                                                                    📅 {(() => {
                                                                        if (!action.scheduledDate) return 'Today';
                                                                        const d = new Date(action.scheduledDate + 'T12:00:00');
                                                                        const now = new Date();
                                                                        const isToday = d.toDateString() === now.toDateString();
                                                                        const tomorrow = new Date();
                                                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                                                        const isTomorrow = d.toDateString() === tomorrow.toDateString();

                                                                        if (isToday) return 'Today';
                                                                        if (isTomorrow) return 'Tomorrow';
                                                                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                                    })()}
                                                                    {action.scheduledTime ? `, ${format12h(action.scheduledTime)}` : ''}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </h4>
                                                    
                                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${colors.text} mt-2 flex items-center gap-2 opacity-80 pl-7`}>
                                                        <span>{action.taskType}</span>
                                                        <span>•</span>
                                                        <span>{action.duration} min</span>
                                                        {action.projectedScore && (
                                                            <>
                                                                <span>•</span>
                                                                <span className={`${action.projectedScore > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {action.projectedScore > 0 ? '+' : ''}{action.projectedScore} Ego Score
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        handleExecuteAction(action, msg.id);
                                                        const btn = e.currentTarget;
                                                        btn.disabled = true;
                                                        btn.innerHTML = '<span>Added to Timeline</span>';
                                                        btn.className = "flex-1 bg-emerald-500/20 text-emerald-400 py-2.5 rounded-xl text-xs font-bold border border-emerald-500/20 cursor-default";
                                                    }}
                                                    className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 border border-white/10 active:scale-95"
                                                >
                                                    <PlusCircle className="w-4 h-4" />
                                                    Add to Timeline
                                                </button>
                                                <button
                                                    onClick={() => handleSuggestAnother(action)}
                                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-white/10 active:scale-95"
                                                >
                                                    <RotateCw className="w-3.5 h-3.5" />
                                                    Suggest Another
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
                    <div className="flex items-center gap-3 ml-11 animate-in fade-in duration-300">
                        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-4 border border-white/5 shadow-xl">
                            <div className="flex gap-1.5">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-[bounce_1s_infinite]" />
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-[bounce_1s_infinite_0.2s]" />
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_0.4s]" />
                            </div>
                        </div>
                        <span className="text-xs text-white/30 font-medium animate-pulse">Thinking...</span>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Wrapper */}
            <div className="px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] border-t border-white/10 bg-slate-900/80 backdrop-blur-xl shrink-0">
                <div className="flex gap-2 items-center max-w-4xl mx-auto">
                    <div className="flex-1 relative group">
                        <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl blur transition-opacity opacity-0 group-focus-within:opacity-100" />
                        <textarea
                            rows={1}
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onFocus={() => mode !== 'chat' && setMode('chat')}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (question.trim()) { handleAskCoach('chat'); setMode('chat'); } } }}
                            placeholder="Ask MindSync..."
                            className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-4 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-950/80 transition-all resize-none shadow-inner custom-scrollbar relative z-10"
                        />
                    </div>
                    <button
                        onClick={() => { handleAskCoach('chat'); setMode('chat'); }}
                        disabled={!question.trim() || isLoading}
                        className="h-[36px] w-[36px] rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center shrink-0 border border-white/10"
                    >
                        <Send className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
