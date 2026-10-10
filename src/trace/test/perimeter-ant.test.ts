import { test } from "node:test";
// src/trace/test/perimeterAnt.test.ts
import { traceMap } from "../trace-map.ts";
import { ok as assert, deepStrictEqual as assertEquals } from "node:assert/strict";
import { assertLess } from "../../test/assertions.ts";
import { assertArrayMatch, matchTraceMap } from "./trace-utils.ts";
import { testTraceMap } from "../../test/test-utils.ts";

test("Ant: Single Unicode Box", () => {
  const diagram = `
┌─────┐
│ One │
└─────┘
`;
  const traces = testTraceMap(diagram);

  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 7, h: 3 },
    { type: "text", x: 2, y: 2, w: 3, text: "One" },
  ]);
});

test("Ant: Two Adjacent Unicode Boxes", () => {
  const diagram = `
┌─────┐┌─────┐
│ One ││ Two │
└─────┘└─────┘
`;
  const traces = testTraceMap(diagram);

  assertArrayMatch(traces, [
    { type: "box", x: 0, w: 7 },
    { type: "box", x: 7, w: 7 },
    { type: "text", x: 2, text: "One" },
    { type: "text", x: 9, text: "Two" },
  ]);
});

test("Ant: Stacked Boxes (Inner Turn Case)", () => {
  const diagram = `
   ┌────────────────┐    
   │ ┌──────────────┴─┐  
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
`;
  const traces = testTraceMap(diagram);

  assertArrayMatch(traces, [
    { type: "box", x: 3, y: 1, w: 22, h: 6 },
    { type: "text", x: 15, y: 4, text: "1" },
  ]);
});

test("Ant: ASCII Box with Equals", () => {
  const diagram = `
=========
| Alpha |
=========

========|
| Beta  |
|========
`;
  const traces = testTraceMap(diagram);

  assertArrayMatch(traces, [
    { type: "box", y: 1, w: 9 },
    { type: "box", y: 5, w: 9 },
    { type: "text", x: 2, text: "Alpha" },
    { type: "text", x: 2, text: "Beta" },
  ]);
});

test("Ant: Deep nested boxes", () => {
  const diagram = `
┌───────────┐
│ ┌───────┐ │
│ │ ┌───┐ │ │
│ │ │ ╸ │ │ │
│ │ └───┘ │ │
│ └───────┘ │
└───────────┘
`;
  const traces = testTraceMap(diagram);

  assertArrayMatch(traces, [
    { type: "box", w: 13 },
    { type: "box", w: 9 },
    { type: "box", w: 5 },
    { type: "text", x: 6, y: 4, text: "╸" },
  ]);
});

test("Ant: Optimization - Too Many Left Turns", () => {
  const diagram = `
┌─┐
└─┼─┐
  └─┘
`;
  const traces = testTraceMap(diagram);
  const boxes = traces.filter((x) => x.type === "box");
  assert(boxes.length >= 1);
});

test("Ant: Negative - Parallel Arrow on Border", () => {
  // This should NOT be a valid box because the arrow points along the border
  const diagram = `
┌──────────────┐
│  API Server  │
└────>─────────┘
┌──────────────┐
│  API Server  ▽
└──────────────┘
┌──────────────┐
│  API Server  │
└──────────────□
`;
  const traces = testTraceMap(diagram);
  const boxes = traces.filter((x) => x.type === "box");
  assertEquals(boxes.length, 0, "Should not find a box with a parallel integrated arrow");
});

test("Ant: Positive - Perpendicular Arrow on Border", () => {
  // This SHOULD be a valid box because the arrow is perpendicular
  const diagram = `
┌──────v▽─────▽┐
▶  API Server  ⯇
└▲───▲^─□──────┘
`;
  const traces = testTraceMap(diagram);
  const boxes = traces.filter((x) => x.type === "box");
  assertEquals(boxes.length, 1, "Should find a box with a perpendicular integrated arrow");
});

test("Ant: Small Unicode boxes with connections", () => {
  const diagram = `
    ┌───┐   ┌───┐
    │ C ├───┤ D │
    └───┘   └───┘
    `;
  const traces = testTraceMap(diagram);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "├───┤" },
    { type: "text", text: "C" },
    { type: "text", text: "D" },
  ]);
});

test("Ant: Small ASCII boxes with connections", () => {
  const diagram = `
    +-----+   +-----+
    | One +---+ Two |
    +-----+   +-----+
    `;
  const traces = testTraceMap(diagram);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "+---+" },
    { type: "text", text: "One" },
    { type: "text", text: "Two" },
  ]);
});

test("Ant: Adjacent ASCII boxes", () => {
  const diagram = `
    +-----++-----+
    | One || Two |
    +-----++-----+
    `;
  const traces = testTraceMap(diagram);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "text", text: "One" },
    { type: "text", text: "Two" },
  ]);
});

test("Ant: Phantom ASCII boxes from text", () => {
  const diagram = `\
Some text
++
++
more text`;
  const result = traceMap(diagram);
  const boxes = result.traces.filter((x) => x.type === "box");

  assertEquals(boxes.length, 0, "Should not parse ++ blocks as boxes");
  matchTraceMap(result, diagram);
});

test("Ant: Phantom ASCII boxes (1x1)", () => {
  const diagram = `\
++
++`;
  const result = traceMap(diagram);
  const boxes = result.traces.filter((x) => x.type === "box");

  assertEquals(boxes, [], "Should not find any boxes from 1x1 ASCII corners");
  matchTraceMap(result, diagram);
});

test("Ant: Stacked Boxes - No leftovers", () => {
  const diagram = `
   ┌────────────────┐    
   │ ┌──────────────┴─┐  
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
  `;
  const traces = testTraceMap(diagram);
  const { events } = traceMap(diagram, { record: true });
  const jumps = events?.filter(
    (e) => e.type === "jump" && e.antId.startsWith("box_"),
  );

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "text", text: "1" },
  ]);
  assert(jumps?.length, "Expected box-ant jump while consuming stacked leftovers");
});

test("Ant: Stacked Boxes - Stack Offsets", () => {
  const diagram = `
   ┌────────────────┐    
   │ ┌──────────────┴─┐  
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘

   ┌─STACK────────┐    
   │┌─────────────┴─┐  
   ││┌──────────────┴─┐
   └┤│       2        │
    └┤                │
     └────────────────┘
  `;
  const traces = testTraceMap(diagram);

  // Verify Stack Metadata and no extra traces
  assertArrayMatch(traces, [
    { type: "box", stack: { layers: 3, dx: -2, dy: -1 } },
    { type: "box", stack: { layers: 3, dx: -1, dy: -1 } },
    { type: "text", text: "1" },
    { type: "text", text: "2" },
  ]);
});

test("Ant: Mono box in grid reproduction", () => {
  const diagram = `
┏━━━━━━━━━━━━━━━━━━━━┯━━━━━━━━ Ink ━━━━━━━━━━━━━━━━━━━━┓
┃                    │                                 ┃
┃           ┌────────┴─────────┬─────────────┐         ┃
┃           │                  │             │         ┃
┃           ▼                  ▼             ▼         ┃
┃     ╭──────────╮       ╭──────────╮  ╭──────────╮    ┃
┃     │  Clean   │       │  Sketch  │  │   Mono   │    ┃
┃     ╰─────┬────╯       ╰─────┬────╯  ╰─────┬────╯    ┃
┃           └───────◎──────────┘             │         ┃
┃                   │                        │         ┃
┃             ┌─────▼──────┐                 │         ┃
┃             │   JSONML   │                 │         ┃
┃             └─────┬──────┘                 │         ┃
┃                   │                        │         ┃
┗━━━━━━━━━━━━━━━━━━━┿━━━━━━━━━━━━━━━━━━━━━━━━┿━━━━━━━━━┛
                    ▼                        ▼          
              ╔════════════╗          ╔════════════╗    
              ║    SVG     ║          ║ MonoSketch ║    
              ╚════════════╝          ╚════════════╝    
`;
  const traces = testTraceMap(diagram);
  const boxes = traces.filter((x) => x.type === "box");
  const texts = traces.filter((x) => x.type === "text");

  // Identify the "Mono" text and the "MonoSketch" text
  const monoText = texts.find((txt) => txt.text === "Mono");

  assert(monoText, "Should find 'Mono' text");

  // Find the box specifically containing the "Mono" text
  const monoBox = boxes.find((b) =>
    monoText.x >= b.x && monoText.x < b.x + b.w &&
    monoText.y >= b.y && monoText.y < b.y + b.h &&
    b.w <= 12 && // The Mono box is small, MonoSketch is larger
    b.h < 5
  );

  assert(monoBox, "Should find a SMALL box containing 'Mono' text");
  assertEquals(monoBox.type, "box");

  assertEquals(boxes.length, 7, `Expected 7 boxes, found ${boxes.length}`);
});

test("Ant: Box vs Lines", (_t) => {
  const diagram = `
┌──────────────────┐       ┌──────────────────┐
│                  │       │                  │
│                  │       │                  │
│    ┌───────┐     │       │     ┌───────┐    │
│    │       │     │       │     │       │    │
│    │       ├─────┼───────┼─────┤       │    │
│    │       │     │       │     │       │    │
│    └───┬───┘     │       │     └───┬───┘    │
│        │         │       │         │        │
└────────┼─────────┘       └─────────┼────────┘
         │                           │         
         │                           │         
         │                           │         
         └───────────────────────────┘         
`;
  const { events, traces } = traceMap(diagram, { record: true });
  const boxes = traces.filter((x) => x.type === "box");
  const lines = traces.filter((x) => x.type === "line");

  assertEquals(boxes.length, 4, `Expected 4 boxes, found ${boxes.length}`);
  assertEquals(lines.length, 2, `Expected 2 lines, found ${lines.length}`);
  assertLess(events?.length || 0, 1000, "Expected less than 1000 events, indicating no infinite loops or excessive backtracking");
});
