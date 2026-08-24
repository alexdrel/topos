# Agent Instructions

The canonical project instructions live in [`.agents/rules/`](.agents/rules/).

Before working in this repository, read every Markdown file in that directory and follow its instructions. Apply rules according to their frontmatter `trigger` when present; treat files without trigger metadata as generally applicable.

Keep project rules in `.agents/rules/` rather than duplicating them here. This file exists only as a compatibility entry point for agents that discover `AGENTS.md` automatically.

## Codex tool compatibility

When running as Codex, follow the intent of `.agents/rules/tools.md`, but use the equivalent tools exposed by the Codex environment. Codex is exempt from specific VS Code/Antigravity MCP tool names that are not available; in particular, it may use `apply_patch` for edits and `rg`/shell commands for workspace inspection.
