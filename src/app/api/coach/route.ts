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
    conversationHistory: z.array(z.any()).optional()
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

function calculateFreeSlots(tasks: CoachRequest['tasks']): string {
    if (!tasks) return 'Unknown';

    // 1. Get today's scheduled tasks sorted by time
    const todayTasks = tasks
        .filter(t => t.scheduledTime && t.status !== 'DONE') // Only consider pending scheduled tasks
        .sort((a, b) => (a.scheduledTime! > b.scheduledTime! ? 1 : -1));

    // Define working day (08:00 to 22:00)
    const dayStart = 8 * 60;
    const dayEnd = 22 * 60;

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
    const { mode, tasks, score, balance, question, history, goals, preferences, taskTitle, conversationHistory } = request;

    const availableSlots = calculateFreeSlots(tasks);

    const prefsStr = preferences ? `
- Hobbies: ${preferences.hobbies?.join(', ') || 'None'}
- Interests: ${preferences.interests?.join(', ') || 'None'}
- Passions: ${preferences.passions?.join(', ') || 'None'}` : '';

    const now = new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const commonContext = `Current Context:
- Date: ${currentDateStr}
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

            return `${commonContext}
${tasks ? `Today's Tasks: ${tasks.map(t => `${t.title} (${t.type}${t.scheduledTime ? ` at ${t.scheduledTime}` : ''})`).join(', ')}` : ''}
${goals ? `Active Goals: ${goals.map(g => `${g.title} (due ${g.targetDate}${g.startTime ? ` at ${g.startTime}` : ''})`).join(', ')}` : ''}${historyStr}

User question: ${question}

Answer helpfully as the "Ego" coach using specific MindSync insights.

// ACTION BLOCK FORMAT:
// When the user explicitly asks to schedule a task, generate an ACTION block like this:
// [ACTION: CREATE_TASK | Task Title | Task Type (ADULT/CHILD/REST) | Duration in minutes | ScheduledTime (HH:MM) or 'any']
// Examples:
// - \`[ACTION: CREATE_TASK | Read a Book | REST | 30 | any]\`
// - \`[ACTION: CREATE_TASK | Pay Bills | ADULT | 15 | 09:00]\`
// - \`[ACTION: CREATE_TASK | Play Guitar | CHILD | 45 | 18:00]\`

// Use this sparingly - only when suggesting a clear, specific activity.

// IMPORTANT TIME FORMATTING:
// 1. In your conversational text, ALWAYS use 12-hour format (e.g., "5pm", "10:30am").
// 2. In the [ACTION] block, you MUST use 24-hour format for the ScheduledTime (e.g., "17:00", "10:30") so the system can read it.

// OTHER INSTRUCTIONS:
// 1. If suggesting a task, explicitly mention which Available Slot it fits into.
// 2. If the user EXPLICITLY asks to schedule a task (e.g., "Add gym at 5pm"), ALWAYS generate the "[ACTION: ...]" block for it immediately. Do not just say "I'll do that", actually output the block.`;
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
            const today = new Date().toISOString().split('T')[0];
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            return `You are a scheduling assistant. Given the task title below, analyze it and return ONLY a JSON object (no markdown, no explanation) with your suggestions.

Task Title: "${title}"

Current Context:
- Date: ${today}
- Time: ${currentTime}
- Available Slots: ${availableSlots}

Instructions:
**CRITICAL**: If the user uses relative time like "in 30 mins" or "in 1 hour", calculate the 'suggestedTime' based on the Current Time (${currentTime}).
1. Infer the task type: ADULT (work, productivity, responsibilities), CHILD (fun, hobbies, play), or REST (relaxation, self-care).
2. Use today's date (shown above) for the suggestedDate field.
3. Suggest a time: Pick an available slot or the CALCULATED relative time. Use HH:MM format (24-hour).

Respond with ONLY this JSON format (no other text):
{"suggestedType": "ADULT", "suggestedDate": "${today}", "suggestedTime": "14:00"}`;
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
