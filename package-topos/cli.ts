#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { parseTopos, renderToSVG } from "#topos-core";
import packageJson from "./package.json" with { type: "json" };
import { inspectAnnotated } from "./inspect.ts";

const HELP = `Topos ${packageJson.version} — text-native spatial diagrams rendered as SVG.

Usage:
  topos <input> [parameter=value ...] [options]
  topos <input> - [parameter=value ...]
  topos - [parameter=value ...] [options]

Arguments:
  input                 Topos source file; use - to read stdin
  parameter=value       Supply a rendering parameter

Options:
  -o, --output <path>   SVG output file
  -l, --light           Shortcut for theme=light
  -d, --dark            Shortcut for theme=dark
  -t, --transparent     Force transparent output
  -b, --opaque          Force opaque output
  -f, --override        Command-line parameters override authored parameters
      --inspect         Print the resolved diagram as semantic JSON
  -h, --help            Show this help
  -v, --version         Show Topos and runtime versions

Defaults:
  File input writes <input-name>.svg in the current directory.
  Stdin input writes SVG to stdout.

Inspection can be used to understand the resolved hierarchy and connections
while writing SVG with -o. It is especially useful for coding agents working
with .topos source. The inspection JSON format is not stable and may change
without notice.

Examples:
  topos diagram.topos
  topos diagram.topos -
  topos diagram.topos theme=dark width=800 -f
  topos diagram.topos -d -t -o preview.svg`;

interface CliOptions {
  file: string;
  outFile?: string;
  renderOverrides: Record<string, string>;
  override: boolean;
  transparent?: boolean;
  inspect: boolean;
}

function version(): string {
  let runtime = `Node ${process.version}`;
  if (process.versions.electron) runtime = `Electron ${process.versions.electron}, ${runtime}`;
  return `topos ${packageJson.version} (${runtime})`;
}

function fail(message: string): never {
  console.error(`topos: ${message}`);
  console.error("Try 'topos --help' for usage.");
  process.exit(1);
}

function parseNodeArgs(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      light: { type: "boolean", short: "l" },
      dark: { type: "boolean", short: "d" },
      transparent: { type: "boolean", short: "t" },
      opaque: { type: "boolean", short: "b" },
      override: { type: "boolean", short: "f" },
      inspect: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}

function parseCliArgs(args: string[]): CliOptions | undefined {
  if (args.length === 0) {
    console.log(HELP);
    return undefined;
  }

  let parsed: ReturnType<typeof parseNodeArgs>;
  try {
    parsed = parseNodeArgs(args);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  if (parsed.values.help) {
    console.log(HELP);
    return undefined;
  }
  if (parsed.values.version) {
    console.log(version());
    return undefined;
  }

  let file = "";
  let positionalStdout = false;
  const renderOverrides: Record<string, string> = {};

  for (const arg of parsed.positionals) {
    const equals = arg.indexOf("=");
    if (equals > 0) {
      const name = arg.slice(0, equals);
      if (!/^[\w-]+$/.test(name)) fail(`invalid parameter name: ${name}`);
      renderOverrides[name] = arg.slice(equals + 1);
      continue;
    }

    if (!file) file = arg;
    else if (arg === "-" && file !== "-") positionalStdout = true;
    else fail(`unexpected argument: ${arg}`);
  }

  if (!file) fail("missing input file");
  if (positionalStdout && parsed.values.output !== undefined) {
    fail("output specified both as - and with --output");
  }
  if (parsed.values.light && parsed.values.dark) {
    fail("--light and --dark cannot be used together");
  }
  if (parsed.values.transparent && parsed.values.opaque) {
    fail("--transparent and --opaque cannot be used together");
  }
  if (parsed.values.light) renderOverrides.theme = "light";
  if (parsed.values.dark) renderOverrides.theme = "dark";

  let transparent: boolean | undefined;
  if (parsed.values.transparent) transparent = true;
  else if (parsed.values.opaque) transparent = false;
  return {
    file,
    outFile: positionalStdout ? "-" : parsed.values.output,
    renderOverrides,
    override: parsed.values.override ?? false,
    transparent,
    inspect: parsed.values.inspect ?? false,
  };
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  return source;
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options) return;

  const source = options.file === "-" ? await readStdin() : readFileSync(options.file, "utf8");
  const requestedTheme = options.renderOverrides.theme;
  if (
    requestedTheme !== undefined && requestedTheme !== "light" &&
    requestedTheme !== "dark"
  ) {
    fail(`theme must be light or dark, received: ${requestedTheme}`);
  }

  const ast = parseTopos(source);
  const inspection = options.inspect ? inspectAnnotated(ast) : undefined;
  const svg = renderToSVG(ast, {
    parameters: {
      ...options.renderOverrides,
      theme: requestedTheme ?? "light",
    },
    override: options.override,
    transparent: options.transparent,
  });

  const outFile = options.outFile ??
    (options.file === "-" ? "-" : defaultOutput(options.file));
  if (outFile === "-") {
    process.stdout.write(inspection ?? svg);
    return;
  }

  writeFileSync(outFile, svg);
  console.error(
    `Rendered ${options.file === "-" ? "stdin" : options.file} to ${outFile}`,
  );
  if (inspection !== undefined) process.stdout.write(inspection);
}

function defaultOutput(file: string): string {
  const name = basename(file);
  return /\.topos$/i.test(name) ? name.replace(/\.topos$/i, ".svg") : `${name}.svg`;
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`topos: ${message}`);
  process.exit(1);
}
