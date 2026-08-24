import { assertEquals } from "@std/assert";
import { Dir } from "../../../src/geo.ts";
import { findTrace } from "../../../src/trace/test/trace-utils.ts";
import { traceMap } from "../../../src/trace/trace-map.ts";
import { attrs, children } from "../../../src/jsonml/jsonml.ts";
import { findEl } from "../../../src/jsonml/assert.ts";
import { buildQuickInspectorNode, hasQuickInspectorContent, hasQuickInspectorContinuity } from "../quick-inspector.ts";
import { OPEN_TERMINUS_GLYPH, setTerminusGlyph } from "../../model/mutate.ts";

Deno.test("quick inspector: only selections with available controls have content", () => {
  const map = traceMap(`\
┌─Box─┐
│     │
└─────┘

Note`);
  const box = findTrace(map, { type: "box", x: 0, y: 0 });
  const label = box.rawLabels![0];
  const note = findTrace(map, { type: "text", x: 0, y: 4 });

  assertEquals(hasQuickInspectorContent([box]), true);
  assertEquals(hasQuickInspectorContent([label]), false);
  assertEquals(hasQuickInspectorContent([note]), false);
});

Deno.test("quick inspector: continuity follows a line and either of its termini", () => {
  const map = traceMap(`A ───▶ B     C ───▶ D`);
  const first = findTrace(map, { type: "line", x: 2, y: 0, startDir: Dir.W });
  const second = findTrace(map, { type: "line", x: 15, y: 0, startDir: Dir.W });

  assertEquals(hasQuickInspectorContinuity([first], [first.target!]), true);
  assertEquals(hasQuickInspectorContinuity([first.source!], [first.target!]), true);
  assertEquals(hasQuickInspectorContinuity([first.target!], [first]), true);
  assertEquals(hasQuickInspectorContinuity([first], [second]), false);
});

Deno.test("quick inspector: style controls reflect active and unavailable choices", () => {
  const unicode = findTrace(traceMap(`\
┌───┐
│   │
└───┘`), { type: "box", x: 0, y: 0 });
  const unicodeNode = buildQuickInspectorNode([unicode]);
  const unicodeButton = findEl(unicodeNode, "button", { "data-prop": "family", "data-value": "unicode" })!;
  assertEquals(attrs(unicodeButton).class, "qi-btn active");

  const ascii = findTrace(traceMap(`\
+---+
|   |
+---+`), { type: "box", x: 0, y: 0 });
  const asciiNode = buildQuickInspectorNode([ascii]);
  const roundedButton = findEl(asciiNode, "button", { "data-prop": "corner", "data-value": "rounded" })!;
  assertEquals(attrs(roundedButton).disabled, true);

  const mixedNode = buildQuickInspectorNode([unicode, ascii]);
  const mixedUnicode = findEl(mixedNode, "button", { "data-prop": "family", "data-value": "unicode" })!;
  assertEquals(attrs(mixedUnicode).class, "qi-btn mixed");
});

Deno.test("quick inspector: hub controls mark the selected glyph", () => {
  const hub = findTrace(traceMap("●"), { type: "hub", x: 0, y: 0 });
  const node = buildQuickInspectorNode([hub]);
  const active = findEl(node, "button", { "data-action": "hub", "data-glyph": "●" })!;

  assertEquals(attrs(active).class, "qi-btn active");
});

Deno.test("quick inspector: terminus controls mark the selected arrow", () => {
  const line = findTrace(traceMap("A ───▶ B"), { type: "line", x: 2, y: 0, startDir: Dir.W });
  const node = buildQuickInspectorNode([line.target!]);
  const active = findEl(node, "button", { "data-action": "terminus", "data-glyph": line.target!.text })!;

  assertEquals(attrs(active).class, "qi-btn active");
});

Deno.test("quick inspector: open terminus derives variants from its path", () => {
  const line = findTrace(traceMap("╶──╴"), { type: "line", x: 0, y: 0, startDir: Dir.None });
  const node = buildQuickInspectorNode([line.target!]);
  const arrow = findEl(node, "button", { "data-action": "terminus", "data-glyph": "▶" });
  const open = findEl(node, "button", { "data-action": "terminus", "data-glyph": OPEN_TERMINUS_GLYPH })!;

  assertEquals(arrow !== undefined, true);
  assertEquals(attrs(open).class, "qi-btn active");
});

Deno.test("quick inspector: adaptive terminus starts with the plain terminus selected", () => {
  const map = traceMap("A ───▶ B");
  const line = findTrace(map, { type: "line", x: 2, y: 0, startDir: Dir.W });
  setTerminusGlyph(map, line.target!, "");

  const node = buildQuickInspectorNode([line.target!]);
  const plain = findEl(node, "button", { "data-action": "terminus", "data-glyph": "" })!;
  const open = findEl(node, "button", { "data-action": "terminus", "data-glyph": OPEN_TERMINUS_GLYPH })!;

  assertEquals(line.target!.recoilDir, Dir.E);
  assertEquals(attrs(plain).class, "qi-btn active");
  assertEquals(attrs(open).class, "qi-btn");
});

Deno.test("quick inspector: parsed box T-stops are plain termini, not half-wires", () => {
  const map = traceMap(`\
┌───┐   ┌───┐
│ C ├───┤ D │
└───┘   └───┘`);
  const line = findTrace(map, { type: "line", x: 4, y: 1, startDir: Dir.None });

  for (const terminus of [line.source!, line.target!]) {
    const node = buildQuickInspectorNode([terminus]);
    const plain = findEl(node, "button", { "data-action": "terminus", "data-glyph": "" })!;
    const open = findEl(node, "button", { "data-action": "terminus", "data-glyph": OPEN_TERMINUS_GLYPH })!;

    assertEquals(terminus.text, "");
    assertEquals(attrs(plain).class, "qi-btn active");
    assertEquals(attrs(open).class, "qi-btn");
  }
});

Deno.test("quick inspector: unsupported selections build an empty inspector", () => {
  const note = findTrace(traceMap("Note"), { type: "text", x: 0, y: 0 });

  assertEquals(children(buildQuickInspectorNode([note])), []);
});
