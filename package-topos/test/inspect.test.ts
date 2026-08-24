import { assertEquals, assertStringIncludes } from "@std/assert";
import { runCli } from "./cli-runner.ts";

Deno.test("Inspect: annotated JSON replaces SVG on stdout", async () => {
  const result = await runCli(["-", "--inspect"], { stdin: "[inspect]" });

  assertEquals(result.code, 0);
  const inspection = JSON.parse(result.stdout);
  assertEquals(Object.keys(inspection), ["root"]);
  assertEquals(inspection.root.children[0].label.trim(), "inspect");
  assertEquals(typeof inspection.root.children[0].xywh, "string");
  assertEquals("x" in inspection.root.children[0], false);
  assertEquals("text" in inspection.root.children[0], false);
  assertEquals("children" in inspection.root.children[0], false);
  assertEquals("style" in inspection.root.children[0], false);
  assertEquals("eidos" in inspection.root.children[0], false);
  assertEquals("segmentedText" in inspection.root.children[0], false);
  assertEquals(result.stdout.includes('"nodes"'), false);
  assertEquals(result.stdout.includes('"rawLabels"'), false);
  assertEquals(result.stdout.includes('"parent"'), false);
  assertEquals(result.stdout.includes('"links"'), false);
  assertEquals(result.stdout.includes("<?xml"), false);
});

Deno.test("Inspect: annotated JSON preserves SVG file output", async () => {
  const directory = await Deno.makeTempDir();
  const input = `${directory}/source.topos`;
  await Deno.writeTextFile(input, "[inspect]");

  try {
    const result = await runCli([input, "--inspect"], { cwd: directory });

    assertEquals(result.code, 0);
    assertEquals(
      JSON.parse(result.stdout).root.children[0].label.trim(),
      "inspect",
    );
    assertStringIncludes(
      await Deno.readTextFile(`${directory}/source.svg`),
      "<svg",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("Inspect: default Eidos is omitted while annotations remain", async () => {
  const result = await runCli(["-", "--inspect"], {
    stdin: "## AREA\n\n:legend\n{AREA}: red",
  });

  assertEquals(result.code, 0);
  const region = JSON.parse(result.stdout).root.children[0];
  assertEquals(region.label, "AREA");
  assertEquals("text" in region, false);
  assertEquals("header" in region, false);
  assertEquals(region.eidos, { color: "red" });
});

Deno.test("Inspect: edge endpoints reference canonical tree nodes", async () => {
  const result = await runCli(["-", "--inspect"], {
    stdin: "[A]──>[B]",
  });

  assertEquals(result.code, 0);
  const root = JSON.parse(result.stdout).root;
  assertEquals(root.children.map((node: { $id: string }) => node.$id), [
    "n0",
    "n1",
  ]);
  assertEquals("$id" in root, false);
  assertEquals(root.edges[0].source.$ref, "n0");
  assertEquals(root.edges[0].target.$ref, "n1");
  assertEquals(root.edges[0].source.label, "A");
  assertEquals(root.edges[0].target.label, "B");
  assertEquals("node" in root.edges[0].source, false);
  assertEquals("node" in root.edges[0].target, false);
  assertEquals("glyph" in root.edges[0].source, false);
  assertEquals("glyph" in root.edges[0].target, false);
  assertEquals(result.stdout.includes('"text": ""'), false);
  assertEquals(root.edges[0].source.offset, 1);
  assertEquals(root.edges[0].source.dir, "W");
  assertEquals(root.edges[0].target.dir, "E");
  assertEquals(root.edges[0].polyline, "3,0 5,0");
});

Deno.test("Inspect: split edges reference their canonical stem", async () => {
  const result = await runCli(["-", "--inspect"], {
    stdin: "[A]──┬──>[B]\n     └──>[C]",
  });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, '"$id": "e0"');
  assertStringIncludes(result.stdout, '"$ref": "e0"');
  assertEquals(result.stdout.includes('"style"'), false);
  assertEquals(result.stdout.includes('"isPort": false'), false);
});

Deno.test("Inspect: formatted prose keeps only meaningful segments", async () => {
  const result = await runCli(["-", "--inspect"], {
    stdin: `\
┌──────────────────┐
│ This is a        │
│ long _paragraph_ │
└──────────────────┘

[Other]

:legend
^%paragraph% ~> [Other]`,
  });

  assertEquals(result.code, 0);
  const inspection = JSON.parse(result.stdout);
  assertEquals(inspection.root.children[0].children[0].segmentedText[0], [
    "This is a",
  ]);
  assertEquals(inspection.root.children[0].children[0].segmentedText[1], [
    "long ",
    { text: "paragraph", italic: true },
  ]);
  assertEquals("segmentedText" in inspection.root.children[1], false);
  assertEquals("xywh" in inspection.root.edges[0], false);
  assertEquals(inspection.root.edges[0].polyline, "");
  assertEquals(result.stdout.includes("null"), false);
});
