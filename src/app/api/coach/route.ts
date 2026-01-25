import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

async function callGroqStream(prompt: string, retryCount = 0): Promise<ReadableStream> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });
    const MAX_RETRIES = 2;

    try {
        console.log(`[Groq] Starting stream request (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

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
        let hasReceivedData = false;

        return new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || '';
                        if (content) {
                            hasReceivedData = true;
                            controller.enqueue(encoder.encode(content));
                        }
                    }

                    if (!hasReceivedData) {
                        console.warn('[Groq] Stream completed but received no data');
                        controller.enqueue(encoder.encode('I apologize, but I was unable to generate a response. Please try again.'));
                    }

                    controller.close();
                } catch (streamErr) {
                    console.error('[Groq] Stream iteration error:', streamErr);

                    // If we haven't sent any data yet, we can retry
                    if (!hasReceivedData && retryCount < MAX_RETRIES) {
                        console.log('[Groq] Retrying stream...');
                        controller.error(new Error('RETRY_STREAM'));
                    } else {
                        // Send error message to client gracefully
                        controller.enqueue(encoder.encode('\n\n⚠️ Connection interrupted. Please try again.'));
                        controller.close();
                    }
                }
            },
        });
    } catch (apiErr: any) {
        console.error('[Groq] API call error:', apiErr?.message || apiErr);

        // Handle rate limiting
        if (apiErr?.status === 429) {
            console.warn('[Groq] Rate limited. Waiting 2s before retry...');
            await new Promise(r => setTimeout(r, 2000));
        }

        // Retry logic
        if (retryCount < MAX_RETRIES) {
            console.log(`[Groq] Retrying (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
            return callGroqStream(prompt, retryCount + 1);
        }

        // Final fallback: return a simple error stream
        const encoder = new TextEncoder();
        return new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('⚠️ AI Coach is temporarily unavailable. Please try again in a moment.'));
                controller.close();
            }
        });
    }
}


// Adapting Gemini stream to ReadableStream
async function callGeminiStream(prompt: string): Promise<ReadableStream> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.0-flash as established
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    console.log('[Gemini] Starting stream request...');

    try {
        const streamingResponse = await model.generateContentStream([
            COACH_SYSTEM_PROMPT,
            prompt
        ]);

        const encoder = new TextEncoder();

        return new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of streamingResponse.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            controller.enqueue(encoder.encode(chunkText));
                        }
                    }
                    controller.close();
                } catch (err) {
                    console.error('[Gemini] Stream iteration error:', err);
                    controller.error(err);
                }
            }
        });
    } catch (err) {
        console.error('[Gemini] Stream init error:', err);
        throw err;
    }
}


// Keeping non-streaming for JSON tasks (Smart Add)

async function callGroqJSON(prompt: string, retryCount = 0): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    const MAX_RETRIES = 2;

    console.log(`[Groq] JSON Request (attempt ${retryCount + 1}). Key present:`, !!apiKey);

    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });

    try {
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
    } catch (err: any) {
        console.error('[Groq] JSON API Error:', err);

        // Handle rate limiting
        if (err?.status === 429) {
            console.warn('[Groq] JSON Rate limited. Waiting 2s before retry...');
            await new Promise(r => setTimeout(r, 2000));
        }

        // Retry logic
        if (retryCount < MAX_RETRIES) {
            console.log(`[Groq] Retrying JSON (attempt ${retryCount + 2})...`);
            return callGroqJSON(prompt, retryCount + 1);
        }

        throw err;
    }
}

async function callGeminiJSON(prompt: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set');

    console.log('[Gemini] JSON Request via gemini-2.0-flash');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: "application/json" }
    });


    try {
        const result = await model.generateContent([
            COACH_SYSTEM_PROMPT,
            "Respond with valid JSON.",
            prompt
        ]);
        const response = await result.response;
        return response.text();
    } catch (err) {
        console.error('[Gemini] JSON API Error:', err);
        throw err;
    }
}



function format12h(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12; // Convert 0 to 12
    const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
    return `${displayH}${displayM}${ampm}`;
}

function calculateFreeSlots(tasks: CoachRequest['tasks'], targetDate?: string, preferences?: any): string {
    if (!tasks || !targetDate) return 'Unknown';

    // 1. Get today's scheduled tasks sorted by time
    const todayTasks = tasks
        .filter(t => t.scheduledDate === targetDate && t.scheduledTime && t.status !== 'DONE')
        .sort((a, b) => (a.scheduledTime! > b.scheduledTime! ? 1 : -1));

    // Define working day based on preferences or defaults
    const sleepStart = preferences?.sleepStartTime || '23:00';
    const sleepEnd = preferences?.sleepEndTime || '06:00';

    const [sH, sM] = sleepEnd.split(':').map(Number);
    const [eH, eM] = sleepStart.split(':').map(Number);

    const dayStart = sH * 60 + sM;
    const dayEnd = eH * 60 + eM;

    // Handle overnight sleep schedules (e.g. sleep 23:00 to 06:00)
    // If dayEnd < dayStart, it means sleep spans midnight.
    // However, usually we want the AWAKE time. 
    // If sleep is 23:00 to 06:00, awake is 06:00 to 23:00.
    // If sleep is 02:00 to 10:00, awake is 10:00 to 02:00.

    let awakeStart = dayStart;
    let awakeEnd = dayEnd;

    // If dayEnd <= dayStart, it means the "end" (sleep start) is before the "start" (wake up) in 24h cycle
    // We treat dayEnd as dayEnd + 24h for calculations if needed, but for slots we mainly care about the current local day's view.

    if (todayTasks.length === 0) {
        if (awakeEnd > awakeStart) {
            return `All day (${format12h(awakeStart)} - ${format12h(awakeEnd)})`;
        } else {
            return `All day (${format12h(awakeStart)} - 11:59pm AND 12am - ${format12h(awakeEnd)})`;
        }
    }

    // Simple slot finder
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

    // Use Client's Local Time/Date if provided, otherwise fallback to server time
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

            const historySummary = (history || []).slice(-7)
                .map(h => `- ${h.date}: Score ${h.score}, Adult ${h.adultCompleted}, Child ${h.childCompleted}`)
                .join('\n');

            return `${commonContext}
${tasksStr}
${historySummary ? `\nPast 7 Days History:\n${historySummary}\n` : ''}
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

You are the authoritative "Daily Architect". Analyze the user's current balance, their sleep schedule (${preferences?.sleepStartTime || '23:00'} - ${preferences?.sleepEndTime || '06:00'}), and their unfinished goals.

PROPOSE A PERFECT PLAN for the next 24 hours. 
1. Identify 2-3 high-impact tasks.
2. Schedule them into the "Available Free Slots" listed above.
3. Ensure a mix of Adult (work/discipline) and Child (passion/fun).
4. Estimate the projected impact on the user's Ego Score for each task.

For each specific task you suggest, you MUST use the ACTION block format with projected score:
[ACTION: CREATE_TASK | Title | Type | Duration | Date | Time | ProjectedScore]

Example response:
"Based on your current low Child score, I've scheduled some creative time tonight. I also see you have a goal due soon, so I've blocked out your deep work slot tomorrow morning.

[ACTION: CREATE_TASK | Deep Work: Goal Progress | ADULT | 90 | ${currentDateKey} | 09:00 | +8]
[ACTION: CREATE_TASK | Fun: Guitar Session | CHILD | 45 | ${currentDateKey} | 19:00 | +5]"

BE BOLD. Prescribe the time. Don't be vague. Always include the projected score (+1 to +10 for positive, -1 to -5 for negative if applicable).`;
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
        // 0. MOCK AI MODE (Safe Testing)
        if (process.env.MOCK_AI === 'true') {
            const body = await request.json();
            console.log(`[Mock Mode] Handling request for mode: ${body.mode}`);
            
            // Simulate network delay
            await new Promise(r => setTimeout(r, 1000));

            if (body.mode === 'schedule_assist') {
                return NextResponse.json({
                    success: true,
                    response: JSON.stringify({
                        suggestedType: 'ADULT',
                        suggestedDate: body.localDate || '2026-01-25',
                        suggestedTime: '10:00'
                    })
                });
            }

            // Stream Simulation for Chat/Advice/Predict
            const encoder = new TextEncoder();
            const mockText = body.mode === 'predict' 
                ? `[MOCK] Based on your balance, here is a plan:\n\n[ACTION: CREATE_TASK | Deep Work | ADULT | 90 | ${body.localDate || '2026-01-25'} | 09:00 | +8]\n[ACTION: CREATE_TASK | Relax | REST | 30 | ${body.localDate || '2026-01-25'} | 12:00 | +3]`
                : `[MOCK] This is a simulated response for mode '${body.mode}' to save tokens. Your Balance is ${body.balance || 'unknown'}.`;

            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(mockText));
                    controller.close();
                }
            });

            return new NextResponse(stream, {
                headers: { 'Content-Type': 'text/event-stream' }
            });
        }

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
            const provider = process.env.AI_PROVIDER || 'groq';

            try {
                console.log(`Starting stream for mode: ${body.mode}. Primary: ${provider}`);
                const stream = provider === 'gemini'
                    ? await callGeminiStream(prompt)
                    : await callGroqStream(prompt);

                return new NextResponse(stream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            } catch (primaryErr) {
                console.error(`Streaming error (Primary: ${provider}):`, primaryErr);

                // Fallback
                const fallbackProvider = provider === 'gemini' ? 'groq' : 'gemini';
                console.log(`Attempting fallback stream: ${fallbackProvider}`);

                try {
                    const fallbackStream = fallbackProvider === 'gemini'
                        ? await callGeminiStream(prompt)
                        : await callGroqStream(prompt);

                    return new NextResponse(fallbackStream, {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        },
                    });
                } catch (fallbackErr) {
                    console.error(`Streaming error (Fallback: ${fallbackProvider}):`, fallbackErr);
                    return NextResponse.json({
                        success: false,
                        error: 'Stream failed (All providers)',
                        message: `Primary: ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}, Fallback: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
                    }, { status: 500 });
                }
            }
        }


        // JSON for Schedule Assist
        else {
            const provider = process.env.AI_PROVIDER || 'groq';
            console.log(`Fetching JSON for schedule_assist. Primary: ${provider}`);

            try {
                // Try Primary Provider
                let jsonResponse;
                if (provider === 'gemini') {
                    jsonResponse = await callGeminiJSON(prompt);
                } else {
                    jsonResponse = await callGroqJSON(prompt);
                }
                return NextResponse.json({ success: true, response: jsonResponse });

            } catch (primaryErr) {
                console.error(`Primary provider (${provider}) failed:`, primaryErr);

                // Try Fallback Provider
                const fallbackProvider = provider === 'gemini' ? 'groq' : 'gemini';
                console.log(`Attempting fallback to: ${fallbackProvider}`);

                try {
                    let fallbackResponse;
                    if (fallbackProvider === 'gemini') {
                        fallbackResponse = await callGeminiJSON(prompt);
                    } else {
                        fallbackResponse = await callGroqJSON(prompt);
                    }
                    return NextResponse.json({ success: true, response: fallbackResponse });

                } catch (fallbackErr) {
                    console.error(`Fallback provider (${fallbackProvider}) also failed:`, fallbackErr);

                    return NextResponse.json({
                        success: false,
                        error: 'JSON generation failed (All providers)',
                        message: `Primary: ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}, Fallback: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
                    }, { status: 500 });
                }
            }
        }
    } catch (error) {
        console.error('Final catch in /api/coach:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
