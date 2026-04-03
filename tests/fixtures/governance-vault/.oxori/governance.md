---
type: governance
---

## Write Rules

- `rules/` — human-only, agents cannot modify
- `memory/` — agents can create and append
- All agent-created files must include `author` and `created_at` in frontmatter
- Agents cannot delete files

## Agent Permissions

- agent:researcher — read all, write to memory/
- agent:planner — read all, write to tasks/ and decisions/
