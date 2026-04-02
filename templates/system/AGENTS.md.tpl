# Repository Collaboration Contract

This repository is managed by `ai-tool-init`.
Future changes should prefer rerunning `ai-tool-init update` instead of hand-editing generated baseline files.

## Layer Priority

- Project built-in layer: `.codex/skills/*`
- Claude native project-skill entrypoint: `.claude/skills/* -> .codex/skills/*`
- Team layer: `.agents/skills/*`
- System baseline layer: repo-local `.codex/*` and `.claude/*`

Effective priority:

- `.codex/skills/*` > `.agents/skills/*` > system baseline

## Source Of Truth

- Human-editable manifest: `.ai-tool-init/config.json`
- Generated state lock: `.ai-tool-init/lock.json`
- Repo-local collaboration contract: `AGENTS.md`
- Claude Code compatibility entrypoint: `CLAUDE.md -> AGENTS.md`

## Update Workflow

- Keep this repository managed through `ai-tool-init`.
- Before `plan`, read uploaded project docs and every user-provided local team skill package path.
- Normalize uploaded team skill package paths into intake `teamPackages`.
- Team provider package roots can persist in `.ai-tool-init/config.json`.
- Runtime overrides can still come from `--provider-root <provider>=<abs-path>` or provider env vars.
- When new documents or package changes affect skill, agent, or compat choices, record those decisions in intake and rerun `update`.
- Project-local skills may be generated from intake blueprints and uploaded documents; update them through `ai-tool-init` instead of editing their baseline structure manually.

## Enabled Team Providers

{{teamProviders}}

## Resolved Team Packages

{{teamPackages}}

## Enabled Team Skills

{{teamSkills}}

## Team Skill Sources

{{selectedSkillSources}}

## Built-in Project Skills

{{projectSkills}}

## Repo-local Entrypoints

- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.codex/skills/*`
- `.claude/skills/*`
- `.agents/skills/*`
- `.claude/README.md`
- `.claude/rules/README.md`

## Engineering Baseline

- This management repository uses `TypeScript strict` and `Bun-only` workflows.
- Generated guidance should recommend `Bun + TypeScript strict` as the default engineering baseline.
- Prefer repo-local configuration over global user state.

## Compatibility Layer

{{compatPlugin}}

## Guardrails

- Only write inside this repository.
- Do not treat `~/.codex` or `~/.claude` as repository truth.
- Treat plugin / marketplace assets as compatibility-only, not the primary loading path.
- When project and team skills overlap, prefer the project skill.
