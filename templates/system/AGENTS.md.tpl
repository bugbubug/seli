# Repository Collaboration Contract

This repository is managed by `seli`.
Future changes should prefer rerunning `seli update` instead of hand-editing generated baseline files.

## Project Context

{{projectContext}}

## Response Principles

{{responsePrinciples}}

## Layer Priority

- `.codex/skills/*` > `.agents/skills/*` > system baseline

## Guardrails

- Keep this repository managed through `seli`; update collaboration baselines via `seli update`.
- Keep repository truth in `AGENTS.md`, `.selirc`, and `.seli.lock`.
- Do not treat `~/.codex` or `~/.claude` as repository truth.
- When project and team skills overlap, prefer the project skill.
