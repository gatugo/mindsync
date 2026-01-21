
import { create } from 'zustand';
import { api } from '@/lib/api';

// ============ TYPES ============
export type TaskType = 'ADULT' | 'CHILD' | 'REST';
export type TaskStatus = 'TODO' | 'START' | 'DONE';

export interface UserPreferences {
    hobbies: string[];
    interests: string[];
    passions: string[];
}

export interface Task {
    id: string;
    title: string;
    type: TaskType;
    status: TaskStatus;
    scheduledDate?: string; // Optional scheduled date
    scheduledTime?: string; // Optional scheduled time
    duration?: number; // Optional duration in minutes
    createdAt: string;
    completedAt?: string;
}

export interface DailySnapshot {
    date: string; // YYYY-MM-DD format
    tasks: Task[];
    score: number;
    adultCompleted: number;
    childCompleted: number;
    restCompleted: number;
}

export interface Goal {
    id: string;
    title: string;
    titleDate?: string; // Deprecated but might exist in old data
    targetDate: string;
    startTime?: string; // Optional start time (HH:MM format)
    completed: boolean;
    createdAt: string;
}

export interface StoreState {
    // Tasks
    tasks: Task[];
    addTask: (title: string, type: TaskType, date?: string, time?: string) => void;
    moveTask: (taskId: string, newStatus: TaskStatus) => void;
    deleteTask: (taskId: string) => void;
    updateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'scheduledTime' | 'duration'>>) => void;
    clearCompletedTasks: () => void;

    // History
    history: DailySnapshot[];
    saveDailySnapshot: () => void;

    // Goals
    goals: Goal[];
    addGoal: (title: string, targetDate: string, startTime?: string) => void;
    editGoal: (goalId: string, title: string, targetDate: string, startTime?: string) => void;
    toggleGoal: (goalId: string) => void;
    deleteGoal: (goalId: string) => void;

    // Preferences
    preferences: UserPreferences;
    updatePreferences: (prefs: Partial<UserPreferences>) => void;

    // Calculated
    getDailyScore: () => { score: number; balance: 'optimal' | 'anxiety' | 'depression' | 'neutral' };
    getTasksByStatus: (status: TaskStatus) => Task[];

    // Export/Import
    exportData: () => string;
    importData: (jsonData: string) => boolean;

    // Hydration / Sync
    _hasHydrated: boolean;
    fetchInitialData: () => Promise<void>;
}

// ============ HELPER FUNCTIONS ============
const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const getTodayString = (): string => {
    return new Date().toISOString().split('T')[0];
};

// ============ STORE ============
export const useStore = create<StoreState>((set, get) => ({
    // Initial state
    tasks: [],
    history: [],
    goals: [],
    _hasHydrated: false,
    preferences: {
        hobbies: ['Competitive Gaming (Fortnite)', 'Content Creation & Personal Branding'],
        interests: ['Home Lab & Self-Hosting', 'Digital Privacy & Security Research'],
        passions: ['AI Engineering & Agentic Workflows', 'Full-Stack Web Development']
    },

    fetchInitialData: async () => {
        try {
            const [tasks, goals] = await Promise.all([
                api.fetchTasks(),
                api.fetchGoals()
            ]);
            set({ tasks, goals, _hasHydrated: true });
        } catch (error) {
            console.error('Failed to fetch initial data:', error);
            set({ _hasHydrated: true }); // Allow app to load even if fetch fails
        }
    },

    // Task actions
    addTask: (title: string, type: TaskType, date?: string, time?: string) => {
        const initialStatus: TaskStatus = 'TODO';
        const newTask: Task = {
            id: generateId(),
            title,
            type,
            status: initialStatus,
            scheduledDate: date || new Date().toISOString().split('T')[0],
            scheduledTime: time,
            createdAt: new Date().toISOString(),
        };

        // Optimistic Update
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        get().saveDailySnapshot();

        // Sync
        api.createTask(newTask);
    },

    moveTask: (taskId: string, newStatus: TaskStatus) => {
        const completedAt = newStatus === 'DONE' ? new Date().toISOString() : undefined;

        // Optimistic
        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === taskId
                    ? {
                        ...task,
                        status: newStatus,
                        completedAt: newStatus === 'DONE' ? completedAt : task.completedAt,
                    }
                    : task
            ),
        }));
        get().saveDailySnapshot();

        // Sync
        api.updateTask(taskId, { status: newStatus, completedAt });
    },

    deleteTask: (taskId: string) => {
        set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== taskId),
        }));
        get().saveDailySnapshot();
        api.deleteTask(taskId);
    },

    updateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'scheduledTime' | 'duration'>>) => {
        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === taskId ? { ...task, ...updates } : task
            ),
        }));
        get().saveDailySnapshot();
        api.updateTask(taskId, updates);
    },

    clearCompletedTasks: () => {
        const state = get();
        const doneTasks = state.tasks.filter(t => t.status === 'DONE');
        doneTasks.forEach(task => api.deleteTask(task.id));

        set((state) => ({
            tasks: state.tasks.filter((task) => task.status !== 'DONE'),
        }));
        get().saveDailySnapshot();
    },

    // History actions
    saveDailySnapshot: () => {
        const state = get();
        const today = getTodayString();
        const { score } = state.getDailyScore();

        const completedTasks = state.tasks.filter((t) => t.status === 'DONE');
        const adultCompleted = completedTasks.filter((t) => t.type === 'ADULT').length;
        const childCompleted = completedTasks.filter((t) => t.type === 'CHILD').length;
        const restCompleted = completedTasks.filter((t) => t.type === 'REST').length;

        const snapshot: DailySnapshot = {
            date: today,
            tasks: [...state.tasks],
            score,
            adultCompleted,
            childCompleted,
            restCompleted,
        };

        const existingIndex = state.history.findIndex((h) => h.date === today);
        if (existingIndex >= 0) {
            const newHistory = [...state.history];
            newHistory[existingIndex] = snapshot;
            set({ history: newHistory });
        } else {
            set({ history: [...state.history, snapshot] });
        }

        api.saveSnapshot(snapshot);
    },

    // Goal actions
    addGoal: (title: string, targetDate: string, startTime?: string) => {
        const newGoal: Goal = {
            id: generateId(),
            title,
            targetDate,
            startTime,
            completed: false,
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ goals: [...state.goals, newGoal] }));
        api.createGoal(newGoal);
    },

    editGoal: (goalId: string, title: string, targetDate: string, startTime?: string) => {
        set((state) => ({
            goals: state.goals.map((goal) =>
                goal.id === goalId
                    ? { ...goal, title, targetDate, startTime }
                    : goal
            ),
        }));
        api.updateGoal(goalId, { title, targetDate, startTime });
    },

    toggleGoal: (goalId: string) => {
        let newCompletedState = false;
        set((state) => ({
            goals: state.goals.map((goal) => {
                if (goal.id === goalId) {
                    newCompletedState = !goal.completed;
                    return { ...goal, completed: newCompletedState };
                }
                return goal;
            }),
        }));
        api.updateGoal(goalId, { completed: newCompletedState });
    },

    deleteGoal: (goalId: string) => {
        set((state) => ({
            goals: state.goals.filter((goal) => goal.id !== goalId),
        }));
        api.deleteGoal(goalId);
    },

    updatePreferences: (newPrefs) => set((state) => ({
        preferences: { ...state.preferences, ...newPrefs }
    })),

    // Calculated values (Unchanged)
    getDailyScore: () => {
        const state = get();
        const today = getTodayString();

        const relevantTasks = state.tasks.filter((t) => {
            const isCompletedToday = t.status === 'DONE' && t.completedAt?.startsWith(today);
            const isScheduledToday = t.scheduledDate === today;
            return isCompletedToday || isScheduledToday;
        });

        const countByType = (type: TaskType) => relevantTasks.filter((t) => t.type === type).length;
        const adultCount = countByType('ADULT');
        const childCount = countByType('CHILD');
        const restCount = countByType('REST');
        const total = adultCount + childCount + restCount;

        if (total === 0) {
            return { score: 50, balance: 'neutral' as const };
        }

        const adultRatio = adultCount / total;
        const childRatio = childCount / total;

        let balance: 'optimal' | 'anxiety' | 'depression' | 'neutral';
        let score: number;

        if (adultCount > 0 && childCount > 0) {
            const balanceRatio = Math.min(adultRatio, childRatio) / Math.max(adultRatio, childRatio);
            score = Math.round(60 + balanceRatio * 40);
            if (balanceRatio > 0.4) {
                balance = 'optimal';
            } else if (adultRatio > childRatio) {
                balance = 'anxiety';
            } else {
                balance = 'depression';
            }
        } else if (adultCount > 0 && childCount === 0) {
            score = Math.round(40 + Math.min(adultCount * 5, 20));
            balance = 'anxiety';
        } else if (childCount > 0 && adultCount === 0) {
            score = Math.round(40 + Math.min(childCount * 5, 20));
            balance = 'depression';
        } else {
            score = 50 + Math.min(restCount * 5, 30);
            balance = 'neutral';
        }

        score = Math.min(100, score);
        return { score, balance };
    },

    getTasksByStatus: (status: TaskStatus) => {
        return get().tasks.filter((task) => task.status === status);
    },

    exportData: () => {
        const state = get();
        const exportObj = {
            tasks: state.tasks,
            history: state.history,
            goals: state.goals,
            exportedAt: new Date().toISOString(),
        };
        return JSON.stringify(exportObj, null, 2);
    },

    importData: (jsonData: string) => {
        try {
            const data = JSON.parse(jsonData);
            if (data.tasks && data.history && data.goals) {
                set({
                    tasks: data.tasks,
                    history: data.history,
                    goals: data.goals,
                });
                return true;
            }
            return false;
        } catch {
            return false;
        }
    },
}));
