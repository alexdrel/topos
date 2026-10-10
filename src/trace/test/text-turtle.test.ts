import { test } from "node:test";
// src/trace/test/textTurtle.test.ts
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { assertArrayMatch } from "./trace-utils.ts";
import { reclassifyTextTrace } from "../text-turtle.ts";

import { testTraceMap } from "../../test/test-utils.ts";

test("Turtle: reclassifies bracketed text as inline", () => {
  assertEquals(reclassifyTextTrace("[Spirit]"), { type: "inline", bracket: "[]", text: "[Spirit]", x: 0, w: 8, h: 1 });
  assertEquals(reclassifyTextTrace("(Opportunity)"), { type: "inline", bracket: "()", text: "(Opportunity)", x: 0, w: 13, h: 1 });
  assertEquals(reclassifyTextTrace("<Curiosity>"), { type: "inline", bracket: "<>", text: "<Curiosity>", x: 0, w: 11, h: 1 });
  assertEquals(reclassifyTextTrace("{Perseverance}"), { type: "inline", bracket: "{}", text: "{Perseverance}", x: 0, w: 14, h: 1 });
  assertEquals(reclassifyTextTrace("  [Spirit]   ", 4), { type: "inline", bracket: "[]", text: "[Spirit]", x: 6, w: 8, h: 1 });
});

test("Turtle: reclassifies and normalizes plain text", () => {
  assertEquals(reclassifyTextTrace("Spirit"), { type: "text", bracket: undefined, text: "Spirit", x: 0, w: 6, h: 1 });
  assertEquals(reclassifyTextTrace("  A\n\nBBB", 4), { type: "text", bracket: undefined, text: "  A\n\nBBB", x: 4, w: 3, h: 3 });
  assertEquals(reclassifyTextTrace("  A  \n\nBBB  \n  ", 4), { type: "text", bracket: undefined, text: "  A\n\nBBB\n", x: 4, w: 3, h: 4 });
  assertEquals(reclassifyTextTrace(""), { type: "text", bracket: undefined, text: "", x: 0, w: 0, h: 1 });
});

test("Turtle: Simple Text", () => {
  const diagram = "Hello World";
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 11, text: "Hello World" }
  ]);
});

test("Turtle: Preserve an unconnected arrow inside prose", () => {
  const traces = testTraceMap("input → parse");
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, text: "input → parse" },
  ]);
});

test("Turtle: Preserve a structural glyph inside an inline node", () => {
  const traces = testTraceMap("[Unmatched │ Wire ]");
  assertArrayMatch(traces, [
    { type: "inline", x: 0, y: 0, text: "[Unmatched │ Wire ]" },
  ]);
});

test("Turtle: Preserve unclaimed structural glyphs within text", () => {
  const diagram = "Hello │ World";
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 13, text: "Hello │ World" },
  ]);
});

test("Turtle: Preserve a compact mixed glyph run as one text", () => {
  const traces = testTraceMap("│X│");
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 3, text: "│X│" },
  ]);
});

test("Turtle: Pass through Dual-use Wires (ASCII)", () => {
  const diagram = "1 + 2 = 3";
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 9, text: "1 + 2 = 3" }
  ]);
});

test("Turtle: Structural gap blocks hub-label association", () => {
  const unicode = testTraceMap(`\
┌───────────────┐
│    # JWST    S├─● L2
└───────────────┘`, ["terminus"]);
  assertArrayMatch(unicode, [
    { type: "box" },
    { type: "line", text: "├─" },
    { type: "hub", text: "●", rawLabels: [{ text: "L2" }] },
    { type: "text", text: "# JWST" },
    { type: "text", text: "S" },
    { type: "label", text: "L2" },
  ]);

  const ascii = testTraceMap(`\
+---------------+
|    # JWST    S+-● L2
+---------------+`, ["terminus"]);
  assertArrayMatch(ascii, [
    { type: "box" },
    { type: "line", text: "+-" },
    { type: "hub", text: "●", rawLabels: [{ text: "L2" }] },
    { type: "text", text: "# JWST" },
    { type: "text", text: "S" },
    { type: "label", text: "L2" },
  ]);
});

test("Turtle: Stop at Claimed Location", () => {
  const diagram = `
┌───┐
│ A │
└───┘
`;
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 5, h: 3 },
    { type: "text", x: 2, y: 2, w: 1, text: "A" }
  ]);
});

test("Turtle: Max Space Run (Termination)", () => {
  const diagram = "One   Two";
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 3, text: "One" },
    { type: "text", x: 6, y: 0, w: 3, text: "Two" }
  ]);
});

test("Turtle: Trailing Spaces Backtracking", () => {
  const diagram = "Word  ";
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 4, text: "Word" }
  ]);
});

test("Turtle: Crossing Vertical Line", () => {
  const diagram = `\
  │
hello
  │
`;
  const traces = testTraceMap(diagram, ["terminus"]);
  assertArrayMatch(traces, [
    { type: "line", text: "│l│" },
    { type: "label", text: "hello" }
  ]);
});

test("Turtle: Connected Hubs with space (hubs as text)", () => {
  const diagram = `\
  ┌─▶ ◎ Top
  │        
  │        
  │        
  ▼        
  ◇ Bottom`;
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "line" },
    { type: "hub", text: "◎", rawLabels: [{ text: "Top" }] },
    { type: "hub", text: "◇", rawLabels: [{ text: "Bottom" }] },
  ]);
});

test("Turtle: Connected Hubs line with space (hubs as text)", () => {
  const diagram = `\
  ┌── ◎ Top
  │        
  │        
  │        
  ▼        
  ◇ Bottom`;
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "line" },
    { type: "hub", text: "◎", rawLabels: [{ text: "Top" }] },
    { type: "hub", text: "◇", rawLabels: [{ text: "Bottom" }] },
  ]);
});
test("Turtle: Line through hubs (hubs as line, rawLabels only text)", () => {
  const diagram = `\
  ◎ Top   
  │       
  │       
  │       
  │       
  ◇ Bottom`;
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "line" },
    { type: "hub", text: "◎", rawLabels: [{ text: "Top" }] },
    { type: "hub", text: "◇", rawLabels: [{ text: "Bottom" }] },
  ]);
});

test("Turtle: Labeled Hub to the left", () => {
  const diagram = `\
   Top ◎
       │
       │
       ▼
Bottom ◇`;
  const traces = testTraceMap(diagram);
  assertArrayMatch(traces, [
    { type: "line" },
    { type: "hub", text: "◎", rawLabels: [{ text: "Top" }] },
    { type: "hub", text: "◇", rawLabels: [{ text: "Bottom" }] },
  ]);
});

test("Turtle: Crossing Arrows", () => {
  const diagram = `
      ^
      |
    --+-->
      |
      V
    `;
  const traces = testTraceMap(diagram, ["line", "terminus"]);
  // no text should be found since all characters are part of lines
  assertArrayMatch(traces, []);
});
