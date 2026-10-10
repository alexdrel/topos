import { test } from "node:test";
// src/trace/test/arrowMouse.test.ts
import { traceMap } from "../trace-map.ts";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { Dir } from "../../geo.ts";
import { assertArrayMatch, matchTraceMap } from "./trace-utils.ts";
import { testTraceMap } from "../../test/test-utils.ts";
import { AntEvent } from "../recorder.ts";

test("arrowMouse: Simple Ascii Horizontal Arrows ->", () => {
  const diagram = `
    A -> B
    A --> B
    B <- A
    B <-- A
    `;
  const traces = testTraceMap(diagram, ["text", "terminus"]);

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
});

test("arrowMouse: Simple Ascii Vertical Arrows", () => {
  const diagram = `
    A   A    A  A   A  
    |   |    |  ^   ^    
    |   |    v  |   |    
    v   V       |        
    B   B    B  B   B
`;
  const traces = testTraceMap(diagram, ["text", "terminus"]);
  const lineTraces = traces.filter((x) => x.type === "line")
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
});

test("arrowMouse: straight shaft determines style at a mixed junction", () => {
  const traces = testTraceMap(`\
      ▵
      ┊
      ┊
━━━━━━┻━━━`, ["terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "▵┊┊┻", style: { family: "unicode", weight: "dotted" } },
    { type: "line", text: "━━━━━━┻━━━", style: { family: "unicode", weight: "bold" } },
  ]);
});

test("arrowMouse: Windy Arrow", () => {
  const diagram = `
    A
    |
    +---> B
    `;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // Search: North for A, East for B
    { type: "line", text: "|+--->", source: { dir: Dir.N }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: Simple Connector ■", () => {
  const diagram = `A ■──▶ B`;
  const traces = testTraceMap(diagram, ["text", "label", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "hub", text: "■" },
  ]);
});

test("arrowMouse: Box-to-Box Connection", () => {
  const diagram = `
┌───┐      ┌───┐
│ A ├──────┤ B │
└───┘      └───┘
    `;
  const traces = testTraceMap(diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "├──────┤", source: { dir: Dir.None }, target: { dir: Dir.None } }
  ]);
});

test("arrowMouse: Box-to-Box Connection with Label", () => {
  const diagram = `
┌───┐      ┌───┐
│ A ├─1234─┤ B │
└───┘      └───┘
    `;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "├─1234─┤", source: { dir: Dir.None }, target: { dir: Dir.None } }
  ]);
});

test("arrowMouse: Bidirectional Unicode Arrow", () => {
  const diagram = `A ◄───► B`;
  const traces = testTraceMap(diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    // ◄ points West, ► points East
    { type: "line", text: "◄───►", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: Multiple Connectors and Junctions", () => {
  const diagram = `
      A ────●──▶ B
            │
            ▼
            C
    `;
  const traces = testTraceMap(diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "────", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "│▼", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "hub", text: "●" },
  ]);
});

test("arrowMouse: Crossing Arrows (Not joint)", () => {
  const diagram = `
      ^
      |
    --+-->
      |
      V
    `;
  const traces = testTraceMap(diagram, ["terminus"]);
  assertArrayMatch(traces, [
    // Vertical: ^|+|V (Search: North at top, South at bottom)
    { type: "line", text: "^|+|V", source: { dir: Dir.N }, target: { dir: Dir.S } },
    // Horizontal: --+--> (Search: West at start, East at end)
    { type: "line", text: "--+-->", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: Embedded Arrowhead (Bottom/Top)", () => {
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
  const traces = testTraceMap(diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "┬│└──────┐▼", source: { dir: Dir.None }, target: { dir: Dir.S } }
  ]);
});

test("arrowMouse: Horizontal Embedded Arrowhead", () => {
  const diagram = `
┌───┐      ┌───┐
│ A ├──────▶ B │
└───┘      └───┘
    `;
  const traces = testTraceMap(diagram, ["text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "├──────▶", source: { dir: Dir.None }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: Complex Path Embedded Arrowhead", () => {
  const diagram = `
          ┌────────────────┐
          │                │
          │                │
┌──────┐  │   ┌───────┐    │
│  A   ◇──┘   │   B   ◀────┘
└──────┘      └───────┘     
    `;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "──┘│││┌────────────────┐│││┘────◀", source: { dir: Dir.W }, target: { dir: Dir.W } },
    { type: "hub", text: "◇" },
  ]);
});

test("arrowMouse: Complex Path with label Embedded Arrowhead", () => {
  const diagram = `
          ┌──── Label ─────┐
          │                │
          │                │
┌──────┐  │   ┌───────┐    │
│  A   ◇──┘   │   B   ◀────┘
└──────┘      └───────┘     
    `;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "box" },
    { type: "box" },
    { type: "line", text: "──┘│││┌──── Label ─────┐│││┘────◀", source: { dir: Dir.W }, target: { dir: Dir.W } },
    { type: "hub", text: "◇" },
  ]);
});

test("arrowMouse: Phantom Connectors (Horizontal and Vertical)", () => {
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

test("arrowMouse: Valid Non-Arrow Edges (Unicode & Anchored)", () => {
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
  const traces = testTraceMap(diagram, ["text", "terminus"]);
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
});

test("arrowMouse: Junction Jump Case", () => {
  const diagram = `
       +--------+
       |        |
    A -+        +-> B
    `;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // Search: West at start, East at end
    { type: "line", text: "-+|+--------+|+->", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: Label Jump", () => {
  const diagram = `
    A -- Label -> B
    A -- The Label --+
                     |    
                     +-> B
    B <- The Label -- A
    B <- My Long Label -- A
    `;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "-- Label ->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "-- The Label --+|+->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    // B <- The Label -- A (Visual: Left-to-Right. Search: West for B, East for A)
    { type: "line", text: "<- The Label --", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "<- My Long Label --", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: Label Jump - Hyphen in label", () => {
  const diagram = `[API-GW] -> B`;
  const traces = testTraceMap(diagram, ["label", "text", "inline", "terminus"]);

  assertArrayMatch(traces, [
    // Should only find the "->" trace, not "-GW] ->"
    { type: "line", text: "->", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: whitespace does not join separate lines", () => {
  const traces = testTraceMap("◀───────────     ──────────▶", [
    "terminus",
  ]);

  assertArrayMatch(traces, [
    { type: "line", text: "◀───────────" },
    { type: "line", text: "──────────▶" },
  ]);
});

test("arrowMouse: one-space label crossing joins a vertical line", () => {
  const diagram = `\
  ╷
  │
UH relay
  │
  ▼`;
  const traces = testTraceMap(diagram, ["label", "terminus"]);

  assertArrayMatch(traces, [
    {
      type: "line",
      text: "╷│ │▼",
      rawLabels: [{ text: "UH relay" }],
    },
  ]);
});

test("arrowMouse: ambiguous ASCII bars do not join across a blank row", () => {
  const lines = traceMap(`\
|a|

|b|`).traces.filter((trace) => trace.type === "line");

  assertEquals(lines.length, 0);
});

test("arrowMouse: label text joins line segments", () => {
  const traces = testTraceMap("◀───────────  A  ──────────▶", [
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
});

test("arrowMouse: Label Jump - Hyphen in edge style label", () => {
  const diagram = `[ C ] -- .triangle-hollow --> [ D ]`;
  const traces = testTraceMap(diagram, ["text", "inline", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "-- .triangle-hollow -->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "label", text: " .triangle-hollow " },
  ]);
});

test("arrowMouse: Label Jump - Bidirectional ASCII arrow <->", () => {
  const diagram = `[ K ] <-> [ L ]`;
  const traces = testTraceMap(diagram, ["text", "inline", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "<->", source: { dir: Dir.W }, target: { dir: Dir.E } },
  ]);
});

test("arrowMouse: Label Jump - < in label", () => {
  const diagram = `<User> -> B`;
  const traces = testTraceMap(diagram, ["label", "text", "inline", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "->", source: { dir: Dir.W }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: Branch restart jumps to origin in recorder", (_t) => {
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

test("Split Arrows: Raw implicit split traces shared stem and branch", () => {
  const diagram = `
A ───┬──▶ B
     │
     └──▶ C
`;

  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // A ───┬──▶ B (Search: West for A, East for B)
    { type: "line", text: "───┬──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    // ┬│└──▶ C (Exact stem contact at ┬, search East for C)
    { type: "line", text: "┬│└──▶", source: { dir: Dir.None }, target: { dir: Dir.E } }
  ]);
});

test("Split Arrows: file tree traces parent-to-last-child stem first", () => {
  const diagram = `\
 A
 ├── C
 ├── D
 └── B`;

  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "├├└──", source: { dir: Dir.N }, target: { dir: Dir.E } },
    { type: "line", text: "├──", source: { dir: Dir.None }, target: { dir: Dir.E } },
    { type: "line", text: "├──", source: { dir: Dir.None }, target: { dir: Dir.E } },
  ]);
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
  test(`Split Arrows: unlabeled tree traces ${name}`, () => {
    const traceMapResult = traceMap(diagram);
    const traces = traceMapResult.traces.filter((trace) => trace.type === "line");
    assertArrayMatch(traces, [...expected]);
    matchTraceMap(traceMapResult, diagram);
  });
}

test("Split Arrows: Raw explicit hub traces stem and both branches", () => {
  const diagram = `
A ───●──▶ B
     │
     ▼
     C
`;

  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "───", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "│▼", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "hub", text: "●" },
  ]);
});

test("Split Arrows: Raw explicit hub 3-way split traces", () => {
  const diagram = `
     D
     ▲
     │
A ───●──▶ B
     │
     ▼
     C
`;

  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "▲│", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "line", text: "───", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "──▶", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "│▼", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "hub", text: "●" },
  ]);
});

test("Split Arrows: Raw ASCII + split traces", () => {
  const diagram = `
A ---+--> B
     |
     v
     C
`;

  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "---+-->", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "+|v", source: { dir: Dir.None }, target: { dir: Dir.S } }
  ]);
});

test("arrowMouse: Windy Unicode Arrow (No heads)", () => {
  const diagram = `
A  ───────────┐
              │
              │
              │
              │
B  ───────────┘
`;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // Search: West for A, West for B
    { type: "line", text: "───────────┐││││┘───────────", source: { dir: Dir.W }, target: { dir: Dir.W } }
  ]);
});

test("arrowMouse: not arrowheads", () => {
  const diagram = `
A  ┐ ┌ C 
   │ │    
   │ │    
B  ┘ └ D 
`;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    // Reading order text: ┐ at (3,0), ┘ at (3,1)
    // Search directions: West at ┐ (points to A), West at ┘ (points to B)
    { type: "line", text: "┐││┘", source: { dir: Dir.W }, target: { dir: Dir.W } },
    { type: "line", text: "┌││└", source: { dir: Dir.E }, target: { dir: Dir.E } }
  ]);
});

test("arrowMouse: Half-lines", () => {
  const diagram = `
    A╶─▷B
    A◁─╴B
    C
    ╷
    ╵
    D
    `;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "╶─▷", source: { dir: Dir.None }, target: { dir: Dir.E } },
    { type: "line", text: "◁─╴", source: { dir: Dir.W }, target: { dir: Dir.None } },
    { type: "line", text: "╷╵", source: { dir: Dir.None }, target: { dir: Dir.None } }
  ]);
});

test("arrowMouse: Unicode classic arrows behave like ASCII terminals", () => {
  const diagram = `
A ─→ B
C ←─ D
E
│
↓
F
`;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "─→", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "←─", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "│↓", source: { dir: Dir.N }, target: { dir: Dir.S } }
  ]);
});

test("arrowMouse: Unicode double arrows behave like arrow terminals", () => {
  const diagram = `\
A ═⇒ B
C ⇐═ D
E    G
║    ⩓
⩔    ║
F    H
`;
  const traces = testTraceMap(diagram, ["label", "text", "terminus"]);

  assertArrayMatch(traces, [
    { type: "line", text: "═⇒", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "⇐═", source: { dir: Dir.W }, target: { dir: Dir.E } },
    { type: "line", text: "║⩔", source: { dir: Dir.N }, target: { dir: Dir.S } },
    { type: "line", text: "⩓║", source: { dir: Dir.N }, target: { dir: Dir.S } }
  ]);
});
