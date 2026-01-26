
import { z } from 'zod';

// Re-defining schema/types here if needed, or moving them.
// Let's just create the helpers file and copy the necessary parts.

// Format Helper
export function format12h(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12;
    const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
    return `${displayH}${displayM}${ampm}`;
}

// We need the type for 'tasks'. 
// Let's define a minimal interface for what we need.
interface Task {
    scheduledDate?: string;
    scheduledTime?: string;
    status?: string;
    duration?: number;
    title?: string;
    type?: string;
}

interface CoachRequestMinimal {
    mode: string;
    tasks?: Task[] | any[];
    score?: number;
    balance?: string;
    question?: string;
    taskTitle?: string;
    history?: any[];
    goals?: any[];
    preferences?: any;
    conversationHistory?: any[];
    localDate?: string;
    localTime?: string;
}

export function calculateFreeSlots(tasks: any[] | undefined, targetDate: string | undefined, preferences: any): string {
    if (!tasks || !targetDate) return 'Unknown';
    // Cast to Task[] for safety if needed, but 'any' is fine for now as long as we access props safely
    const todayTasks = tasks
        .filter((t: any) => t.scheduledDate === targetDate && t.scheduledTime && t.status !== 'DONE')
        .sort((a: any, b: any) => (a.scheduledTime > b.scheduledTime ? 1 : -1));

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

export function buildPrompt(request: CoachRequestMinimal): string {
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
    ${tasks ? `- Completed Today: ${tasks.filter((t: any) => t.status === 'DONE' && t.type === 'ADULT').length} Adult, ${tasks.filter((t: any) => t.status === 'DONE' && t.type === 'CHILD').length} Child` : ''}
User Profile:${prefsStr}`;

    switch (mode) {
        case 'advice': return `${commonContext}\nGive me a 2-sentence personalized recommendation based on my current balance using MindSync terminology.`;
        case 'chat': {
            const historyStr = conversationHistory?.length ? '\n\nPrevious conversation:\n' + conversationHistory.map((msg: any) => `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`).join('\n') : '';
            const todayTasksList = tasks ? tasks.filter((t: any) => t.scheduledDate === currentDateKey) : [];
            const tasksStr = todayTasksList.length > 0 ? `Today's Tasks (${currentDateKey}): ${todayTasksList.map((t: any) => `${t.title} (${t.type}${t.scheduledTime ? ` at ${t.scheduledTime}` : ''})`).join(', ')}` : "No tasks scheduled for today.";
            const historySummary = (history || []).slice(-7).map((h: any) => `- ${h.date}: Score ${h.score}, Adult ${h.adultCompleted}, Child ${h.childCompleted}`).join('\n');
            return `${commonContext}\n${tasksStr}\n${historySummary ? `\nPast 7 Days History:\n${historySummary}\n` : ''}${goals ? `Active Goals: ${goals.map((g: any) => `${g.title} (due ${g.targetDate})`).join(', ')}` : ''}${historyStr}

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
