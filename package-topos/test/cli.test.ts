import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { assertStringIncludes } from "../../src/test/assertions.ts";
import packageJson from "../package.json" with { type: "json" };
import { runCli } from "./cli-runner.ts";

test("CLI: no arguments show help without reading stdin", async () => {
  const result = await runCli([]);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, `Topos ${packageJson.version}`);
  assertStringIncludes(result.stdout, "Usage:");
  assertStringIncludes(result.stdout, "--inspect");
  assertEquals(result.stderr, "");
});

test("CLI: explicit stdin writes clean SVG to stdout", async () => {
  const result = await runCli(["-", "-d", "-t"], { stdin: "[ stdin ]" });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "<?xml");
  assertEquals(result.stderr, "");
});

test("CLI: trailing dash writes file input to stdout", async () => {
  const directory = await mkdtemp(join(tmpdir(), "topos-test-"));
  const input = `${directory}/source.topos`;
  await writeFile(input, "[ stdout ]");

  try {
    const result = await runCli([input, "-"], { cwd: directory });

    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "<?xml");
    assertEquals(result.stderr, "");
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("CLI: file input derives output in the current directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "topos-test-"));
  const input = `${directory}/source.topos`;
  await writeFile(input, "[ file ]");

  try {
    const result = await runCli([input], { cwd: directory });

    assertEquals(result.code, 0);
    assertStringIncludes(result.stderr, "Rendered");
    assertStringIncludes(
      await readFile(`${directory}/source.svg`, "utf8"),
      "<svg",
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("CLI: output and render parameters use explicit syntax", async () => {
  const directory = await mkdtemp(join(tmpdir(), "topos-test-"));
  const output = `${directory}/result.svg`;

  try {
    const result = await runCli([
      "-",
      "-o",
      output,
      "theme=dark",
      "bg=navy",
      "-f",
      "-b",
    ], {
      stdin: "[ options ]",
    });

    assertEquals(result.code, 0);
    assertStringIncludes(result.stderr, `to ${output}`);
    assertStringIncludes(await readFile(output, "utf8"), "<svg");
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("CLI: failures are concise", async () => {
  const result = await runCli(["missing.topos"]);

  assertEquals(result.code, 1);
  assertStringIncludes(result.stderr, "topos: ENOENT");
  assertEquals(result.stderr.includes("    at "), false);
});

test("CLI: contradictory shortcuts are rejected", async () => {
  const result = await runCli(["-", "-l", "-d"], { stdin: "box" });

  assertEquals(result.code, 1);
  assertStringIncludes(
    result.stderr,
    "--light and --dark cannot be used together",
  );
});
