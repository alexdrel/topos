import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

mkdirSync("tmp", { recursive: true });
const result = spawnSync(process.execPath, [
  "../node_modules/@vscode/vsce/vsce",
  "package",
  "--no-dependencies",
  "--out",
  "../tmp/topos.vsix",
], { cwd: "vscode-topos", stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
