# Project: Brain Balance App

**Goal:** A "Second Brain" psychological task management system that helps users balance Adult (work/responsibility), Child (play/creativity), and Rest activities for optimal mental health.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, Zustand (state), Groq AI (Llama 3)

---

## Current State

- [x] **Phase 1:** Core Structure - Kanban board, task CRUD, Zustand persistence
- [x] **Phase 2:** AI Coach Integration - Conversation memory, smart suggestions, natural language parsing
- [ ] **Phase 3:** Mobile Optimization & Deployment (In Progress)

---

## Key Features (Completed)

| Feature | Status |
|---------|--------|
| Timeline View (drag-drop, date filtering) | ✅ |
| Kanban Board (TODO/START/DONE) | ✅ |
| AI Coach with conversation memory | ✅ |
| Natural language date/time ("gym tomorrow at 5pm") | ✅ |
| AI-Assisted Scheduling (type inference) | ✅ |
| Export/Import JSON | ✅ |
| Goals system with target dates | ✅ |
| Daily balance scoring | ✅ |

---

## Key Rules for AI

1. **DO NOT** search `.gemini/scratch` for source of truth
2. The code in `/src` is the **master version**
3. Update `docs/TASKS.md` when completing items
4. Read this file first to understand project context

---

## Project Structure

```
/BrainBalance
├── /src
│   ├── /app          # Next.js app router pages & API
│   ├── /components   # React components (Timeline, Kanban, AI Coach)
│   ├── /store        # Zustand state management
│   └── /lib          # Utilities
├── /docs
│   ├── CONTEXT.md    # This file (project brain)
│   └── TASKS.md      # Project memory (what's next)
├── /public           # Static assets
└── package.json
```

---

## Environment Variables

```
GROQ_API_KEY=your_key_here
AI_PROVIDER=groq
```

---

## Quick Start

```bash
npm install
npm run dev
```

Access at: `http://localhost:3000`
