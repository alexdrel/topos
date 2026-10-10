---
trigger: always_on
---

# Tool Usage Rules

- **Prefer Built-in Tools:** Always use built-in MCP tools (like `replace_file_content`, `multi_replace_file_content`, `grep_search`, `view_file`, `list_dir`) over writing ad hoc Python scripts, bash scripts, or using shell utilities (like `sed`, `awk`, `cat`, `ls`, or `grep`) via `run_command`.
- **Reasoning:** Built-in tools are safer, faster, less error-prone, and provide better structured output/integration with the agent system compared to unconstrained shell scripting.

- **No Unsupervised Git Reverts:** NEVER run `git checkout <file>` or `git reset` or `git restore` to revert changes to files without explicitly confirming with the user first.
- **Reasoning:** Reverting files automatically can easily destroy valid staged or uncommitted work (such as previous correct refactorings) and lead to confusing state loss. Always pause and ask for permission before reverting.

- **Script Runtime Environments:** If you absolutely MUST write a custom script (because built-in tools genuinely fall short), use `node` or `python3`. Node runs erasable TypeScript directly. For TypeScript requiring transformation, keep runtime setup inside an npm script and document the npm command. Use `npm run --silent cli -- <arguments>` for the project CLI. Do NOT assume the presence of `deno`, `bun`, `go`, or other runtimes.
- **Reasoning:** Node.js 26 or later and the repository's npm dependencies are the development environment.

- **Move Files with `git`**: When moving/renaming files, always use `git mv` instead of standard `mv`. Git commands are pre-approved, avoiding prompt friction.
- **Workspace `tmp/`**: Always use `<project>/tmp/` for one-time scripts or debug files. Never use the system `/tmp` or the project root.
- **No Manual Cleanup of `tmp/`**: Do not run `rm` commands to clean up files in the `tmp/` directory. Unapproved shell commands like `rm` trigger manual user prompts, and the `tmp/` folder is gitignored and can be cleaned up in batch.
- **No `mkdir tmp`**: Do not run `mkdir tmp` or check for its existence; the `tmp/` directory is already present at the project root.
