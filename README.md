# ai-tool-init

Repo-local `Codex` / `Claude Code` scaffolding manager.

## Commands

```bash
ai-tool-init plan --project /absolute/path/to/project
ai-tool-init init --project /absolute/path/to/project
ai-tool-init update --project /absolute/path/to/project
ai-tool-init doctor --project /absolute/path/to/project
```

## Contract

- Only writes inside the target repository.
- Uses repo-local three-layer topology: `project > team > system`.
- Treats plugin compatibility as an optional compatibility layer, not the primary entrypoint.
- Uses `.ai-tool-init/config.json` as user-editable source of truth and `.ai-tool-init/lock.json` as generated state.
