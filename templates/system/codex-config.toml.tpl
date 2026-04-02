#:schema https://developers.openai.com/codex/config-schema.json

approval_policy = "on-request"
sandbox_mode = "workspace-write"

[agents.explorer]
description = "Read-only explorer for repo-local discovery."
config_file = "agents/explorer.toml"

[agents.reviewer]
description = "Read-only reviewer for correctness, regressions, and missing tests."
config_file = "agents/reviewer.toml"
