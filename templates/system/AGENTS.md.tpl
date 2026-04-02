# Repository Collaboration Contract

This repository is managed by `seli`.
Future changes should prefer rerunning `seli update` instead of hand-editing generated baseline files.

## Agent First-Question Protocol

When users ask what this project is or how to get started, answer directly without opening with repository-scanning narration.

Trigger phrases include:

- `这是什么项目`
- `怎么用`
- `我需要给你什么`
- `如何帮我配置环境`
- "what is this project"
- "how do I use this"
- "what do you need from me"

Language behavior (Chinese and English only):

- If the user asks in Chinese, answer in Chinese.
- If the user asks in English, answer in English.
- If mixed, follow the dominant language in the user message.

Required response format:

1. `项目特点`
- State that Seli is an AI collaboration bootstrap/governance CLI for Codex/Claude repository setup.
- State that Seli configures collaboration baselines and does not implement business features.
2. `你只需要提供`
- Minimum required:
- Target project absolute path.
- Preferred operation (`init` or `update`; can auto-detect when omitted).
- Recommended:
- Your team skill package root path (`--provider-root <provider>=<abs-path>`), or ensure the corresponding provider env var is set.
- Optional:
- Intake manifest path.
- Requested team skills.
3. `我会帮你做`
- Explain the execution flow as `plan -> init/update -> doctor`.
- Explain outputs as `.selirc`, `.seli.lock`, and repo-local Codex/Claude collaboration files.

Do not start this kind of answer with statements like "I will scan the repository first."

## Layer Priority

- Project built-in layer: `.codex/skills/*`
- Claude native project-skill entrypoint: `.claude/skills/* -> .codex/skills/*`
- Team layer: `.agents/skills/*`
- System baseline layer: repo-local `.codex/*` and `.claude/*`

Effective priority:

- `.codex/skills/*` > `.agents/skills/*` > system baseline

## Source Of Truth

- Human-editable manifest: `.selirc`
- Generated state lock: `.seli.lock`
- Repo-local collaboration contract: `AGENTS.md`
- Claude Code compatibility entrypoint: `CLAUDE.md -> AGENTS.md`

## Update Workflow

- Keep this repository managed through `seli`.
- Before `plan`, read uploaded project docs and every user-provided local team skill package path.
- Normalize uploaded team skill package paths into intake `teamPackages`.
- Team provider package roots can persist in `.selirc`.
- Runtime overrides can still come from `--provider-root <provider>=<abs-path>` or provider env vars.
- When new documents or package changes affect skill or agent choices, record those decisions in intake and rerun `update`.
- Project-local skills may be generated from intake blueprints and uploaded documents; update them through `seli` instead of editing their baseline structure manually.

## Tech Stack Guidance

- For new or near-empty repositories, run stack guidance before implementation by default.
- For existing repositories, do not interrupt with stack guidance unless the user explicitly asks for stack or framework changes.
- If the user has no preferred stack, propose 2-3 viable options with explicit tradeoffs and wait for confirmation.
- If the user already picked a stack, prioritize that choice and only suggest alternatives when hard constraints conflict.
- Keep stack decision ownership with the user; do not force a stack.
- Persist stack conclusions in intake:
  - Use `decisions` ids with `stack-*` for the chosen stack and rationale.
  - Use `notes` for constraints such as deployment environment, team familiarity, performance targets, and budget limits.
- Keep future `update` runs consistent with the latest accepted stack decision unless the user requests a change.

## Git Management Guidance

- After creating a new or near-empty project scaffold, guide Git setup by default.
- For established repositories, do not enforce Git-process re-onboarding unless the user asks for workflow changes.
- Guide baseline Git flow in order:
  - repository initialization state and default branch decision
  - initial baseline commit quality
  - remote setup and first push (when remote details are available)
  - branch-per-change and review-ready commit practices for ongoing work
- Keep Git process ownership with the user; do not force provider-specific defaults.
- Persist Git workflow conclusions in intake:
  - Use `decisions` ids with `git-*` for chosen workflow and rationale.
  - Use `notes` for constraints such as branch protections, CI gates, and release policies.
- Keep future `update` runs aligned with the latest accepted Git workflow decisions unless the user requests a change.

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
- `.agents/skill_team.md`
- `.claude/README.md`
- `.claude/rules/README.md`

## Engineering Baseline

- This management repository uses `TypeScript strict` and `Bun-only` workflows.
- Generated guidance should recommend `Bun + TypeScript strict` as the default engineering baseline.
- Prefer repo-local configuration over global user state.

## Guardrails

- Only write inside this repository.
- Do not treat `~/.codex` or `~/.claude` as repository truth.
- When project and team skills overlap, prefer the project skill.
