'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { X, Send, Bot, Sparkles, TrendingUp, MessageCircle, Trash2, User, PlusCircle, CheckCircle2, RotateCw } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Task, DailySnapshot, Goal, TaskType } from '@/types';
import { parseNaturalDateTime, format12h } from '@/lib/datePatterns';

interface AICoachModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    score: number;
    balance: string;
    history: DailySnapshot[];
    goals: Goal[];
    initialMode?: CoachMode;
}

type CoachMode = 'advice' | 'chat' | 'summary' | 'predict';

interface SuggestedAction {
    type: 'CREATE_TASK';
    title: string;
    taskType: TaskType;
    duration: number;
    scheduledDate?: string;
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
    initialMode = 'advice'
}: AICoachModalProps) {
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

    useEffect(() => {
        if (isOpen && initialMode) setMode(initialMode);
    }, [isOpen, initialMode]);

    useEffect(() => {
        if (isOpen && initialMode && initialMode !== 'advice' && !hasAutoTriggered.current) {
            handleAskCoach(initialMode);
            hasAutoTriggered.current = true;
        }
    }, [isOpen, initialMode]);

    const handleSuggestAnother = (action: SuggestedAction) => {
        const prompt = `I'd like another suggestion for "${action.title}". Provide an alternative task of type ${action.taskType} that would fit my schedule for ${action.scheduledDate || 'today'}.`;
        setQuestion(prompt);
        handleAskCoach('chat');
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const clearChat = () => {
        setMessages([]);
        setError('');
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isLoading, isOpen]);

    const renderMarkdown = (text: string): ReactNode => {
        const paragraphs = text.split(/\n\n+/);
        return paragraphs.map((paragraph, pIdx) => {
            const lines = paragraph.split('\n');
            const isBulletList = lines.every(line => line.trim() === '' || /^[-*•]\s/.test(line.trim()));
            if (isBulletList) {
                const listItems = lines.filter(line => /^[-*•]\s/.test(line.trim()));
                return (
                    <ul key={pIdx} className="list-disc list-inside space-y-1 my-2">
                        {listItems.map((item, idx) => (
                            <li key={idx} className="text-white/90">{renderInlineMarkdown(item.replace(/^[-*•]\s+/, ''))}</li>
                        ))}
                    </ul>
                );
            }
            return <p key={pIdx} className="mb-3 last:mb-0">{renderInlineMarkdown(paragraph)}</p>;
        });
    };

    const renderInlineMarkdown = (text: string): ReactNode => {
        const parts: ReactNode[] = [];
        let lastIndex = 0;
        const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\`(.+?)\`)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
            if (match[1]) parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>);
            else if (match[3]) parts.push(<em key={match.index} className="italic">{match[4]}</em>);
            else if (match[5]) parts.push(<code key={match.index} className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 text-xs">{match[6]}</code>);
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) parts.push(text.slice(lastIndex));
        return parts.length > 0 ? parts : text;
    };

    const parseActions = (text: string): { cleanText: string; actions: SuggestedAction[] } => {
        const actions: SuggestedAction[] = [];
        const actionRegex = /\[ACTION: CREATE_TASK \| (.*?)\]/gi;
        const cleanText = text.replace(actionRegex, (match, content) => {
            const parts = content.split('|').map((p: string) => p.trim());
            if (parts.length >= 4) {
                actions.push({
                    type: 'CREATE_TASK',
                    title: parts[0],
                    taskType: parts[1] as TaskType,
                    duration: parseInt(parts[2]) || 30,
                    scheduledDate: parts.length === 6 ? parts[4] : (parts.length === 5 ? parts[3] : undefined),
                    scheduledTime: parts.length === 6 ? parts[5] : (parts.length === 5 ? parts[4] : parts[3]),
                });
            }
            return '';
        });
        return { cleanText, actions };
    };

    const handleExecuteAction = (action: SuggestedAction, messageId: string) => {
        if (action.type === 'CREATE_TASK') {
            const now = new Date();
            addTask(action.title, action.taskType, action.scheduledDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, action.scheduledTime, action.duration);
        }
    };

    const handleAskCoach = async (selectedMode?: CoachMode) => {
        const activeMode = selectedMode || mode;
        if (activeMode === 'chat' && question.trim()) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: question, timestamp: new Date() }]);
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
                body: JSON.stringify({ mode: activeMode, localDate, localTime, tasks, score, balance, question: activeMode === 'chat' ? question : undefined, conversationHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })), history, goals, preferences }),
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
                fullText += decoder.decode(value, { stream: true });
                setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: fullText } : msg));
            }
            const { cleanText, actions } = parseActions(fullText);
            setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: cleanText, actions: actions.length > 0 ? actions : undefined } : msg));
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
        finally { setIsLoading(false); setIsTyping(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="bg-slate-900 w-full h-[95vh] sm:h-auto sm:max-h-[85vh] sm:max-w-3xl rounded-t-[2rem] sm:rounded-3xl border border-white/10 shadow-2xl shadow-indigo-500/10 flex flex-col overflow-hidden transition-all animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0 bg-slate-900/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10"><Bot className="w-6 h-6 text-white" /></div>
                        <div>
                            <h2 className="font-bold text-white text-lg sm:text-xl tracking-tight">AI Coach</h2>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">MindSync Guide</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {messages.length > 0 && <button onClick={clearChat} className="p-2 sm:p-2.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors" title="Clear Chat"><Trash2 className="w-5 h-5" /></button>}
                        <button onClick={onClose} className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-sm" title="Close"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Modes */}
                <div className="p-2 sm:p-3 grid grid-cols-4 gap-2 border-b border-white/5 bg-slate-800/30">
                    {[
                        { mode: 'chat', icon: MessageCircle, label: 'Chat' },
                        { mode: 'advice', icon: Sparkles, label: 'Advice' },
                        { mode: 'summary', icon: TrendingUp, label: 'Stats' },
                        { mode: 'predict', icon: Bot, label: 'Plan' }
                    ].map((btn) => (
                        <button key={btn.mode} onClick={() => { setMode(btn.mode as CoachMode); if (btn.mode !== 'chat') handleAskCoach(btn.mode as CoachMode); }} className={`flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-xl transition-all ${mode === btn.mode ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                            <btn.icon className="w-5 h-5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">{btn.label}</span>
                        </button>
                    ))}
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 sm:space-y-8 custom-scrollbar bg-slate-900/50">
                    {messages.map((msg) => (
                        <div key={msg.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className={`flex items-start gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-md ${msg.role === 'user' ? 'bg-indigo-600 ring-2 ring-indigo-500/30' : 'bg-gradient-to-br from-purple-600 to-indigo-600 ring-2 ring-purple-500/30'}`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                                </div>
                                <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 shadow-xl text-sm sm:text-base leading-relaxed ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border border-indigo-400/20' : 'bg-slate-800/80 backdrop-blur-md border border-white/10 text-white/90'}`}>
                                    {renderMarkdown(msg.content)}
                                </div>
                            </div>
                            {msg.actions && (
                                <div className="ml-11 sm:ml-14 space-y-3">
                                    {msg.actions.map((action, idx) => (
                                        <div key={idx} className="bg-slate-800/50 border border-white/10 rounded-2xl p-4 hover:border-indigo-500/30 transition-all group">
                                            <div className="flex justify-between items-start gap-4 mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${action.taskType === 'CHILD' ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                        {action.taskType === 'CHILD' ? '🩷' : '🔵'}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm sm:text-base">{action.title}</h4>
                                                        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5 font-medium">
                                                            <span>{action.taskType}</span>
                                                            <span>•</span>
                                                            <span>{format12h(action.scheduledTime || '')}</span>
                                                            <span>•</span>
                                                            <span>{action.duration}m</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { handleExecuteAction(action, msg.id); e.currentTarget.disabled = true; e.currentTarget.textContent = 'Added to Schedule'; e.currentTarget.className = "flex-1 bg-green-500/20 text-green-400 border border-green-500/30 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-default"; }} className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-indigo-400/20 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                                    <PlusCircle className="w-4 h-4" /> Add to Timeline
                                                </button>
                                                <button onClick={() => handleSuggestAnother(action)} className="px-4 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-white/5 transition-all flex items-center gap-2">
                                                    <RotateCw className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3 sm:gap-4 animate-pulse">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white/20" />
                            </div>
                            <div className="bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-white/5">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input */}
                <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-900 shrink-0 pb-8 sm:pb-5">
                    <div className="flex gap-3 relative">
                        <input 
                            value={question} 
                            onChange={e => setQuestion(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleAskCoach('chat')}
                            onFocus={() => mode !== 'chat' && setMode('chat')} 
                            placeholder="Ask for advice, insights, or help planning..." 
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl pl-5 pr-14 py-3.5 sm:py-4 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-800 transition-all placeholder:text-white/20" 
                        />
                        <button 
                            onClick={() => handleAskCoach('chat')} 
                            disabled={!question.trim() || isLoading}
                            className={`absolute right-2 top-1.5 bottom-1.5 aspect-square rounded-xl flex items-center justify-center transition-all ${question.trim() && !isLoading ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95' : 'bg-white/5 text-white/20'}`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
