// src/trace/test/arrowMouse.test.ts
import { traceMap } from "../trace-map.ts";
import { assertEquals } from "@std/assert";
import { Dir } from "../../geo.ts";
import { assertArrayMatch, matchTraceMap } from "./trace-utils.ts";
import { flushPendingWrites, testTraceMap, testCompleted } from "../../test/test-utils.ts";
import { AntEvent } from "../recorder.ts";

Deno.test.afterEach(flushPendingWrites);

Deno.test("arrowMouse: Simple Ascii Horizontal Arrows ->", (t) => {
  const diagram = `
    A -> B
    A --> B
    B <- A
    B <-- A
    `;
  const traces = testTraceMap(t, diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    // A -> B (Search: West for A, East for B)
    { type: "line", text: "->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    // A --> B
    { type: "line", text: "-->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    // B <- A (Visual: Left-to-Right. Search: West for B, East for A)
    { type: "line", text: "<-", source: { dir: Dir.W }, target: { dir: Dir.E } },
    // B <-- A 
    { type: "line", text: "<--", source: { dir: Dir.W }, target: { dir: Dir.E } },
  ]);

  testCompleted(t);
});

Deno.test("arrowMouse: Simple Ascii Vertical Arrows", (t) => {
  const diagram = `
    A   A    A  A   A  
    |   |    |  ^   ^    
    |   |    v  |   |    
    v   V       |        
    B   B    B  B   B
`;
  const traces = testTraceMap(t, diagram, ["text", "terminus"]);
  const lineTraces = [...traces.filter((x) => x.type === "line")]
    .sort((a, b) => (a.x - b.x) || (a.y - b.y));

  assertArrayMatch(lineTraces, [
    // A | v B (Search: North for A, South for B)
    { text: "||v", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { text: "||V", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { text: "|v", source: { dir: Dir.N }, target: { dir: Dir.S } },
    // B ^ | A (Visual: Top-to-Bottom. Search: North for A, South for B)
    { text: "^||", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { text: "^|", source: { dir: Dir.N }, target: { dir: Dir.S } },
  ]);

  testCompleted(t);
});

Deno.test("arrowMouse: straight shaft determines style at a mixed junction", (t) => {
  const traces = testTraceMap(t, `\
      ▵
      ┊
      ┊
━━━━━━┻━━━`, ["terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "▵┊┊┻", style: { family: "unicode", weight: "dotted" } },
    { type: "line", text: "━━━━━━┻━━━", style: { family: "unicode", weight: "bold" } },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Windy Arrow", (t) => {
  const diagram = `
    A
    |
    +---> B
    `;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // Search: North for A, East for B
    { type: "line", text: "|+--->", source: { dir: Dir.N }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Simple Connector ■", (t) => {
  const diagram = `A ■──▶ B`;
  const traces = testTraceMap(t, diagram, ["text", "label", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "hub", text: "■" },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Box-to-Box Connection", (t) => {
  const diagram = `
┌───┐      ┌───┐
│ A ├──────┤ B │
└───┘      └───┘
    `;
  const traces = testTraceMap(t, diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "├──────┤", source: { dir: Dir.None }, target: { dir: Dir.None } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Box-to-Box Connection with Label", (t) => {
  const diagram = `
┌───┐      ┌───┐
│ A ├─1234─┤ B │
└───┘      └───┘
    `;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "├─1234─┤", source: { dir: Dir.None }, target: { dir: Dir.None } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Bidirectional Unicode Arrow", (t) => {
  const diagram = `A ◄───► B`;
  const traces = testTraceMap(t, diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    // ◄ points West, ► points East
    { type: "line", text: "◄───►", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Multiple Connectors and Junctions", (t) => {
  const diagram = `
      A ────●──▶ B
            │
            ▼
            C
    `;
  const traces = testTraceMap(t, diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "────", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "│▼", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "hub", text: "●" },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Crossing Arrows (Not joint)", (t) => {
  const diagram = `
      ^
      |
    --+-->
      |
      V
    `;
  const traces = testTraceMap(t, diagram, ["terminus"]);
  assertArrayMatch(traces, [
    // Vertical: ^|+|V (Search: North at top, South at bottom)
    { type: "line", text: "^|+|V", source: { dir: Dir.N }, target: { dir: Dir.S } },
    // Horizontal: --+--> (Search: West at start, East at end)
    { type: "line", text: "--+-->", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Embedded Arrowhead (Bottom/Top)", (t) => {
  const diagram = `
┌──────┐        
│  A   │        
└──┬───┘        
   │            
   └──────┐     
       ┌──▼────┐
       │   B   │
       └───────┘
    `;
  const traces = testTraceMap(t, diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "┬│└──────┐▼", source: { dir: Dir.None }, target: { dir: Dir.S } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Horizontal Embedded Arrowhead", (t) => {
  const diagram = `
┌───┐      ┌───┐
│ A ├──────▶ B │
└───┘      └───┘
    `;
  const traces = testTraceMap(t, diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "├──────▶", source: { dir: Dir.None }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Complex Path Embedded Arrowhead", (t) => {
  const diagram = `
          ┌────────────────┐
          │                │
          │                │
┌──────┐  │   ┌───────┐    │
│  A   ◇──┘   │   B   ◀────┘
└──────┘      └───────┘     
    `;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "──┘│││┌────────────────┐│││┘────◀", source: { dir: Dir.W }, target: { dir: Dir.W } },
    { type: "hub", text: "◇" },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Complex Path with label Embedded Arrowhead", (t) => {
  const diagram = `
          ┌──── Label ─────┐
          │                │
          │                │
┌──────┐  │   ┌───────┐    │
│  A   ◇──┘   │   B   ◀────┘
└──────┘      └───────┘     
    `;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "──┘│││┌──── Label ─────┐│││┘────◀", source: { dir: Dir.W }, target: { dir: Dir.W } },
    { type: "hub", text: "◇" },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Phantom Connectors (Horizontal and Vertical)", () => {
  const diagram = `\
============
-- status --
------------

<AA>
A <> B
<AA><BB>
v V V
+++++
++i++

|
|

A -- B`;
  const result = traceMap(diagram);
  assertEquals(result.traces.filter((x) => x.type === "line").length, 0);
  matchTraceMap(result, diagram);
});

Deno.test("arrowMouse: Valid Non-Arrow Edges (Unicode & Anchored)", (t) => {
  const diagram = `
    A ── B
   
    ┌───┐   ┌───┐
    │ C │   │ D │    
    │   ├───┤   │
    │   │   │   │    
    │   │   │   │    
    │   │   │   │    
    └───┘   └───┘

    +-----+   +-----+
    |     |   |     |
    | One +---+ Two |
    |     |   |     |
    +-----+   +-----+
    `;
  const traces = testTraceMap(t, diagram, ["text", "terminus"]);
  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "box" },
    { type: "box" },
    // A ── B
    { type: "line", text: "──", source: { dir: Dir.W }, target: { dir: Dir.E } },
    // C ├───┤ D
    { type: "line", text: "├───┤", source: { dir: Dir.None }, target: { dir: Dir.None } },
    // One +---+ Two
    { type: "line", text: "+---+", source: { dir: Dir.None }, target: { dir: Dir.None } }
  ]);

  testCompleted(t);
});

Deno.test("arrowMouse: Junction Jump Case", (t) => {
  const diagram = `
       +--------+
       |        |
    A -+        +-> B
    `;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // Search: West at start, East at end
    { type: "line", text: "-+|+--------+|+->", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Label Jump", (t) => {
  const diagram = `
    A -- Label -> B
    A -- The Label --+
                     |    
                     +-> B
    B <- The Label -- A
    B <- My Long Label -- A
    `;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "-- Label ->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "-- The Label --+|+->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    // B <- The Label -- A (Visual: Left-to-Right. Search: West for B, East for A)
    { type: "line", text: "<- The Label --", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "<- My Long Label --", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Label Jump - Hyphen in label", (t) => {
  const diagram = `[API-GW] -> B`;
  const traces = testTraceMap(t, diagram, ["label", "text", "inline", "terminus"]);

  assertArrayMatch(traces, [
    // Should only find the "->" trace, not "-GW] ->"
    { type: "line", text: "->", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: whitespace does not join separate lines", (t) => {
  const traces = testTraceMap(t, "◀───────────     ──────────▶", [
    "terminus",
  ]);

  assertArrayMatch(traces, [
    { type: "line", text: "◀───────────" },
    { type: "line", text: "──────────▶" },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: one-space label crossing joins a vertical line", (t) => {
  const diagram = `\
  ╷
  │
UH relay
  │
  ▼`;
  const traces = testTraceMap(t, diagram, ["label", "terminus"]);

  assertArrayMatch(traces, [
    {
      type: "line",
      text: "╷│ │▼",
      rawLabels: [{ text: "UH relay" }],
    },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: ambiguous ASCII bars do not join across a blank row", () => {
  const lines = traceMap(`\
|a|

|b|`).traces.filter((trace) => trace.type === "line");

  assertEquals(lines.length, 0);
});

Deno.test("arrowMouse: label text joins line segments", (t) => {
  const traces = testTraceMap(t, "◀───────────  A  ──────────▶", [
    "label",
    "terminus",
  ]);

  assertArrayMatch(traces, [
    {
      type: "line",
      text: "◀───────────  A  ──────────▶",
      rawLabels: [{ text: "  A  " }],
    },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Label Jump - Hyphen in edge style label", (t) => {
  const diagram = `[ C ] -- .triangle-hollow --> [ D ]`;
  const traces = testTraceMap(t, diagram, ["text", "inline", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "-- .triangle-hollow -->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "label", text: " .triangle-hollow " },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Label Jump - Bidirectional ASCII arrow <->", (t) => {
  const diagram = `[ K ] <-> [ L ]`;
  const traces = testTraceMap(t, diagram, ["text", "inline", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "<->", source: { dir: Dir.W }, target: { dir: Dir.E } },
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Label Jump - < in label", (t) => {
  const diagram = `<User> -> B`;
  const traces = testTraceMap(t, diagram, ["label", "text", "inline", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "->", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Branch restart jumps to origin in recorder", (_t) => {
  const diagram = `
┼──►
│
▼
    `;
  const { events = [] } = traceMap(diagram, { record: true });
  const jumps = events.filter((e): e is Extract<AntEvent, { type: 'jump' }> => e.type === 'jump');

  assertEquals(jumps.length > 0, true, "Expected jump event for multi-branch trace");
  for (const jump of jumps) {
    const spawn = events.find(e => e.type === 'spawn' && e.antId === jump.antId);
    assertEquals(!!spawn, true, "Jump must belong to an existing ant spawn");
    assertEquals(jump.x, spawn?.x, "Branch restart jump must return to spawn x");
    assertEquals(jump.y, spawn?.y, "Branch restart jump must return to spawn y");
  }
});

Deno.test("Split Arrows: Raw implicit split traces shared stem and branch", (t) => {
  const diagram = `
A ───┬──▶ B
     │
     └──▶ C
`;

  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // A ───┬──▶ B (Search: West for A, East for B)
    { type: "line", text: "───┬──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    // ┬│└──▶ C (Exact stem contact at ┬, search East for C)
    { type: "line", text: "┬│└──▶", source: { dir: Dir.None }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("Split Arrows: file tree traces parent-to-last-child stem first", (t) => {
  const diagram = `\
 A
 ├── C
 ├── D
 └── B`;

  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "├├└──", source: { dir: Dir.N }, target: { dir: Dir.E } },
    { type: "line", text: "├──", source: { dir: Dir.None }, target: { dir: Dir.E } },
    { type: "line", text: "├──", source: { dir: Dir.None }, target: { dir: Dir.E } },
  ]);
  testCompleted(t);
});

const TREE_ROTATIONS = [
  {
    name: "down",
    diagram: `\
├──
├──
└──`,
    traces: [
      { type: "line", text: "├├└──", source: { dir: Dir.N }, target: { dir: Dir.E } },
      { type: "line", text: "├──", source: { dir: Dir.None }, target: { dir: Dir.E } },
      { type: "line", text: "├──", source: { dir: Dir.None }, target: { dir: Dir.E } },
    ],
  },
  {
    name: "left",
    diagram: `\
┌┬┬
│││
│││`,
    traces: [
      { type: "line", text: "┬┬┌││", source: { dir: Dir.E }, target: { dir: Dir.S } },
      { type: "line", text: "┬││", source: { dir: Dir.None }, target: { dir: Dir.S } },
      { type: "line", text: "┬││", source: { dir: Dir.None }, target: { dir: Dir.S } },
    ],
  },
  {
    name: "up",
    diagram: `\
──┐
──┤
──┤`,
    traces: [
      { type: "line", text: "──┐┤┤", source: { dir: Dir.W }, target: { dir: Dir.S } },
      { type: "line", text: "──┤", source: { dir: Dir.W }, target: { dir: Dir.None } },
      { type: "line", text: "──┤", source: { dir: Dir.W }, target: { dir: Dir.None } },
    ],
  },
  {
    name: "right",
    diagram: `\
│││
│││
┴┴┘`,
    traces: [
      { type: "line", text: "││┴", source: { dir: Dir.N }, target: { dir: Dir.None } },
      { type: "line", text: "││┴", source: { dir: Dir.N }, target: { dir: Dir.None } },
      { type: "line", text: "││┘┴┴", source: { dir: Dir.N }, target: { dir: Dir.W } },
    ],
  },
] as const;

for (const { name, diagram, traces: expected } of TREE_ROTATIONS) {
  Deno.test(`Split Arrows: unlabeled tree traces ${name}`, () => {
    const traceMapResult = traceMap(diagram);
    const traces = traceMapResult.traces.filter((trace) => trace.type === "line");
    assertArrayMatch(traces, [...expected]);
    matchTraceMap(traceMapResult, diagram);
  });
}

Deno.test("Split Arrows: Raw explicit hub traces stem and both branches", (t) => {
  const diagram = `
A ───●──▶ B
     │
     ▼
     C
`;

  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "───", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "│▼", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "hub", text: "●" },
  ]);
  testCompleted(t);
});

Deno.test("Split Arrows: Raw explicit hub 3-way split traces", (t) => {
  const diagram = `
     D
     ▲
     │
A ───●──▶ B
     │
     ▼
     C
`;

  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "▲│", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "line", text: "───", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "│▼", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "hub", text: "●" },
  ]);
  testCompleted(t);
});

Deno.test("Split Arrows: Raw ASCII + split traces", (t) => {
  const diagram = `
A ---+--> B
     |
     v
     C
`;

  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "---+-->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "+|v", source: { dir: Dir.None }, target: { dir: Dir.S } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Windy Unicode Arrow (No heads)", (t) => {
  const diagram = `
A  ───────────┐
              │
              │
              │
              │
B  ───────────┘
`;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // Search: West for A, West for B
    { type: "line", text: "───────────┐││││┘───────────", source: { dir: Dir.W }, target: { dir: Dir.W } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: not arrowheads", (t) => {
  const diagram = `
A  ┐ ┌ C 
   │ │    
   │ │    
B  ┘ └ D 
`;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // Reading order text: ┐ at (3,0), ┘ at (3,1)
    // Search directions: West at ┐ (points to A), West at ┘ (points to B)
    { type: "line", text: "┐││┘", source: { dir: Dir.W }, target: { dir: Dir.W } },
    { type: "line", text: "┌││└", source: { dir: Dir.E }, target: { dir: Dir.E } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Half-lines", (t) => {
  const diagram = `
    A╶─▷B
    A◁─╴B
    C
    ╷
    ╵
    D
    `;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "╶─▷", source: { dir: Dir.None }, target: { dir: Dir.E } },
    { type: "line", text: "◁─╴", source: { dir: Dir.W }, target: { dir: Dir.None } },
    { type: "line", text: "╷╵", source: { dir: Dir.None }, target: { dir: Dir.None } }
  ]);

  testCompleted(t);
});

Deno.test("arrowMouse: Unicode classic arrows behave like ASCII terminals", (t) => {
  const diagram = `
A ─→ B
C ←─ D
E
│
↓
F
`;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "─→", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "←─", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "│↓", source: { dir: Dir.N }, target: { dir: Dir.S } }
  ]);
  testCompleted(t);
});

Deno.test("arrowMouse: Unicode double arrows behave like arrow terminals", (t) => {
  const diagram = `\
A ═⇒ B
C ⇐═ D
E    G
║    ⩓
⩔    ║
F    H
`;
  const traces = testTraceMap(t, diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "═⇒", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "⇐═", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "║⩔", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "line", text: "⩓║", source: { dir: Dir.N }, target: { dir: Dir.S } }
  ]);
  testCompleted(t);
});
