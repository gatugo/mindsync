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
            const parts = content.split('|').map(p => p.trim());
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20"><Bot className="w-6 h-6 text-white" /></div>
                        <div>
                            <h2 className="font-bold text-white text-lg">AI Coach</h2>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">MindSync Guide</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {messages.length > 0 && <button onClick={clearChat} className="p-2.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-red-400"><Trash2 className="w-5 h-5" /></button>}
                        <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Modes */}
                <div className="p-3 grid grid-cols-4 gap-1.5 border-b border-white/5 bg-slate-800/20">
                    {[
                        { mode: 'chat', icon: MessageCircle, label: 'Chat' },
                        { mode: 'advice', icon: Sparkles, label: 'Advice' },
                        { mode: 'summary', icon: TrendingUp, label: 'Stats' },
                        { mode: 'predict', icon: Bot, label: 'Plan' }
                    ].map((btn) => (
                        <button key={btn.mode} onClick={() => { setMode(btn.mode as CoachMode); if (btn.mode !== 'chat') handleAskCoach(btn.mode as CoachMode); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${mode === btn.mode ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>
                            <btn.icon className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase">{btn.label}</span>
                        </button>
                    ))}
                </div>

                {/* Messages */}
                <div className="flex-1 p-5 overflow-y-auto space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className="space-y-4">
                            <div className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-purple-600'}`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                </div>
                                <div className={`max-w-[85%] rounded-2xl p-4 shadow-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-800 border border-white/10 text-white/95'}`}>
                                    {renderMarkdown(msg.content)}
                                </div>
                            </div>
                            {msg.actions && (
                                <div className="ml-11 space-y-3">
                                    {msg.actions.map((action, idx) => (
                                        <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                            <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                                                <span>{action.taskType === 'CHILD' ? '🩷' : '🔵'}</span>
                                                <span>{action.title}</span>
                                            </h4>
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { handleExecuteAction(action, msg.id); e.currentTarget.disabled = true; e.currentTarget.innerHTML = 'Added'; }} className="flex-1 bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold border border-white/10">Add to Timeline</button>
                                                <button onClick={() => handleSuggestAnother(action)} className="flex-1 bg-white/5 text-white/70 py-2 rounded-xl text-xs font-bold border border-white/10">Another</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input */}
                <div className="p-5 border-t border-white/10 bg-slate-900">
                    <div className="flex gap-3">
                        <input value={question} onChange={e => setQuestion(e.target.value)} onFocus={() => mode !== 'chat' && setMode('chat')} placeholder="Type a message..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={() => handleAskCoach('chat')} className="h-12 w-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20"><Send className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
