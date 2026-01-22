
import { supabase } from './supabase';
import { Task, Goal, DailySnapshot } from '@/store/useStore';

// --- Mappers ---

const mapTaskFromDB = (row: any): Task => ({
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    duration: row.duration,
    createdAt: row.created_at,
    completedAt: row.completed_at,
});

const mapGoalFromDB = (row: any): Goal => ({
    id: row.id,
    title: row.title,
    targetDate: row.target_date,
    startTime: row.start_time,
    completed: row.completed,
    createdAt: row.created_at,
});

// --- API Functions ---

export const api = {
    // PROFILES
    fetchProfile: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found', which is fine as valid user might not have profile yet
            console.error('Error fetching profile:', error);
            return null;
        }

        return data; // Returns { hobbies: [], show_goals: true, etc }
    },

    updateProfile: async (updates: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('profiles')
            .upsert({ id: user.id, ...updates });

        if (error) console.error('Error updating profile:', error);
    },
    // TASKS
    fetchTasks: async () => {
        const { data, error } = await supabase.from('tasks').select('*');
        if (error) throw error;
        return data.map(mapTaskFromDB);
    },

    createTask: async (task: Task) => {
        const { error } = await supabase.from('tasks').insert({
            id: task.id,
            title: task.title,
            type: task.type,
            status: task.status,
            scheduled_date: task.scheduledDate,
            scheduled_time: task.scheduledTime,
            created_at: task.createdAt,
        });
        if (error) console.error('Error creating task:', error);
    },

    updateTask: async (taskId: string, updates: any) => {
        // Map updates to snake_case
        const dbUpdates: any = {};
        if (updates.title) dbUpdates.title = updates.title;
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.scheduledDate) dbUpdates.scheduled_date = updates.scheduledDate;
        if (updates.scheduledTime) dbUpdates.scheduled_time = updates.scheduledTime;
        if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;

        const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
        if (error) console.error('Error updating task:', error);
    },

    deleteTask: async (taskId: string) => {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) console.error('Error deleting task:', error);
    },

    // GOALS
    fetchGoals: async () => {
        const { data, error } = await supabase.from('goals').select('*');
        if (error) throw error;
        return data.map(mapGoalFromDB);
    },

    createGoal: async (goal: Goal) => {
        const { error } = await supabase.from('goals').insert({
            id: goal.id,
            title: goal.title,
            target_date: goal.targetDate,
            start_time: goal.startTime,
            completed: goal.completed,
            created_at: goal.createdAt,
        });
        if (error) console.error('Error creating goal:', error);
    },

    updateGoal: async (goalId: string, updates: any) => {
        const dbUpdates: any = {};
        if (updates.title) dbUpdates.title = updates.title;
        if (updates.targetDate) dbUpdates.target_date = updates.targetDate;
        if (updates.startTime) dbUpdates.start_time = updates.startTime;
        if (updates.completed !== undefined) dbUpdates.completed = updates.completed;

        const { error } = await supabase.from('goals').update(dbUpdates).eq('id', goalId);
        if (error) console.error('Error updating goal:', error);
    },

    deleteGoal: async (goalId: string) => {
        const { error } = await supabase.from('goals').delete().eq('id', goalId);
        if (error) console.error('Error deleting goal:', error);
    },

    // HISTORY
    // Note: For history, we might just fetch the latest or rely on client-side calculation for now
    // but let's persist the snapshots.
    saveSnapshot: async (snapshot: DailySnapshot) => {
        const { error } = await supabase.from('daily_history').upsert({
            date: snapshot.date,
            score: snapshot.score,
            adult_completed: snapshot.adultCompleted,
            child_completed: snapshot.childCompleted,
            rest_completed: snapshot.restCompleted,
            snapshot_data: snapshot.tasks,
        });
        if (error) console.error('Error saving snapshot:', error);
    }
};
