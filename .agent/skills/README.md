# Brain Balance Skills

This folder contains AI agent skills for the Brain Balance project.

## How Skills Work

Skills are instructions that extend the AI's capabilities for project-specific tasks. Each skill has:

- **SKILL.md** - Main instruction file with YAML frontmatter and detailed steps
- **scripts/** (optional) - Helper scripts the skill can execute
- **examples/** (optional) - Reference implementations

## Available Skills

| Skill | Description |
|-------|-------------|
| [session-summary](./session-summary/SKILL.md) | End-of-session reporting and logging |

## Creating New Skills

1. Create a folder: `.agent/skills/[skill-name]/`
2. Add a `SKILL.md` with this format:

```yaml
---
name: Skill Name
description: Short description for AI discovery
---

# Skill Name

Detailed instructions here...
```

3. Reference the skill by asking: "Use the [skill-name] skill"
