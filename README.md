# Brain Balance

A psychological task management system that helps you balance **Adult** (work/responsibility), **Child** (play/creativity), and **Rest** activities for optimal mental health.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Live Demo:** [https://mindsync-topaz.vercel.app/](https://mindsync-topaz.vercel.app/)


## 📂 Project Structure

```
/BrainBalance
├── /src              # Source code
│   ├── /app          # Next.js pages & API routes
│   ├── /components   # React components
│   ├── /store        # Zustand state management
│   └── /lib          # Utilities
├── /docs             # Documentation
│   ├── CONTEXT.md    # Project overview & AI context
│   └── TASKS.md      # Task tracker & session notes
└── /public           # Static assets
```

## 🔑 Environment Setup

Create `.env.local`:
```
GEMINI_API_KEY=your_key_here
AI_PROVIDER=gemini
```

## ✨ Features

- **Timeline View** - Hourly schedule with drag-drop
- **Kanban Board** - TODO/START/DONE columns
- **AI Coach** - Smart suggestions with conversation memory
- **Natural Language** - "gym tomorrow at 5pm" auto-parses
- **Balance Scoring** - Track Adult/Child/Rest ratio
- **Export/Import** - Save and load schedules

## 🚀 Deployment

We recommend **Vercel** for the easiest deployment.

1. **Push to GitHub**
2. **Import Project** in Vercel dashboard
3. **Add Environment Variables:**
   - `GROQ_API_KEY` (Required for AI features)
   - `AI_PROVIDER=groq`

For a detailed breakdown of free-tier hosting options (Vercel, Railway, Oracle Cloud, etc.), see:
👉 [Deployment Options Guide](docs/DEPLOYMENT_OPTIONS.md)

## 📖 For AI Assistants

Start by reading `docs/CONTEXT.md` for full project context.
