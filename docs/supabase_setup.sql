-- Supabase Schema for MindSync (FIXED for anon access)
-- Run this in the Supabase SQL Editor

-- ============ STEP 1: DROP OLD TABLES ============
-- (If you already ran the previous script)
DROP TABLE IF EXISTS daily_history;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS tasks;

-- ============ STEP 2: CREATE TABLES WITH TEXT IDs ============

-- 1. Tasks Table
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
  user_id text default 'anon'
);

-- 2. Goals Table
create table goals (
  id text primary key,
  title text not null,
  target_date date not null,
  start_time time,
  completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id text default 'anon'
);

-- 3. Daily History Table
create table daily_history (
  date date primary key,
  score integer not null,
  adult_completed integer default 0,
  child_completed integer default 0,
  rest_completed integer default 0,
  snapshot_data jsonb,
  user_id text default 'anon'
);

-- ============ STEP 3: ENABLE RLS (but allow anon) ============
alter table tasks enable row level security;
alter table goals enable row level security;
alter table daily_history enable row level security;

-- Policies: Allow all operations for now (anon access for MVP)
create policy "Allow all for tasks" on tasks for all using (true) with check (true);
create policy "Allow all for goals" on goals for all using (true) with check (true);
create policy "Allow all for daily_history" on daily_history for all using (true) with check (true);
