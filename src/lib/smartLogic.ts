import { DailySnapshot, Task, TaskType } from "@/types";
import { parseNaturalDateTime } from "./datePatterns";

/**
 * Smart Logic for Offline Functionality.
 * Provides therapeutic insights and task parsing without AI.
 */

// ==========================================
// 1. SMART INSIGHT ENGINE
// ==========================================

export const generateSmartInsight = (
    balance: 'optimal' | 'anxiety' | 'depression' | 'neutral',
    score: number,
    adultCount: number,
    childCount: number,
    restCount: number
): string => {
    // 1. Check for extreme imbalances first
    if (adultCount > 0 && childCount === 0 && restCount === 0) {
        return "You are in pure Adult mode. High risk of burnout. You MUST schedule something fun or restful immediately.";
    }
    if (childCount > 0 && adultCount === 0) {
        return "You are in Child mode. While fun is good, avoiding responsibilities can lead to anxiety later. Try to tackle one small productive task.";
    }

    // 2. Respond to calculated balance state
    switch (balance) {
        case 'anxiety':
            return `Your Adult/Child balance is skewed (${adultCount} vs ${childCount}). You are over-functioning, which feeds anxiety. Permission granted to stop working and rest.`;
        
        case 'depression':
            return `Your activity level is low. Action is the antidote to despair. "How can I earn it?" -> Set a small goal to earn a small reward.`;
        
        case 'optimal':
            return "Excellent balance! You are nurturing both your Adult (responsibility) and Child (creativity/rest) brains. Keep this rhythm.";
        
        case 'neutral':
            if (score < 30) return "You haven't tracked much today. Start by logging just one thing you did.";
            return "A fresh start. remember: The goal isn't to be perfect, but to be balanced.";
    }
    
    return "Stay balanced.";
};

// ==========================================
// 2. OFFLINE TASK PARSER
// ==========================================

const KEYWORDS: Record<TaskType, string[]> = {
    REST: ['sleep', 'nap', 'rest', 'relax', 'meditate', 'break', 'breathe', 'chill', 'recover'],
    CHILD: ['game', 'play', 'fun', 'movie', 'hobby', 'art', 'music', 'read', 'draw', 'paint', 'video', 'tv'],
    ADULT: ['work', 'meeting', 'email', 'call', 'study', 'clean', 'chore', 'pay', 'bill', 'gym', 'cook', 'laundry', 'errand']
};

export const parseOfflineTask = (input: string): Partial<Task> => {
    // 1. Extract Date, Time, Duration, and clean Title
    const { date, time, duration, remainingText } = parseNaturalDateTime(input);
    
    const title = remainingText || "New Task";
    
    // 2. Infer Type from Title
    let type: TaskType = 'ADULT'; // Default safety
    
    const lowerTitle = title.toLowerCase();
    
    // Check keywords (Priority: REST > CHILD > ADULT)
    // We prioritize REST/CHILD because ADULT is the default "catch-all" responsbility
    if (KEYWORDS.REST.some(k => lowerTitle.includes(k))) {
        type = 'REST';
    } else if (KEYWORDS.CHILD.some(k => lowerTitle.includes(k))) {
        type = 'CHILD';
    } else if (KEYWORDS.ADULT.some(k => lowerTitle.includes(k))) {
        type = 'ADULT';
    }

    return {
        title,
        type,
        scheduledDate: date,
        scheduledTime: time,
        duration,
        status: 'TODO'
    };
};
