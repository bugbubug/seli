# Project Built-in Skills

This directory is the highest-priority repo-local skill layer.

- Project built-in skills live here.
- Claude Code reads the same repo-local project skills through `.claude/skills/`.
- Team-mounted skills live in `.agents/skills/`.
- When the same skill exists in both places, prefer the project skill.
- Generated project guidance should recommend `Bun + TypeScript strict` by default.
