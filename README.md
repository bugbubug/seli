# Seli

```text
   .---.
  /     \
 ( @   @ )   Seli: Diving into your project...
  )  -  (
 /       \
/         \
\  \---/  /
 `-------'
```

**Seli (Seal + Init)**

AI Coding's First Step.

Dive in, Seal the deal.

## Install

```bash
npm install -g seli
```

## Start

```bash
seli init --project /absolute/path/to/project --provider-root ecc=/absolute/path/to/everything-claude-code
```

Core command: `seli init`

## What Seli Does

- Boots a project into an AI-ready collaboration structure (`project > team > system`).
- Mounts team skills from local provider packages (ECC by default).
- Generates repo-local agent context and project skills for Codex/Claude.
- Keeps managed state deterministic with config + lock contracts.

## State Contract

Seli stores state at project root:

- `.selirc` (human-editable config)
- `.seli.lock` (generated lock state)

Read/resolve precedence for provider roots:

1. `--provider-root`
2. intake `providers.rootPath`
3. persisted `.selirc`
4. env var (`SELI_ECC_ROOT`)
5. catalog defaults and local candidate discovery

Legacy state files are not supported. Projects must use `.selirc` and `.seli.lock` only.

## CLI Experience

In human/explain mode:

- `seli` shows Seli banner + help
- `seli init` / `seli update` show status lines:
  - `[Seli] 🦭 Searching for local skills (Flink, Spark, StarRocks...)...`
  - `[Seli] ✨ Sealing the configuration for your agent...`
- `seli init` ends with:
  - `[Seli] ✅ Project initialized. Now ask Claude or Codex to 'read Seli context'.`

In `--json` mode, output is strict JSON (no banner/status text).

## Generated Outputs (Default)

```text
your-project/
├── .selirc
├── .seli.lock
├── .agents/
│   ├── skill_team.md
│   └── skills/
├── .codex/
├── .claude/
├── AGENTS.md
└── CLAUDE.md -> AGENTS.md
```

`skill_team.md` includes a `system_prompt` section:

- `本项目由 Seli 初始化，请参考本地技能包进行代码生成。`

## Local Development

```bash
bun install
bun run typecheck
bun test
bun run src/cli.ts help
```

## GitHub & Publish

This repository does not ship GitHub Actions workflows by default.
Use the release/publish checklist here:

- [`docs/github-publish.md`](docs/github-publish.md)
