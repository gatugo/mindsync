# Implementation Summary: Duration Support & Refactoring

## Overview
Added first-class support for task duration across the application and centralized date/time parsing logic.

## Changes

### 1. Shared Utilities (`src/lib/datePatterns.ts`)
- Created a centralized utility for natural language parsing.
- **Features**:
  - Parses Date (e.g., "next monday", "jan 5th")
  - Parses Time (e.g., "5pm", "17:00", "in 2 hours")
  - **New**: Parses Duration (e.g., "15mins", "2 hours")
- Added `format12h` utility for consistent time display.

### 2. Store Updates (`src/store/useStore.ts`)
- Updated `Task` interface (in `types.ts` via import) to include `duration?: number`.
- Updated `addTask` action signature to accept `duration`.

### 3. Component Updates
- **AddTaskPanel**:
  - Smart "detected" preview now shows duration.
  - Manual add now correctly parses duration from title if present.
  - AI Smart Add passes suggested duration.
- **TimelineView**:
  - `saveNewTask` (quick add) now parses duration from title.
  - Removed deprecated local parser.
- **AICoachScreen / AICoachModal**:
  - Updated to use shared `parseNaturalDateTime` and `format12h`.
  - Action handlers now pass `duration` to `addTask`.
- **EditTaskModal**:
  - Confirmed existing support for duration editing.

## Logic Improvements
- **"15mins" handling**: Duration strings are extracted *before* time parsing to prevent "15 mins" being interpreted as "3:00 PM" (15:00).
- **Consolidated Code**: Removed duplicate parsing logic from 3 different files.
