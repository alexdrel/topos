import { assertEquals, assertStringIncludes } from "@std/assert";
import packageJson from "../package.json" with { type: "json" };
import { runCli } from "./cli-runner.ts";

Deno.test("CLI: no arguments show help without reading stdin", async () => {
  const result = await runCli([]);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, `Topos ${packageJson.version}`);
  assertStringIncludes(result.stdout, "Usage:");
  assertStringIncludes(result.stdout, "--inspect");
  assertEquals(result.stderr, "");
});

Deno.test("CLI: explicit stdin writes clean SVG to stdout", async () => {
  const result = await runCli(["-", "-d", "-t"], { stdin: "[ stdin ]" });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "<?xml");
  assertEquals(result.stderr, "");
});

Deno.test("CLI: trailing dash writes file input to stdout", async () => {
  const directory = await Deno.makeTempDir();
  const input = `${directory}/source.topos`;
  await Deno.writeTextFile(input, "[ stdout ]");

  try {
    const result = await runCli([input, "-"], { cwd: directory });

    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "<?xml");
    assertEquals(result.stderr, "");
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("CLI: file input derives output in the current directory", async () => {
  const directory = await Deno.makeTempDir();
  const input = `${directory}/source.topos`;
  await Deno.writeTextFile(input, "[ file ]");

  try {
    const result = await runCli([input], { cwd: directory });

    assertEquals(result.code, 0);
    assertStringIncludes(result.stderr, "Rendered");
    assertStringIncludes(
      await Deno.readTextFile(`${directory}/source.svg`),
      "<svg",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("CLI: output and render parameters use explicit syntax", async () => {
  const directory = await Deno.makeTempDir();
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
    assertStringIncludes(await Deno.readTextFile(output), "<svg");
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("CLI: failures are concise", async () => {
  const result = await runCli(["missing.topos"]);

  assertEquals(result.code, 1);
  assertStringIncludes(result.stderr, "topos: ENOENT");
  assertEquals(result.stderr.includes("    at "), false);
});

Deno.test("CLI: contradictory shortcuts are rejected", async () => {
  const result = await runCli(["-", "-l", "-d"], { stdin: "box" });

  assertEquals(result.code, 1);
  assertStringIncludes(
    result.stderr,
    "--light and --dark cannot be used together",
  );
});
