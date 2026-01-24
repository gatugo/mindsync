import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { COACH_SYSTEM_PROMPT } from '@/lib/aiPrompts';
import { z } from 'zod';

// ============ SECURITY: Rate Limiting ============
const REQUESTS_PER_MINUTE = 10;
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
// ============ SECURITY: Input Validation ============
// Relaxed schema to prevent validation errors on production
const CoachRequestSchema = z.object({
    mode: z.string(), // Allow string instead of strict enum for now to be safe
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

async function callGroqStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });

    const stream = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: COACH_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
        stream: true,
    });

    const encoder = new TextEncoder();
    return new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        controller.enqueue(encoder.encode(content));
                    }
                }
                controller.close();
            } catch (err) {
                console.error('Groq stream error:', err);
                controller.error(err);
            }
        },
    });
}

// Keeping non-streaming for JSON tasks (Smart Add)
async function callGroqJSON(prompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: COACH_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' }, // Enforce JSON for smart add
        max_tokens: 500,
        temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '{}';
}

function format12h(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12; // Convert 0 to 12
    const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
    return `${displayH}${displayM}${ampm}`;
}

function calculateFreeSlots(tasks: CoachRequest['tasks'], targetDate?: string): string {
    if (!tasks || !targetDate) return 'Unknown';

    // 1. Get today's scheduled tasks sorted by time
    const todayTasks = tasks
        .filter(t => t.scheduledDate === targetDate && t.scheduledTime && t.status !== 'DONE') // Only consider pending scheduled tasks for the target date
        .sort((a, b) => (a.scheduledTime! > b.scheduledTime! ? 1 : -1));

    // Define working day (06:00 to 23:00)
    const dayStart = 6 * 60;
    const dayEnd = 23 * 60;

    if (todayTasks.length === 0) return `All day (${format12h(dayStart)} - ${format12h(dayEnd)})`;

    // Simple slot finder
    let currentTime = dayStart;
    const slots = [];

    for (const task of todayTasks) {
        if (!task.scheduledTime) continue;

        const [hh, mm] = task.scheduledTime.split(':').map(Number);
        const taskStart = hh * 60 + mm;
        const taskDuration = task.duration || 30; // Default 30 min
        const taskEnd = taskStart + taskDuration;

        // If task starts before current time (overlap), push current time forward
        if (taskStart < currentTime) {
            currentTime = Math.max(currentTime, taskEnd);
            continue;
        }

        if (taskStart > currentTime + 15) { // Minimum 15 min gap
            slots.push(`${format12h(currentTime)} - ${format12h(taskStart)}`);
        }

        currentTime = Math.max(currentTime, taskEnd);
    }

    // Checking final slot after last task
    if (currentTime < dayEnd - 15) {
        slots.push(`${format12h(currentTime)} - ${format12h(dayEnd)}`);
    }

    return slots.length > 0 ? slots.join(', ') : 'None (Busy)';
}

function buildPrompt(request: CoachRequest): string {
    const { mode, tasks, score, balance, question, history, goals, preferences, taskTitle, conversationHistory, localDate, localTime } = request;

    // Use Client's Local Time/Date if provided, otherwise fallback to server time
    const now = new Date();
    const currentTimeStr = localTime || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDateKey = localDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentDateDisplay = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const availableSlots = calculateFreeSlots(tasks, currentDateKey);

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
        case 'advice': {
            return `${commonContext}
Give me a 2-sentence personalized recommendation based on my current balance using MindSync terminology.`;
        }

        case 'chat': {
            // Build conversation history for context
            const historyStr = conversationHistory && conversationHistory.length > 0
                ? '\n\nPrevious conversation:\n' + conversationHistory.map(msg =>
                    `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`
                ).join('\n')
                : '';

            const todayTasksList = tasks ? tasks.filter(t => t.scheduledDate === currentDateKey) : [];
            const tasksStr = todayTasksList.length > 0
                ? `Today's Tasks (${currentDateKey}): ${todayTasksList.map(t => `${t.title} (${t.type}${t.scheduledTime ? ` at ${t.scheduledTime}` : ''})`).join(', ')}`
                : "No tasks scheduled for today.";

            return `${commonContext}
${tasksStr}
${goals ? `Active Goals: ${goals.map(g => `${g.title} (due ${g.targetDate}${g.startTime ? ` at ${g.startTime}` : ''})`).join(', ')}` : ''}${historyStr}

User question: ${question}

Answer helpfully as the "Ego" coach using specific MindSync insights.

// ACTION BLOCK FORMAT:
// When the user explicitly asks to schedule a task, or when you strongly recommend a specific intervention, generate an ACTION block like this:
// [ACTION: CREATE_TASK | Title | Type (ADULT/CHILD/REST) | Duration in minutes | ScheduledDate (YYYY-MM-DD) | ScheduledTime (HH:MM)]
// Examples:
// - [ACTION: CREATE_TASK | Read "Atomic Habits" | REST | 30 | 2026-01-24 | 20:00]
// - [ACTION: CREATE_TASK | Review Quarterly Budget | ADULT | 60 | 2026-01-25 | 09:00]
// - [ACTION: CREATE_TASK | Practice Jazz Guitar Improvisation | CHILD | 45 | 2026-01-24 | 18:00]

// CONFLICT DETECTION & SPECIFICITY:
// 1. BE SPECIFIC: Do NOT suggest generic things like "Work on a project". Use the User Profile and History to suggest something like "Finalize the Project Alpha report".
// 2. CHECK SLOTS: Look at "Available Free Slots Today". Do not schedule over existing tasks.
// 3. RESOLVE: If the user asks for "5pm" but it's busy, say "Your 5pm is booked with [Task], how about 6:30pm instead?" and provide an [ACTION] for the alternative.

// IMPORTANT DATE/TIME FORMATTING:
// 1. In your conversational text, ALWAYS use 12-hour format (e.g., "5pm", "10:30am").
// 2. In the [ACTION] block, you MUST use 24-hour format for ScheduledTime (e.g., "17:00") and YYYY-MM-DD for ScheduledDate.
// 3. Use the "Current Context -> Date" to calculate future dates correctly.

// OTHER INSTRUCTIONS:
// 1. If suggesting a task, explicitly mention which Date and Time you are scheduling it for.
// 2. Explore the user's history (if provided) to give context-aware advice (e.g. "You've been heavy on Adult tasks lately...").`;
        }

        case 'summary': {
            const historyStr = (history || []).slice(-7)
                .map(h => `${h.date}: Score ${h.score}, Adult: ${h.adultCompleted}, Child: ${h.childCompleted}`)
                .join('\n');

            return `Weekly History:
${historyStr || 'No history yet'}

Provide a brief summary of my week's patterns and one key insight from the MindSync system.`;
        }

        case 'predict': {
            const goalsStr = (goals || [])
                .filter(g => !g.completed)
                .map(g => `- ${g.title} (due: ${g.targetDate}${g.startTime ? ` at ${g.startTime}` : ''})`)
                .join('\n');

            return `${commonContext}
Active Goals:
${goalsStr || 'No active goals'}

Based on patterns and upcoming goals, suggest tomorrow's ideal distribution of Adult (Independence/Future) and Child (Passion/HOBBIES) tasks.`;
        }

        case 'schedule_assist': {
            const title = taskTitle || 'Untitled Task';

            return `You are a scheduling assistant. Given the task title below, analyze it and return ONLY a JSON object (no markdown, no explanation) with your suggestions.

Task Title: "${title}"

Current Context:
- Date: ${currentDateDisplay} (${currentDateKey})
- Time: ${currentTimeStr} (Local)
- Available Slots: ${availableSlots}

Instructions:
1. **Analyze Title**: Extract the Task Type (ADULT/CHILD/REST), Date, and Time.
2. **Date Handling**: 
   - If a date is mentioned (e.g., "Jan 22", "tomorrow", "next Friday"), return that specific date in YYYY-MM-DD format.
   - If NO date is mentioned, use the Current Logic Date: "${currentDateKey}".
3. **Time Handling**:
   - If a time is mentioned ("at 5pm", "in 1 hour"), use it (convert "in X" relative to Current Time: ${currentTimeStr}).
   - If NO time is mentioned, suggest an *Available Slot* from the list above.
4. **Conflict Check**: If the user asks for a time that is NOT in the "Available Slots" list, you can still suggest it, but prioritize available slots if vague.

Respond with ONLY this JSON format (no other text):
{"suggestedType": "ADULT", "suggestedDate": "YYYY-MM-DD", "suggestedTime": "HH:MM"}`;
        }

        default:
            return 'Give me general advice about maintaining mental balance.';
    }
}

export async function POST(request: NextRequest) {
    try {
        // 1. Rate Limiting Check
        const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
        if (isRateLimited(ip)) {
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again in a minute.' },
                { status: 429 }
            );
        }

        // 2. Parse & Validate Body
        const rawBody = await request.json();
        const validationResult = CoachRequestSchema.safeParse(rawBody);

        if (!validationResult.success) {
            console.error('Validation error:', validationResult.error);
            return NextResponse.json(
                { success: false, error: 'Invalid request data', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const body = validationResult.data;
        const prompt = buildPrompt(body);

        // STREAMING for Chat, Advice, Summary, Predict
        if (body.mode !== 'schedule_assist') {
            try {
                const stream = await callGroqStream(prompt);
                return new NextResponse(stream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            } catch (err) {
                // Fallback for stream errors
                return NextResponse.json({ success: false, error: 'Stream failed' }, { status: 500 });
            }
        }

        // JSON for Schedule Assist (needs strict parsing)
        else {
            try {
                const jsonResponse = await callGroqJSON(prompt);
                return NextResponse.json({ success: true, response: jsonResponse });
            } catch (err) {
                return NextResponse.json({ success: false, error: 'JSON generation failed' }, { status: 500 });
            }
        }
    } catch (error) {
        console.error('AI Coach error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
