import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { COACH_SYSTEM_PROMPT } from '@/lib/aiPrompts';
import { z } from 'zod';

// ============ SECURITY: Rate Limiting ============
const REQUESTS_PER_MINUTE = 15; // Increased for Gemini free tier
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitMap.get(ip) || { count: 0, resetTime: now + 60 * 1000 };

    if (userLimit.resetTime < now) {
        userLimit.count = 0;
        userLimit.resetTime = now + 60 * 1000;
    }

    if (userLimit.count >= REQUESTS_PER_MINUTE) return true;

    userLimit.count++;
    rateLimitMap.set(ip, userLimit);
    return false;
}

// ============ SECURITY: Input Validation ============
const CoachRequestSchema = z.object({
    mode: z.string(),
    tasks: z.array(z.any()).optional(),
    score: z.number().optional(),
    balance: z.string().optional(),
    question: z.string().optional(),
    taskTitle: z.string().optional(),
    history: z.array(z.any()).optional(),
    goals: z.array(z.any()).optional(),
    preferences: z.any().optional(),
    conversationHistory: z.array(z.any()).optional(),
    localDate: z.string().optional(),
    localTime: z.string().optional()
});

type CoachRequest = z.infer<typeof CoachRequestSchema>;

// ============ CORE LOGIC: Context Builders (Kept from original) ============
function format12h(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12;
    const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
    return `${displayH}${displayM}${ampm}`;
}

function calculateFreeSlots(tasks: CoachRequest['tasks'], targetDate?: string, preferences?: any): string {
    if (!tasks || !targetDate) return 'Unknown';
    const todayTasks = tasks
        .filter(t => t.scheduledDate === targetDate && t.scheduledTime && t.status !== 'DONE')
        .sort((a, b) => (a.scheduledTime! > b.scheduledTime! ? 1 : -1));

    const sleepStart = preferences?.sleepStartTime || '23:00';
    const sleepEnd = preferences?.sleepEndTime || '06:00';
    const [sH, sM] = sleepEnd.split(':').map(Number);
    const [eH, eM] = sleepStart.split(':').map(Number);
    const awakeStart = sH * 60 + sM;
    const awakeEnd = eH * 60 + eM;

    if (todayTasks.length === 0) {
        return awakeEnd > awakeStart 
            ? `All day (${format12h(awakeStart)} - ${format12h(awakeEnd)})` 
            : `All day (${format12h(awakeStart)} - 11:59pm AND 12am - ${format12h(awakeEnd)})`;
    }

    let currentTime = awakeStart;
    const slots = [];

    for (const task of todayTasks) {
        if (!task.scheduledTime) continue;
        const [hh, mm] = task.scheduledTime.split(':').map(Number);
        const taskStart = hh * 60 + mm;
        const taskDuration = task.duration || 30;
        const taskEnd = taskStart + taskDuration;

        if (taskStart < currentTime) {
            currentTime = Math.max(currentTime, taskEnd);
            continue;
        }
        if (taskStart > currentTime + 15) {
            slots.push(`${format12h(currentTime)} - ${format12h(taskStart)}`);
        }
        currentTime = Math.max(currentTime, taskEnd);
    }
    if (currentTime < awakeEnd - 15) {
        slots.push(`${format12h(currentTime)} - ${format12h(awakeEnd)}`);
    }
    return slots.length > 0 ? slots.join(', ') : 'None (Busy)';
}

function buildPrompt(request: CoachRequest): string {
    const { mode, tasks, score, balance, question, history, goals, preferences, taskTitle, conversationHistory, localDate, localTime } = request;
    const now = new Date();
    const currentTimeStr = localTime || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDateKey = localDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentDateDisplay = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const availableSlots = calculateFreeSlots(tasks, currentDateKey, preferences);

    const prefsStr = preferences ? `
- Hobbies: ${preferences.hobbies?.join(', ') || 'None'}
- Interests: ${preferences.interests?.join(', ') || 'None'}
- Passions: ${preferences.passions?.join(', ') || 'None'}` : '';

    const commonContext = `Current Context:
- Date: ${currentDateDisplay} (${currentDateKey})
- Time: ${currentTimeStr} (Local)
- Current Status:
    - Ego Score: ${score || 50}/100
    - Balance State: ${balance || 'neutral'}
    - Available Free Slots Today: ${availableSlots}
    ${tasks ? `- Completed Today: ${tasks.filter(t => t.status === 'DONE' && t.type === 'ADULT').length} Adult, ${tasks.filter(t => t.status === 'DONE' && t.type === 'CHILD').length} Child` : ''}
User Profile:${prefsStr}`;

    switch (mode) {
        case 'advice': return `${commonContext}\nGive me a 2-sentence personalized recommendation based on my current balance using MindSync terminology.`;
        case 'chat': {
            const historyStr = conversationHistory?.length ? '\n\nPrevious conversation:\n' + conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`).join('\n') : '';
            const todayTasksList = tasks ? tasks.filter(t => t.scheduledDate === currentDateKey) : [];
            const tasksStr = todayTasksList.length > 0 ? `Today's Tasks (${currentDateKey}): ${todayTasksList.map(t => `${t.title} (${t.type}${t.scheduledTime ? ` at ${t.scheduledTime}` : ''})`).join(', ')}` : "No tasks scheduled for today.";
            const historySummary = (history || []).slice(-7).map(h => `- ${h.date}: Score ${h.score}, Adult ${h.adultCompleted}, Child ${h.childCompleted}`).join('\n');
            return `${commonContext}\n${tasksStr}\n${historySummary ? `\nPast 7 Days History:\n${historySummary}\n` : ''}${goals ? `Active Goals: ${goals.map(g => `${g.title} (due ${g.targetDate})`).join(', ')}` : ''}${historyStr}

User question: ${question}

Answer helpfully as the "Ego" coach using specific MindSync insights.

// ACTION BLOCK FORMAT:
// [ACTION: CREATE_TASK | Title | Type (ADULT/CHILD/REST) | Duration in minutes | ScheduledDate (YYYY-MM-DD) | ScheduledTime (HH:MM)]
// IMPORTANT: Use 24-hour format for ScheduledTime (e.g., "17:00"). Use YYYY-MM-DD for dates.`; 
        }
        case 'summary': return `${commonContext}\nProvide a brief summary of my week's patterns and one key insight from the MindSync system.`;
        case 'predict': return `${commonContext}\nPROPOSE A PERFECT PLAN for the next 24 hours. Identify 2-3 high-impact tasks and schedule them.`;
        case 'schedule_assist': {
            const title = taskTitle || 'Untitled Task';
            return `You are a scheduling assistant. Given the task title below, analyze it and return ONLY a JSON object (no markdown, no explanation) with your suggestions.

Task Title: "${title}"

Current Context:
- Date: ${currentDateDisplay} (${currentDateKey})
- Time: ${currentTimeStr} (Local)
- Available Slots: ${availableSlots}

Instructions:
1. **Analyze Title**: Extract Task Type, Date, Time, Duration.
2. **Date**: If mentioned ("tomorrow"), return specific date. Else "${currentDateKey}".
3. **Time**: If mentioned, use it. Else suggest a slot.
4. **Duration**: Explicit or inferred (Gym=60, Call=30). Default 30.

Respond with ONLY this JSON format:
{"suggestedType": "ADULT", "suggestedDate": "YYYY-MM-DD", "suggestedTime": "HH:MM", "duration": 30}`;
        }
        default: return 'Give me general advice about maintaining mental balance.';
    }
}

// ============ PROVIDER 1: GEMINI STREAM ============
async function callGeminiStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    
    // Using gemini-2.0-flash-exp (or gemini-1.5-flash)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); 

    const result = await model.generateContentStream(prompt);

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        controller.enqueue(encoder.encode(chunkText));
                    }
                }
                controller.close();
            } catch (err) {
                console.error('[Gemini] Stream Error:', err);
                controller.error(err);
            }
        },
    });
    return stream;
}

// ============ PROVIDER 2: GROQ STREAM (BACKUP) ============
async function callGroqStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: COACH_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
    });

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            for await (const chunk of completion) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) controller.enqueue(encoder.encode(content));
            }
            controller.close();
        },
    });
    return stream;
}

// ============ JSON HANDLERS ============
async function callGeminiJSON(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" } 
    });
    const result = await model.generateContent([COACH_SYSTEM_PROMPT, "Respond with valid JSON.", prompt]);
    return result.response.text();
}

async function callGroqJSON(prompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: COACH_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500
    });
    return completion.choices[0]?.message?.content || '{}';
}


// ============ MAIN HANDLER with HYBRID LOGIC ============
export async function POST(req: NextRequest) {
    // 1. Check Rate Limit
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    if (isRateLimited(ip)) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });

    try {
        const rawBody = await req.json();
        
        // MOCK MODE Check
        if (process.env.MOCK_AI === 'true') {
             // ... Mock Logic (Simplified for brevity, or kept if needed. For now assuming real)
        }

        const body = CoachRequestSchema.parse(rawBody);
        const prompt = buildPrompt(body);

        // --- JSON MODE (Schedule Assist) ---
        if (body.mode === 'schedule_assist') {
            try {
                // Try Gemini First
                console.log('🤖 Attempting Gemini JSON...');
                const json = await callGeminiJSON(prompt);
                return NextResponse.json({ success: true, response: json });
            } catch (err) {
                console.error('⚠️ Gemini JSON Failed:', err);
                // Fallback Groq
                try {
                    console.log('🔄 Swapping to Groq JSON...');
                    const json = await callGroqJSON(prompt);
                    return NextResponse.json({ success: true, response: json });
                } catch (groqErr) {
                    return NextResponse.json({ success: false, error: 'All AI services busy' }, { status: 503 });
                }
            }
        } 
        
        // --- STREAMING MODE (Chat/Advice) ---
        else {
            try {
                // Try Gemini First
                console.log('🤖 Attempting Gemini Stream...');
                const geminiStream = await callGeminiStream(prompt);
                return new NextResponse(geminiStream);
            } catch (geminiError) {
                console.error('⚠️ Gemini Stream Failed:', geminiError);
                
                // Fallback Groq
                try {
                    console.log('🔄 Swapping to Groq Stream...');
                    const groqStream = await callGroqStream(prompt);
                    
                    // Inject Warning
                    const encoder = new TextEncoder();
                    const warning = encoder.encode("\n\n[System: Switched to Groq Backup due to high load]\n\n");
                    const [pullStream, pushStream] = groqStream.tee();
                    
                    const hybridStream = new ReadableStream({
                        async start(controller) {
                            controller.enqueue(warning);
                            const reader = pullStream.getReader();
                            while(true) {
                                const {done, value} = await reader.read();
                                if(done) break;
                                controller.enqueue(value);
                            }
                            controller.close();
                        }
                    });

                    return new NextResponse(hybridStream);

                } catch (groqError) {
                    return NextResponse.json({ error: 'All AI services busy.' }, { status: 503 });
                }
            }
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
