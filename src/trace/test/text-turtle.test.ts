// src/trace/test/textTurtle.test.ts
import { assertEquals } from "@std/assert";
import { assertArrayMatch } from "./trace-utils.ts";
import { reclassifyTextTrace } from "../text-turtle.ts";

import { flushPendingWrites, testTraceMap, testCompleted } from "../../test/test-utils.ts";

Deno.test.afterEach(flushPendingWrites);

Deno.test("Turtle: reclassifies bracketed text as inline", () => {
  assertEquals(reclassifyTextTrace("[Spirit]"), { type: "inline", bracket: "[]", text: "[Spirit]", x: 0, w: 8, h: 1 });
  assertEquals(reclassifyTextTrace("(Opportunity)"), { type: "inline", bracket: "()", text: "(Opportunity)", x: 0, w: 13, h: 1 });
  assertEquals(reclassifyTextTrace("<Curiosity>"), { type: "inline", bracket: "<>", text: "<Curiosity>", x: 0, w: 11, h: 1 });
  assertEquals(reclassifyTextTrace("{Perseverance}"), { type: "inline", bracket: "{}", text: "{Perseverance}", x: 0, w: 14, h: 1 });
  assertEquals(reclassifyTextTrace("  [Spirit]   ", 4), { type: "inline", bracket: "[]", text: "[Spirit]", x: 6, w: 8, h: 1 });
});

Deno.test("Turtle: reclassifies and normalizes plain text", () => {
  assertEquals(reclassifyTextTrace("Spirit"), { type: "text", bracket: undefined, text: "Spirit", x: 0, w: 6, h: 1 });
  assertEquals(reclassifyTextTrace("  A\n\nBBB", 4), { type: "text", bracket: undefined, text: "  A\n\nBBB", x: 4, w: 3, h: 3 });
  assertEquals(reclassifyTextTrace("  A  \n\nBBB  \n  ", 4), { type: "text", bracket: undefined, text: "  A\n\nBBB\n", x: 4, w: 3, h: 4 });
  assertEquals(reclassifyTextTrace(""), { type: "text", bracket: undefined, text: "", x: 0, w: 0, h: 1 });
});

Deno.test("Turtle: Simple Text", (t) => {
  const diagram = "Hello World";
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 11, text: "Hello World" }
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Preserve an unconnected arrow inside prose", (t) => {
  const traces = testTraceMap(t, "input → parse");
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, text: "input → parse" },
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Preserve a structural glyph inside an inline node", (t) => {
  const traces = testTraceMap(t, "[Unmatched │ Wire ]");
  assertArrayMatch(traces, [
    { type: "inline", x: 0, y: 0, text: "[Unmatched │ Wire ]" },
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Preserve unclaimed structural glyphs within text", (t) => {
  const diagram = "Hello │ World";
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 13, text: "Hello │ World" },
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Preserve a compact mixed glyph run as one text", (t) => {
  const traces = testTraceMap(t, "│X│");
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 3, text: "│X│" },
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Pass through Dual-use Wires (ASCII)", (t) => {
  const diagram = "1 + 2 = 3";
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 9, text: "1 + 2 = 3" }
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Structural gap blocks hub-label association", (t) => {
  const unicode = testTraceMap(t, `\
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

  const ascii = testTraceMap(t, `\
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
  testCompleted(t);
});

Deno.test("Turtle: Stop at Claimed Location", (t) => {
  const diagram = `
┌───┐
│ A │
└───┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 5, h: 3 },
    { type: "text", x: 2, y: 2, w: 1, text: "A" }
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Max Space Run (Termination)", (t) => {
  const diagram = "One   Two";
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 3, text: "One" },
    { type: "text", x: 6, y: 0, w: 3, text: "Two" }
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Trailing Spaces Backtracking", (t) => {
  const diagram = "Word  ";
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 4, text: "Word" }
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Crossing Vertical Line", (t) => {
  const diagram = `\
  │
hello
  │
`;
  const traces = testTraceMap(t, diagram, ["terminus"]);
  assertArrayMatch(traces, [
    { type: "line", text: "│l│" },
    { type: "label", text: "hello" }
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Connected Hubs with space (hubs as text)", (t) => {
  const diagram = `\
  ┌─▶ ◎ Top
  │        
  │        
  │        
  ▼        
  ◇ Bottom`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "line" },
    { type: "hub", text: "◎", rawLabels: [{ text: "Top" }] },
    { type: "hub", text: "◇", rawLabels: [{ text: "Bottom" }] },
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Connected Hubs line with space (hubs as text)", (t) => {
  const diagram = `\
  ┌── ◎ Top
  │        
  │        
  │        
  ▼        
  ◇ Bottom`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "line" },
    { type: "hub", text: "◎", rawLabels: [{ text: "Top" }] },
    { type: "hub", text: "◇", rawLabels: [{ text: "Bottom" }] },
  ]);
  testCompleted(t);
});
Deno.test("Turtle: Line through hubs (hubs as line, rawLabels only text)", (t) => {
  const diagram = `\
  ◎ Top   
  │       
  │       
  │       
  │       
  ◇ Bottom`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "line" },
    { type: "hub", text: "◎", rawLabels: [{ text: "Top" }] },
    { type: "hub", text: "◇", rawLabels: [{ text: "Bottom" }] },
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Labeled Hub to the left", (t) => {
  const diagram = `\
   Top ◎
       │
       │
       ▼
Bottom ◇`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "line" },
    { type: "hub", text: "◎", rawLabels: [{ text: "Top" }] },
    { type: "hub", text: "◇", rawLabels: [{ text: "Bottom" }] },
  ]);
  testCompleted(t);
});

Deno.test("Turtle: Crossing Arrows", (t) => {
  const diagram = `
      ^
      |
    --+-->
      |
      V
    `;
  const traces = testTraceMap(t, diagram, ["line", "terminus"]);
  // no text should be found since all characters are part of lines
  assertArrayMatch(traces, []);
  testCompleted(t);
});
