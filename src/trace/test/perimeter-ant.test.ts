// src/trace/test/perimeterAnt.test.ts
import { traceMap } from "../trace-map.ts";
import { assert, assertEquals, assertLess } from "@std/assert";
import { assertArrayMatch, matchTraceMap } from "./trace-utils.ts";
import { flushPendingWrites, testTraceMap, testCompleted } from "../../test/test-utils.ts";

Deno.test.afterEach(flushPendingWrites);

Deno.test("Ant: Single Unicode Box", (t) => {
  const diagram = `
┌─────┐
│ One │
└─────┘
`;
  const traces = testTraceMap(t, diagram);

  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 7, h: 3 },
    { type: "text", x: 2, y: 2, w: 3, text: "One" },
  ]);

  testCompleted(t);
});

Deno.test("Ant: Two Adjacent Unicode Boxes", (t) => {
  const diagram = `
┌─────┐┌─────┐
│ One ││ Two │
└─────┘└─────┘
`;
  const traces = testTraceMap(t, diagram);

  assertArrayMatch(traces, [
    { type: "box", x: 0, w: 7 },
    { type: "box", x: 7, w: 7 },
    { type: "text", x: 2, text: "One" },
    { type: "text", x: 9, text: "Two" },
  ]);

  testCompleted(t);
});

Deno.test("Ant: Stacked Boxes (Inner Turn Case)", (t) => {
  const diagram = `
   ┌────────────────┐    
   │ ┌──────────────┴─┐  
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
`;
  const traces = testTraceMap(t, diagram);

  assertArrayMatch(traces, [
    { type: "box", x: 3, y: 1, w: 22, h: 6 },
    { type: "text", x: 15, y: 4, text: "1" },
  ]);

  testCompleted(t);
});

Deno.test("Ant: ASCII Box with Equals", (t) => {
  const diagram = `
=========
| Alpha |
=========

========|
| Beta  |
|========
`;
  const traces = testTraceMap(t, diagram);

  assertArrayMatch(traces, [
    { type: "box", y: 1, w: 9 },
    { type: "box", y: 5, w: 9 },
    { type: "text", x: 2, text: "Alpha" },
    { type: "text", x: 2, text: "Beta" },
  ]);

  testCompleted(t);
});

Deno.test("Ant: Deep nested boxes", (t) => {
  const diagram = `
┌───────────┐
│ ┌───────┐ │
│ │ ┌───┐ │ │
│ │ │ ╸ │ │ │
│ │ └───┘ │ │
│ └───────┘ │
└───────────┘
`;
  const traces = testTraceMap(t, diagram);

  assertArrayMatch(traces, [
    { type: "box", w: 13 },
    { type: "box", w: 9 },
    { type: "box", w: 5 },
    { type: "text", x: 6, y: 4, text: "╸" },
  ]);

  testCompleted(t);
});

Deno.test("Ant: Optimization - Too Many Left Turns", (t) => {
  const diagram = `
┌─┐
└─┼─┐
  └─┘
`;
  const traces = testTraceMap(t, diagram);
  const boxes = traces.filter((x) => x.type === "box");
  assert(boxes.length >= 1);
  testCompleted(t);
});

Deno.test("Ant: Negative - Parallel Arrow on Border", (t) => {
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
  const traces = testTraceMap(t, diagram);
  const boxes = traces.filter((x) => x.type === "box");
  assertEquals(boxes.length, 0, "Should not find a box with a parallel integrated arrow");
  testCompleted(t);
});

Deno.test("Ant: Positive - Perpendicular Arrow on Border", (t) => {
  // This SHOULD be a valid box because the arrow is perpendicular
  const diagram = `
┌──────v▽─────▽┐
▶  API Server  ⯇
└▲───▲^─□──────┘
`;
  const traces = testTraceMap(t, diagram);
  const boxes = traces.filter((x) => x.type === "box");
  assertEquals(boxes.length, 1, "Should find a box with a perpendicular integrated arrow");
  testCompleted(t);
});

Deno.test("Ant: Small Unicode boxes with connections", (t) => {
  const diagram = `
    ┌───┐   ┌───┐
    │ C ├───┤ D │
    └───┘   └───┘
    `;
  const traces = testTraceMap(t, diagram);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "├───┤" },
    { type: "text", text: "C" },
    { type: "text", text: "D" },
  ]);
  testCompleted(t);
});

Deno.test("Ant: Small ASCII boxes with connections", (t) => {
  const diagram = `
    +-----+   +-----+
    | One +---+ Two |
    +-----+   +-----+
    `;
  const traces = testTraceMap(t, diagram);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "+---+" },
    { type: "text", text: "One" },
    { type: "text", text: "Two" },
  ]);
  testCompleted(t);
});

Deno.test("Ant: Adjacent ASCII boxes", (t) => {
  const diagram = `
    +-----++-----+
    | One || Two |
    +-----++-----+
    `;
  const traces = testTraceMap(t, diagram);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "text", text: "One" },
    { type: "text", text: "Two" },
  ]);
  testCompleted(t);
});

Deno.test("Ant: Phantom ASCII boxes from text", () => {
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

Deno.test("Ant: Phantom ASCII boxes (1x1)", () => {
  const diagram = `\
++
++`;
  const result = traceMap(diagram);
  const boxes = result.traces.filter((x) => x.type === "box");

  assertEquals(boxes, [], "Should not find any boxes from 1x1 ASCII corners");
  matchTraceMap(result, diagram);
});

Deno.test("Ant: Stacked Boxes - No leftovers", (t) => {
  const diagram = `
   ┌────────────────┐    
   │ ┌──────────────┴─┐  
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
  `;
  const traces = testTraceMap(t, diagram);
  const { events } = traceMap(diagram, { record: true });
  const jumps = events?.filter(
    (e) => e.type === "jump" && e.antId.startsWith("box_"),
  );

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "text", text: "1" },
  ]);
  assert(jumps?.length, "Expected box-ant jump while consuming stacked leftovers");

  testCompleted(t);
});

Deno.test("Ant: Stacked Boxes - Stack Offsets", (t) => {
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
  const traces = testTraceMap(t, diagram);

  // Verify Stack Metadata and no extra traces
  assertArrayMatch(traces, [
    { type: "box", stack: { layers: 3, dx: -2, dy: -1 } },
    { type: "box", stack: { layers: 3, dx: -1, dy: -1 } },
    { type: "text", text: "1" },
    { type: "text", text: "2" },
  ]);

  testCompleted(t);
});

Deno.test("Ant: Mono box in grid reproduction", (t) => {
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
  const traces = testTraceMap(t, diagram);
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

  testCompleted(t);
});

Deno.test("Ant: Box vs Lines", (_t) => {
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
