import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const RUNTIME_TOKEN = "{{TOPOS_RUNTIME}}";
const SCRIPT_TOKEN = "{{TOPOS_SCRIPT}}";

interface CliLauncherOptions {
  storagePath: string;
  extensionPath: string;
  runtimePath: string;
  platform?: typeof process.platform;
}

export interface CliLauncher {
  binPath: string;
  launcherPath: string;
}

export async function ensureCliLauncher(options: CliLauncherOptions): Promise<CliLauncher> {
  const platform = options.platform ?? process.platform;
  const windows = isWindows(platform);
  const filename = launcherFilename(windows);
  const binPath = join(options.storagePath, "bin");
  const launcherPath = join(binPath, filename);
  const templatePath = join(options.extensionPath, "bin", filename);
  const scriptPath = join(options.extensionPath, "out", "topos.js");
  const template = await readFile(templatePath, "utf8");
  const content = renderLauncher(template, options.runtimePath, scriptPath, windows);

  await mkdir(binPath, { recursive: true });
  await writeFile(launcherPath, content, "utf8");
  if (!windows) await chmod(launcherPath, 0o755);
  return { binPath, launcherPath };
}

export function cliLauncherPath(storagePath: string, platform: typeof process.platform = process.platform): string {
  return join(storagePath, "bin", launcherFilename(isWindows(platform)));
}

function isWindows(platform: typeof process.platform): boolean {
  return platform === "win32";
}

function launcherFilename(windows: boolean): string {
  return windows ? "topos.cmd" : "topos";
}

function renderLauncher(template: string, runtimePath: string, scriptPath: string, isWindows: boolean): string {
  if (!template.includes(RUNTIME_TOKEN) || !template.includes(SCRIPT_TOKEN)) {
    throw new Error("Topos CLI launcher template is missing required values");
  }
  const escape = isWindows ? escapeBatchValue : escapeShellValue;
  const rendered = template.replaceAll(RUNTIME_TOKEN, escape(runtimePath)).replaceAll(SCRIPT_TOKEN, escape(scriptPath));
  if (rendered.includes(RUNTIME_TOKEN) || rendered.includes(SCRIPT_TOKEN)) throw new Error("Topos CLI launcher template contains unresolved values");
  return rendered;
}

function escapeShellValue(value: string): string {
  return value.replaceAll("'", `'"'"'`);
}

function escapeBatchValue(value: string): string {
  return value.replaceAll("%", "%%").replaceAll('"', '""');
}
