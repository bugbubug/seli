# ai-tool-init

Repo-local `Codex` / `Claude Code` scaffolding manager.

`AGENTS.md` is the primary entrypoint for AI agents. This README is the human fallback reference.

## Baseline

- Runtime: `Bun`
- Language: `TypeScript`
- Type policy: `strict`
- Module system: `ESM`

## Commands

```bash
bun install
bun run typecheck
bun test
bun run src/cli.ts plan --project /absolute/path/to/project --intake intake/manifest.json --provider-root ecc=/absolute/path/to/everything-claude-code
bun run src/cli.ts init --project /absolute/path/to/project --intake intake/manifest.json --provider-root ecc=/absolute/path/to/everything-claude-code
bun run src/cli.ts update --project /absolute/path/to/project --intake intake/manifest.json --provider-root ecc=/absolute/path/to/everything-claude-code
bun run src/cli.ts doctor --project /absolute/path/to/project --intake intake/manifest.json --provider-root ecc=/absolute/path/to/everything-claude-code
```

## Contract

- Only writes inside the target repository.
- Uses repo-local three-layer topology: `project > team > system`.
- Treats plugin compatibility as an optional compatibility layer, not the primary entrypoint.
- Uses `.ai-tool-init/config.json` as user-editable source of truth and `.ai-tool-init/lock.json` as generated state.
- Uses `Bun + TypeScript strict` as the repository baseline and recommends the same baseline in generated guidance.

## Agent-First Flow

When an agent opens this repository, the intended workflow is:

1. Read `AGENTS.md`
2. Collect target project path, requested operation, provider roots, and uploaded docs
3. Collect uploaded local team skill package paths and scan their available skills
4. Normalize those inputs into `intake/manifest.json`
5. Run `plan`
6. Run `init` or `update`
7. Run `doctor`

The CLI is deterministic. Uploaded-document interpretation and skill selection are the agent's responsibility.

## Intake

The standard intake workspace is:

```text
intake/
├── docs/
│   └── README.md
└── manifest.json
```

`intake/manifest.json` supports:

- `targetProjectPath`
- `requestedOperation`
- `profile`
- `providerRoots`
- `teamPackages`
- `documents`
- `requestedTeamSkills`
- `requestedProjectSkills`
- `projectSkillBlueprints`
- `extraAgents`
- `compatPlugin`
- `agentDecisions`
- `notes`

For `ecc`, skill selection policy lives in `catalog/team-skill-policies/ecc.json`.

- If `requestedTeamSkills` is omitted, `ai-tool-init` scores uploaded docs and agent decisions against that policy and auto-selects team skills.
- Uploaded `teamPackages` are scanned before selection, and only skills that actually exist in the scanned packages are eligible for auto-selection.
- If `projectSkillBlueprints` is present, `ai-tool-init` generates richer repo-local project skills from that blueprint.
- If only `requestedProjectSkills` is present, `ai-tool-init` still generates a generic project skill using the current intake context.

Runtime provider precedence is:

- `--provider-root`
- intake `providerRoots`
- target `.ai-tool-init/config.json`
- provider env vars such as `AI_TOOL_INIT_ECC_ROOT`
- catalog default candidates

If the effective provider root comes from `--provider-root` or intake, `init` and `update` persist it into the target project's `.ai-tool-init/config.json`.

## Initialized Layout

With the default profile, a target project will look like this after `init`:

```text
your-project/
├── .ai-tool-init/
│   ├── config.json
│   └── lock.json
├── .agents/
│   ├── plugins/
│   │   └── marketplace.json
│   └── skills/
│       ├── README.md
│       ├── tdd-workflow -> <ecc>/skills/tdd-workflow
│       ├── verification-loop -> <ecc>/skills/verification-loop
│       ├── coding-standards -> <ecc>/skills/coding-standards
│       ├── backend-patterns -> <ecc>/skills/backend-patterns
│       └── security-review -> <ecc>/skills/security-review
├── .claude/
│   ├── README.md
│   ├── rules/
│   │   └── README.md
│   ├── skills -> ../.codex/skills
│   └── settings.local.json
├── .codex/
│   ├── agents/
│   │   ├── explorer.toml
│   │   └── reviewer.toml
│   ├── skills/
│   │   ├── README.md
│   │   ├── repo-governance/
│   │   │   └── SKILL.md
│   │   ├── change-closeout/
│   │   │   └── SKILL.md
│   │   ├── team-skill-evolution/
│   │   │   └── SKILL.md
│   │   └── team-skill-sync/
│   │       └── SKILL.md
│   └── config.toml
├── plugins/
│   └── ai-tool-init-compat/
│       ├── .codex-plugin/
│       │   └── plugin.json
│       ├── README.md
│       └── skills -> ../../.codex/skills
├── AGENTS.md
└── CLAUDE.md -> AGENTS.md
```

Notes:

- `.ai-tool-init/config.json` is the human-edited project declaration.
- `.ai-tool-init/lock.json` is the generated managed-state file.
- `.codex/skills/*` is the project-built-in highest-priority layer.
- `.claude/skills/*` is a repo-local symlinked native entrypoint to the same project skills.
- `.agents/skills/*` is the team-mounted layer, currently intended for `ECC`.
- `plugins/*` and `.agents/plugins/marketplace.json` are compatibility-only outputs.

## Generated AGENTS.md

The generated `AGENTS.md` is the repository collaboration contract. It currently includes:

- Managed-by-`ai-tool-init` update guidance
- Layer priority:
  - project layer: `.codex/skills/*`
  - Claude native entrypoint: `.claude/skills/* -> .codex/skills/*`
  - team layer: `.agents/skills/*`
  - system baseline: repo-local `.codex/*` and `.claude/*`
- Effective precedence: `.codex/skills/* > .agents/skills/* > system baseline`
- Source-of-truth entrypoints:
  - `.ai-tool-init/config.json`
  - `.ai-tool-init/lock.json`
  - `AGENTS.md`
  - `CLAUDE.md -> AGENTS.md`
- Enabled team provider and its resolved root path
- Resolved team packages and selected skill sources
- Enabled team skills
- Built-in project skills
- Update guidance:
  - prefer rerunning `ai-tool-init update`
  - provider roots can persist in `.ai-tool-init/config.json`
  - runtime overrides can still use `--provider-root` or env vars
  - new document-driven changes should be normalized into intake before rerunning `update`
- Repo-local configuration entrypoints:
  - `.codex/config.toml`
  - `.codex/agents/*.toml`
  - `.codex/skills/*`
  - `.claude/skills/*`
  - `.agents/skills/*`
  - `.claude/README.md`
  - `.claude/rules/README.md`
- Engineering baseline guidance: recommend `Bun + TypeScript strict`
- Guardrails:
  - only trust repo-local state
  - do not treat `~/.codex` or `~/.claude` as project truth
  - treat plugin compatibility as secondary
  - prefer project skills when project and team skills overlap
