-- Supabase Schema for MindSync (Auth Enabled)
-- Run this in the Supabase SQL Editor

-- ============ STEP 1: DROP OLD TABLES (OPTIONAL - WARNING: LOSTS DATA) ============
-- DROP TABLE IF EXISTS daily_history;
-- DROP TABLE IF EXISTS goals;
-- DROP TABLE IF EXISTS tasks;
-- DROP TABLE IF EXISTS profiles;

-- ============ STEP 2: CREATE TABLES ============

-- 1. Profiles Table (Extends auth.users)
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  hobbies text[] default array[]::text[],
  interests text[] default array[]::text[],
  passions text[] default array[]::text[],
  show_goals boolean default true,
  theme text default 'dark',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tasks Table
create table tasks (
  id text primary key,
  title text not null,
  type text check (type in ('ADULT', 'CHILD', 'REST')) not null,
  status text check (status in ('TODO', 'START', 'DONE')) default 'TODO',
  scheduled_date date,
  scheduled_time time,
  duration integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  user_id uuid references auth.users default auth.uid()
);

-- 3. Goals Table
create table goals (
  id text primary key,
  title text not null,
  target_date date not null,
  start_time time,
  completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users default auth.uid()
);

-- 4. Daily History Table
create table daily_history (
  date date,
  score integer not null,
  adult_completed integer default 0,
  child_completed integer default 0,
  rest_completed integer default 0,
  snapshot_data jsonb,
  user_id uuid references auth.users default auth.uid(),
  primary key (date, user_id)
);

-- ============ STEP 3: ENABLE RLS ============
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table goals enable row level security;
alter table daily_history enable row level security;

-- ============ STEP 4: POLICIES ============

-- PROFILES
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- TASKS
create policy "Users can view own tasks" on tasks for select using (auth.uid() = user_id);
create policy "Users can insert own tasks" on tasks for insert with check (auth.uid() = user_id);
create policy "Users can update own tasks" on tasks for update using (auth.uid() = user_id);
create policy "Users can delete own tasks" on tasks for delete using (auth.uid() = user_id);

-- GOALS
create policy "Users can view own goals" on goals for select using (auth.uid() = user_id);
create policy "Users can insert own goals" on goals for insert with check (auth.uid() = user_id);
create policy "Users can update own goals" on goals for update using (auth.uid() = user_id);
create policy "Users can delete own goals" on goals for delete using (auth.uid() = user_id);

-- DAILY HISTORY
create policy "Users can view own history" on daily_history for select using (auth.uid() = user_id);
create policy "Users can insert own history" on daily_history for insert with check (auth.uid() = user_id);
create policy "Users can update own history" on daily_history for update using (auth.uid() = user_id);

-- ============ STEP 5: AUTOMATION (OPTIONAL) ============
-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
