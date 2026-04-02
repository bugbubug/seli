# Repository Collaboration Contract

This repository is managed by `ai-tool-init`.

## Layer Priority

- Project built-in layer: `.codex/skills/*`
- Team layer: `.agents/skills/*`
- System baseline layer: repo-local `.codex/*` and `.claude/*`

Effective priority:

- `.codex/skills/*` > `.agents/skills/*` > system baseline

## Source Of Truth

- Human-editable manifest: `.ai-tool-init/config.json`
- Generated state lock: `.ai-tool-init/lock.json`
- Repo-local collaboration contract: `AGENTS.md`
- Claude Code compatibility entrypoint: `CLAUDE.md -> AGENTS.md`

## Enabled Team Providers

{{teamProviders}}

## Enabled Team Skills

{{teamSkills}}

## Built-in Project Skills

{{projectSkills}}

## Repo-local Entrypoints

- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.codex/skills/*`
- `.agents/skills/*`
- `.claude/README.md`
- `.claude/rules/README.md`

## Compatibility Layer

{{compatPlugin}}

## Guardrails

- Only write inside this repository.
- Do not treat `~/.codex` or `~/.claude` as repository truth.
- Treat plugin / marketplace assets as compatibility-only, not the primary loading path.
- When project and team skills overlap, prefer the project skill.
