---
name: Session Summary
description: End-of-session reporting - updates docs/SESSION_LOG.md with what was accomplished
---

# Session Summary Skill

Use this skill at the end of each conversation to log what was accomplished.

## When to Trigger

- User says "wrap up", "end session", "what did we do", or "save progress"
- Conversation is ending naturally

## Steps

1. **Summarize the session:**
   - List main accomplishments (bullet points)
   - Note any issues encountered
   - List next steps/pending items

2. **Update `docs/SESSION_LOG.md`:**
   - Add new entry at the TOP of the log
   - Use format below

3. **Update `docs/TASKS.md`:**
   - Mark completed items with `[x]`
   - Add new items discovered during session

## Session Log Entry Format

```markdown
## [DATE] - [Session Title]

**Duration:** ~X hours  
**Focus:** Brief description

### Accomplished
- Thing 1
- Thing 2

### Issues
- Issue 1 (if any)

### Next Steps
- Next step 1
- Next step 2

---
```

## Example

```markdown
## January 20, 2026 - Project Reorganization

**Duration:** ~30 minutes  
**Focus:** Reorganized folder structure with anchor files

### Accomplished
- Moved project to `/BrainBalance`
- Created docs/CONTEXT.md and docs/TASKS.md
- Added .agent/skills structure

### Next Steps
- Test on mobile device
- Deploy to Vercel

---
```
