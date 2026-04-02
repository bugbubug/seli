# ai-tool-init Agent Workflow

This repository is agent-first. Treat this file as the primary entrypoint when the repository is opened in Codex or Claude Code.

## Default Flow

1. Confirm the target project path.
2. Confirm the requested operation:
   - `init` for a new target project
   - `update` for an existing target project
   - `doctor` for validation only
   - `auto` when the agent should decide between `init` and `update`
3. Confirm the team provider root or the uploaded local team skill package paths. Current default provider is `ecc`.
4. Check whether the user uploaded documents or provided local document paths.
5. Scan the uploaded local team skill package paths and capture the available skills and summaries.
6. Normalize those inputs into `intake/manifest.json`.
7. Run `plan`.
8. Run `init` or `update`.
9. Run `doctor` and report the result.

## Required Inputs

- Target project path
- Operation intent or `auto`
- Provider root for `ecc` or uploaded local team skill package paths when team skills are required
- Uploaded docs or document paths when the target project needs custom skill, agent, or compat decisions

If one of these is missing, ask only for the missing value. Do not tell the user to read `README.md` before proceeding.

## Intake Contract

Use `intake/manifest.json` as the structured handoff from agent reasoning to CLI execution.

- Put reusable documents under `intake/docs/`
- Record document metadata in `documents`
- Record team provider roots in `providerRoots`
- Record uploaded package paths in `teamPackages`
- Read `catalog/team-skill-policies/ecc.json` when choosing `ecc` team skills
- Record selected team skills in `requestedTeamSkills` only when you want to override policy-based auto-selection
- Record selected project skill ids in `requestedProjectSkills` for generic generated skills
- Record `projectSkillBlueprints` when you want high-quality project-local skills generated from requirements and uploaded docs
- Record selected extra agents in `extraAgents`
- Record plugin compatibility intent in `compatPlugin`
- Record document-derived conclusions in `agentDecisions`

The CLI consumes structured intake only. Semantic interpretation of uploaded docs is the agent's responsibility.

## Team Skill Selection

- For `ecc`, use `catalog/team-skill-policies/ecc.json` as the first selection reference.
- Scan the uploaded package directories before `plan` so the agent knows which skills actually exist.
- If `requestedTeamSkills` is omitted, `ai-tool-init` will score the uploaded docs, notes, and agent decisions against that policy and auto-select from the skills that are actually present in the scanned packages.
- If the user explicitly asks for a different set, write `requestedTeamSkills` and treat that as authoritative.

## Project Skill Generation

- Use `projectSkillBlueprints` when the uploaded docs justify repository-specific built-in skills.
- A good blueprint includes:
  - `id`
  - `description`
  - `whenToUse`
  - `workflow`
  - `guardrails`
  - `relatedTeamSkills`
  - `sourcePaths`
  - `sourceDocumentLabels`
- If only `requestedProjectSkills` is present, `ai-tool-init` will still generate a generic project skill from the current intake context.

## Commands

```bash
bun run src/cli.ts plan --project /abs/path --intake intake/manifest.json --provider-root ecc=/abs/path
bun run src/cli.ts init --project /abs/path --intake intake/manifest.json --provider-root ecc=/abs/path
bun run src/cli.ts update --project /abs/path --intake intake/manifest.json --provider-root ecc=/abs/path
bun run src/cli.ts doctor --project /abs/path --intake intake/manifest.json --provider-root ecc=/abs/path
```

## Resolution Rules

- Provider root precedence: `--provider-root` > intake `providerRoots` > target `.ai-tool-init/config.json` > env var > catalog defaults
- If package paths come from intake, `init` and `update` persist them into the target project's `.ai-tool-init/config.json`
- If the provider root comes from `--provider-root` or intake, `init` and `update` persist it into the target project's `.ai-tool-init/config.json`
- `requestedOperation=auto` maps to:
  - `init` for an empty or new target project
  - `update` for a target project that already has repo-local state or `.ai-tool-init/config.json`

## Guardrails

- Only write inside the target project and this manager repository's intake workspace
- Do not write `~/.codex` or `~/.claude`
- Keep the three-layer model: `project > team > system`
- Treat plugin and marketplace assets as compatibility only
- When project and team skills overlap, prefer the project skill
