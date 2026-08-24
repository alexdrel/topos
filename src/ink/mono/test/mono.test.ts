import { assertEquals } from "@std/assert";
import { traceMap } from "../../../trace/trace-map.ts";
import { type MonoBox, type MonoFormat, type MonoLine, renderToMono } from "../mono.ts";

function render(source: string, name = "Test Diagram"): MonoFormat {
  return JSON.parse(renderToMono(traceMap(source), name));
}

Deno.test("Monosketch: exports traced boxes, line, arrowhead, and connectors", () => {
  const data = render(`\
┌───────┐      ┌───────┐
│   A   ├─────▶│   B   │
└───────┘      └───────┘`);
  const boxes = data.root.ss.filter((shape): shape is MonoBox => shape.type === "T");
  const lines = data.root.ss.filter((shape): shape is MonoLine => shape.type === "L");

  assertEquals(data.version, 2);
  assertEquals(data.extra.name, "Test Diagram");
  assertEquals(boxes.length, 2);
  assertEquals(lines.length, 1);
  assertEquals(lines[0].e.aee, true);
  assertEquals(lines[0].e.aeu, "A1");
  assertEquals(lines[0].jps.length, 2);
  assertEquals(data.connectors.length, 2);
});

Deno.test("Monosketch: preserves ceiling and internal labels", () => {
  const data = render(`\
┌── Grammar ──┐
│             │
│   Action    │
└─────────────┘`);
  const boxes = data.root.ss.filter((shape): shape is MonoBox => shape.type === "T");

  assertEquals(boxes.some((box) => box.t === "\u00A0Grammar\u00A0"), true);
  assertEquals(boxes.some((box) => box.t === "Action"), true);
  assertEquals(boxes.find((box) => box.b === "0|0|15|4")?.t, "");
});

Deno.test("Monosketch: preserves line labels as standalone text", () => {
  const data = render(`\
┌───┐  Label  ┌───┐
│ A ├────────▶│ B │
└───┘         └───┘`);
  const boxes = data.root.ss.filter((shape): shape is MonoBox => shape.type === "T");
  assertEquals(boxes.some((box) => box.t.includes("Label")), true);
});

Deno.test("Monosketch: exports traced stack layers and styles", () => {
  const data = render(`\
┌────────┐
│┌───────┴┐
└┤┌───────┴┐
 └┤ Stack  │
  └────────┘`);
  const boxes = data.root.ss.filter((shape): shape is MonoBox => shape.type === "T");
  assertEquals(boxes.length >= 3, true);
});

Deno.test("Monosketch: maps traced terminus glyphs", () => {
  const source = "A ──▶ B";
  const cases = [
    ["▷", "A12"],
    ["■", "A2"],
    ["□", "A21"],
    ["◆", "A220"],
    ["◇", "A221"],
    ["○", "A3"],
    ["◎", "A4"],
    ["●", "A5"],
    ["├", "A6"],
    ["┣", "A61"],
    ["╠", "A62"],
  ];

  for (const [glyph, expected] of cases) {
    const traces = traceMap(source);
    const line = traces.traces.find((trace) => trace.type === "line")!;
    line.target!.text = glyph;
    const data = JSON.parse(renderToMono(traces)) as MonoFormat;
    const exported = data.root.ss.find((shape): shape is MonoLine => shape.type === "L")!;
    assertEquals(exported.e.aeu, expected);
  }
});

Deno.test("Monosketch: maps traced box stroke styles", () => {
  const cases = [
    [{ family: "unicode", weight: "single", corner: "sharp" }, "S1"],
    [{ family: "unicode", weight: "bold", corner: "sharp" }, "S2"],
    [{ family: "unicode", weight: "double", corner: "sharp" }, "S3"],
    [{ family: "unicode", weight: "single", corner: "rounded" }, "S4"],
  ] as const;

  for (const [style, expected] of cases) {
    const traces = traceMap("┌───┐\n│ A │\n└───┘");
    traces.traces.find((trace) => trace.type === "box")!.style = style;
    const data = JSON.parse(renderToMono(traces)) as MonoFormat;
    const box = data.root.ss.find((shape): shape is MonoBox => shape.type === "T")!;
    assertEquals(box.e.be.bu, expected);
  }
});

Deno.test("Monosketch: adjacent hubs become line terminals", () => {
  const data = render(`\
●───── A

B ─────□

◆───── C`);
  const lines = data.root.ss.filter((shape): shape is MonoLine => shape.type === "L");
  const terminals = lines.flatMap((line) => [line.e.asu, line.e.aeu]);

  assertEquals(terminals.includes("A5"), true); // ●
  assertEquals(terminals.includes("A21"), true); // □
  assertEquals(terminals.includes("A220"), true); // ◆
  const circle = lines.find((line) => line.e.asu === "A5")!;
  assertEquals(circle.jps.slice(0, 2), ["0|0", "5|0"]);
});

Deno.test("Monosketch: preserves multiple text rows inside boxes", () => {
  const data = render(`\
┌────────────┐
│ first      │
│ second     │
└────────────┘`);
  const boxes = data.root.ss.filter((shape): shape is MonoBox => shape.type === "T");

  assertEquals(boxes.find((box) => box.t === "first")?.b, "2|1|5|1");
  assertEquals(boxes.find((box) => box.t === "second")?.b, "2|2|6|1");
});
