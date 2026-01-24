/**
 * Shared utility for robust natural language date/time parsing.
 * Used by AICoachModal, AddTaskPanel, and TimelineView.
 */

export interface ParsedDateTime {
    date?: string; // YYYY-MM-DD
    time?: string; // HH:MM
    duration?: number; // In minutes, detected from "15mins" etc
}

export const parseNaturalDateTime = (input: string): ParsedDateTime => {
    const clean = input.toLowerCase().trim();
    const now = new Date();
    let targetDate = new Date(now);
    let targetTime: string | undefined;
    let detectedDuration: number | undefined;

    // 1. Detect Duration FIRST to remove it from string (avoid "15 mins" -> time 15:00)
    const durationMatch = clean.match(/(\d+)\s*(mins?|minutes?|hrs?|hours?)/);
    let cleanWithoutDuration = clean;
    if (durationMatch) {
        const val = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        if (unit.startsWith('h')) {
            detectedDuration = val * 60;
        } else {
            detectedDuration = val;
        }
        // Remove from string to prevent confusing the time parser
        cleanWithoutDuration = clean.replace(durationMatch[0], '');
    }

    // 2. Extract Date
    // Patterns:
    // a) M-D-YY or M-D-YYYY (e.g. 1-24-26, 01/24/2026)
    const numericDateMatch = cleanWithoutDuration.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    // b) MMM D (e.g. Jan 26, January 26th)
    const months = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
    const namedDateRegex = new RegExp(`(?:${months})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?`);
    const namedDateMatch = cleanWithoutDuration.match(namedDateRegex);

    if (numericDateMatch) {
        const m = parseInt(numericDateMatch[1]) - 1;
        const d = parseInt(numericDateMatch[2]);
        let y = parseInt(numericDateMatch[3]);
        if (y < 100) y += 2000;
        targetDate = new Date(y, m, d);
    } else if (namedDateMatch) {
        const day = parseInt(namedDateMatch[1]);
        const monthStr = cleanWithoutDuration.match(new RegExp(`(${months})`))![0];
        const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthStr.substring(0, 3));
        targetDate.setMonth(monthIndex);
        targetDate.setDate(day);

        // Handle year rollover (if user says "Jan" in Dec, mean next year)
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        if (targetDate < oneMonthAgo) {
            targetDate.setFullYear(targetDate.getFullYear() + 1);
        }
    } else if (cleanWithoutDuration.includes('tomorrow')) {
        targetDate.setDate(targetDate.getDate() + 1);
    } else if (cleanWithoutDuration.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDayName = cleanWithoutDuration.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)![1];
        const targetDayIndex = dayNames.indexOf(targetDayName);
        const currentDayIndex = targetDate.getDay();
        let daysToAdd = targetDayIndex - currentDayIndex;
        if (daysToAdd <= 0) daysToAdd += 7;
        targetDate.setDate(targetDate.getDate() + daysToAdd);
    }

    // 3. Extract Time
    // Clean specific patterns that shouldn't match time
    let timeSearchStr = cleanWithoutDuration;
    const dateMatchUsed = numericDateMatch || namedDateMatch;
    if (dateMatchUsed) {
        timeSearchStr = timeSearchStr.replace(dateMatchUsed[0], '');
    }

    // Regex for:
    // "at 5"
    // "at 5:30"
    // "5pm" "5:30pm"
    // "17:00"
    // Excludes bare numbers unless "at" is present, to avoid "Task 2" being 2:00
    const timeRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/g;

    // We want to find the *best* match, essentially looking for specific indicators
    // Iterate matches to find one with am/pm OR 'at' OR colon
    let match;
    while ((match = timeRegex.exec(timeSearchStr)) !== null) {
        const fullMatch = match[0];
        const hasAt = fullMatch.trim().startsWith('at');
        const hasAmPm = !!match[3];
        const hasColon = !!match[2];
        const val = parseInt(match[1]);

        // Valid time indicator?
        if (hasAt || hasAmPm || hasColon) {
            let h = val;
            const m = match[2] ? parseInt(match[2]) : 0;
            const ampm = match[3];

            if (ampm === 'pm' && h < 12) h += 12;
            if (ampm === 'am' && h === 12) h = 0;

            if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                targetTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                break; // Found a valid time
            }
        }
    }

    // Handle "in X hours" format for time
    const relativeTimeMatch = cleanWithoutDuration.match(/in\s+(\d+)\s+hours?/);
    if (relativeTimeMatch && !targetTime) { // specific time overrides relative
        const hours = parseInt(relativeTimeMatch[1]);
        const relDate = new Date(); // Use distinct date object for calc
        relDate.setHours(relDate.getHours() + hours);
        targetTime = `${relDate.getHours().toString().padStart(2, '0')}:${relDate.getMinutes().toString().padStart(2, '0')}`;

        // If it crosses midnight, should we update date? 
        // For simplicity, let's update targetDate if it was "today"
        if (targetDate.toDateString() === new Date().toDateString()) {
            if (relDate.getDate() !== new Date().getDate()) {
                targetDate.setDate(targetDate.getDate() + 1);
            }
        }
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Compare with today local
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return {
        date: dateStr !== todayStr ? dateStr : undefined,
        time: targetTime,
        duration: detectedDuration
    };
};

export const format12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12;
    const displayM = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
    return `${displayH}${displayM}${ampm}`;
};
