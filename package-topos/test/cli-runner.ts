import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));
const LOADER = import.meta.resolve("@oxc-node/core/register");

export async function runCli(
  args: string[],
  options: { cwd?: string; stdin?: string } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, ["--import", LOADER, CLI, ...args], { cwd: options.cwd }, (error, stdout, stderr) => {
      const code = error?.code ?? 0;
      if (typeof code !== "number" || error?.killed || error?.signal) reject(error);
      else resolve({ code, stdout, stderr });
    });
    child.stdin?.end(options.stdin);
  });
}
