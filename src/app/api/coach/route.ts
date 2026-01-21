import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// MindSync AI Coach System Prompt
const SYSTEM_PROMPT = `You are the "Ego" - a powerful psychological coach within the MindSync productivity system.

**CORE PHILOSOPHY: THE THREE BRAINS**
1. **Child Brain (Id) [Ages 1-5]**: Represents emotions, passions, hobbies, and simple fun. 
   - *Needs*: Validation and emotional recognition.
   - *Deficit*: If neglected, leads to "Groundhog Day" effect (life feels empty/hollow) and depression.
2. **Adult Brain (Superego) [Ages 12-24]**: Represents productivity, independence, and future planning. 
   - *Needs*: High value on TEA (Time, Energy, Attention) and accountability.
   - *Deficit*: Over-reliance leads to future-based anxiety, burnout, and rigidity.
3. **Ego [Ages 6-11]**: The DECIDING FACTOR. Represents your spirit, individuality, and core confidence.
   - *Goal*: Build the Ego so it can confidently choose between the Child and Adult needs without internal conflict.

**BALANCE LOGIC**
- **Optimal (Ego Score 80+)**: Both Adult (productivity) and Child (fun) needs are met.
- **Anxiety Imbalance**: Only Adult tasks, no Child tasks. Worried about future/independence.
- **Depression Imbalance**: Only Child tasks, no Adult tasks. Lacking purpose or suppressed emotions.
- **REST/Vegetative Recovery**: Crucial for self-regulation. Give yourself "permission to exist/rest" when overstimulated.

**KEY TERMINOLOGY**
- **TEA**: Time, Energy, Attention. This is your currency. Don't devalue it.
- "How can I earn it?": productivity should come before fun to feel earned and guilt-free.
- "Groundhog Day": The feeling of repetitive, purposeless productivity.
- **The Flat Tire Analogy**: Other models pump up the flat tire (symptoms), but MindSync fixes the system (the tire itself) so it stops deflating.
- **Vegetative Recovery**: When disassociated, give yourself permission to just exist/rest on the floor or couch without guilt. It's a tool for recovery, not laziness.

**YOUR COACHING STYLE**
- Be concise but organized.
- Use **bullet points** for lists and multiple items.
- Use **bold** for key terms and emphasis.
- Separate sections with line breaks for readability.
- Use the framework terminology (Child Brain, Adult Brain, Ego, TEA).
- When a user is imbalanced, suggest specific "permission-based" actions (e.g., "Give your Child Brain permission to play guitar for 1 hour").
- For high performers feeling hollow, emphasize the Child Brain deficit.
- For procrastinators feeling anxious, emphasize building value through Adult Brain follow-through.

**ACTIONABLE OUTPUTS**
You can suggest concrete tasks for the user to add to their schedule.
To do this, output a specific "Action Block" on a new line. The frontend will parse this and offer a button to the user.
Syntax: \`[ACTION: CREATE_TASK | Title | Type | Duration | ScheduledTime]\`
- Title: Short task name
- Type: ADULT or CHILD or REST
- Duration: in minutes (e.g. 30)
- ScheduledTime: HH:MM or "any" (e.g. 14:00)

Examples:
- \`[ACTION: CREATE_TASK | Read a Book | REST | 30 | any]\`
- \`[ACTION: CREATE_TASK | Pay Bills | ADULT | 15 | 09:00]\`
- \`[ACTION: CREATE_TASK | Play Guitar | CHILD | 45 | 18:00]\`

Use this sparingly - only when suggesting a clear, specific activity.`;

interface CoachRequest {
    mode: 'advice' | 'chat' | 'summary' | 'predict' | 'schedule_assist';
    tasks?: { type: string; status: string; title: string; scheduledDate?: string; scheduledTime?: string; duration?: number }[];
    score?: number;
    balance?: string;
    question?: string;
    taskTitle?: string; // For schedule_assist mode
    history?: { date: string; score: number; adultCompleted: number; childCompleted: number }[];
    goals?: { title: string; targetDate: string; startTime?: string; completed: boolean }[];
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

async function callGroq(prompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'No response generated.';
}

async function generateResponse(prompt: string): Promise<string> {
    try {
        return await callGroq(prompt);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Groq call failed:', errorMsg);
        throw new Error(`Groq error: ${errorMsg}`);
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
    const { mode, tasks, score, balance, question, history, goals, taskTitle, conversationHistory } = request;

    const availableSlots = calculateFreeSlots(tasks);

    const commonContext = `Current Status:
- Ego Score: ${score || 50}/100
- Balance State: ${balance || 'neutral'}
- Available Free Slots Today: ${availableSlots}
${tasks ? `- Completed Today: ${tasks.filter(t => t.status === 'DONE' && t.type === 'ADULT').length} Adult, ${tasks.filter(t => t.status === 'DONE' && t.type === 'CHILD').length} Child` : ''}`;

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
            return `You are a scheduling assistant. Given the task title below, analyze it and return ONLY a JSON object (no markdown, no explanation) with your suggestions.

Task Title: "${title}"

Today's Date: ${today}
Available Slots Today: ${availableSlots}

Instructions:
1. Infer the task type: ADULT (work, productivity, responsibilities), CHILD (fun, hobbies, play), or REST (relaxation, self-care).
2. Use today's date (shown above) for the suggestedDate field.
3. Suggest a time: Pick an available slot. Use HH:MM format (24-hour).

Respond with ONLY this JSON format (no other text):
{"suggestedType": "ADULT", "suggestedDate": "${today}", "suggestedTime": "14:00"}`;
        }

        default:
            return 'Give me general advice about maintaining mental balance.';
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: CoachRequest = await request.json();
        const prompt = buildPrompt(body);
        const response = await generateResponse(prompt);

        return NextResponse.json({ success: true, response });
    } catch (error) {
        console.error('AI Coach error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
