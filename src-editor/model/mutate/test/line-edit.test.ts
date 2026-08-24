import { assertEquals } from "@std/assert";
import { Dir } from "../../../../src/geo.ts";
import { traceMap } from "../../../../src/trace/trace-map.ts";
import { createLine, moveLinePoint, moveTraces, setTerminusGlyph, setTerminusLocation } from "../../mutate.ts";
import { findTrace, matchTraceMap } from "../../../../src/trace/test/trace-utils.ts";

Deno.test("line_edit: move horizontal arrow endpoint right", () => {
  const state = traceMap(`A ---> B`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  // Move endpoint > from x=5 to x=6
  moveLinePoint(state, line, 1, { x: 6, y: 0 });

  matchTraceMap(state, `A ---->B`);
});

Deno.test("line_edit: move horizontal arrow endpoint left", () => {
  const state = traceMap(`A ---> B`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  // Move endpoint > from x=5 to x=4
  moveLinePoint(state, line, 1, { x: 4, y: 0 });

  matchTraceMap(state, `A -->  B`);
});

Deno.test("line_edit: move vertical arrow endpoint down", () => {
  const state = traceMap(`\
A
|
|
v
 
B`);
  const line = findTrace(state, { type: "line", x: 0, y: 1, startDir: Dir.N });

  moveLinePoint(state, line, 1, { x: 0, y: 4 });

  matchTraceMap(state, `\
A
|
|
|
v
B`);
});

Deno.test("line_edit: move horizontal line with label", () => {
  const state = traceMap(`A -------label ----->`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  // Endpoint is at x=20
  moveLinePoint(state, line, 1, { x: 24, y: 0 });

  matchTraceMap(state, `A -------label --------->`);
});

Deno.test("line_edit: move edge connected to boxes", () => {
  const state = traceMap(`\
┌───┐   ┌───┐
│ C ├───┤ D │
└───┘   └───┘`);
  const line = findTrace(state, { type: "line", x: 4, y: 1, startDir: Dir.None });

  // Move the line down by 1
  moveTraces(state, [line], 0, 3);

  matchTraceMap(state, `\
┌───┐   ┌───┐
│ C │   │ D │
└───┘   └───┘

    ─────`);

  moveTraces(state, [line], 0, -3);

  matchTraceMap(state, `\
┌───┐   ┌───┐
│ C ├───┤ D │
└───┘   └───┘`);
});

Deno.test("line_edit: create an undirected line between boxes", () => {
  const state = traceMap(`\
┌───┐   ┌───┐
│ C │   │ D │
└───┘   └───┘`);

  createLine(state, [{ x: 4, y: 1 }, { x: 8, y: 1 }]);

  matchTraceMap(state, `\
┌───┐   ┌───┐
│ C ├───┤ D │
└───┘   └───┘`);
});

Deno.test("line_edit: extend a newly created line", () => {
  const state = traceMap("");
  const line = createLine(state, [{ x: 2, y: 0 }, { x: 3, y: 0 }]);
  setTerminusGlyph(state, line.source!, "◀");
  setTerminusGlyph(state, line.target!, "▶");

  // Extend it to the right
  setTerminusLocation(state, line.target!, { x: 5, y: 0 }, 2);

  matchTraceMap(state, `  ◀──▶`);
});

Deno.test("line_edit: move source endpoint through its terminus", () => {
  const state = traceMap("A ---> B");
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  setTerminusLocation(state, line.source!, { x: 1, y: 0 }, 2);

  assertEquals(line.path![0], { x: 1, y: 0 });
  assertEquals({ x: line.source!.x, y: line.source!.y }, { x: 1, y: 0 });
});

Deno.test("line_edit: moving an open terminus preserves the half-wire", () => {
  const state = traceMap("[A]╶──╴[B]");
  const line = findTrace(state, { type: "line", x: 3, y: 0, startDir: Dir.None });

  setTerminusLocation(state, line.target!, { x: 6, y: 2 }, 2);

  matchTraceMap(state, `\
[A]╶──┐[B]
      │
      ╵`);
});

Deno.test("line_edit: Z-shape drag interior vertex horizontally", () => {
  const state = traceMap(`\
s─────┐
      │
      └─────▶ e`);
  const line = findTrace(state, { type: "line", x: 1, y: 0, startDir: Dir.W });

  // The simplified vertices of this Z-shape:
  // (0,0) -> (6,0) -> (6,2) -> (13,2)
  // Indices: 0: s, 1: top corner (6,0), 2: bottom corner (6,2), 3: e

  // Drag top corner (index 1) to x=4, y=0.
  // Since index 1 is moved hor:
  // incoming segment s-1 is horizontal (no vertical change).
  // outgoing segment 1-2 is vertical (slides horizontally, so index 2 moves to x=4).
  moveLinePoint(state, line, 1, { x: 4, y: 0 });

  matchTraceMap(state, `\
s───┐
    │
    └───────▶ e`);
});

Deno.test("line_edit: Z-shape drag interior vertex vertically", () => {
  const state = traceMap(`\
s─────┐
      │
      └─────▶ e`);
  const line = findTrace(state, { type: "line", x: 1, y: 0, startDir: Dir.W });

  // Drag top corner (index 1) to x=6, y=1.
  // Since index 1 is moved vertically:
  // incoming segment s-1 is horizontal (slides vertically, so index 0 (s) moves to y=1).
  // outgoing segment 1-2 is vertical (no horizontal change).
  moveLinePoint(state, line, 1, { x: 6, y: 1 }, 2);

  matchTraceMap(state, `\
s
 ─────┐
      └─────▶ e`);
});

Deno.test("line_edit: endpoint drag creates L-shape on off-axis move", () => {
  const state = traceMap(`s─────▶`);
  const line = findTrace(state, { type: "line", x: 1, y: 0, startDir: Dir.W });

  // Drag endpoint from (6,0) to (6,2)
  moveLinePoint(state, line, 1, { x: 6, y: 2 }, 2);

  matchTraceMap(state, `\
s─────┐
      │
      ▼`);
});

Deno.test("line_edit: redundant vertex removal after slide", () => {
  const state = traceMap(`\
s─────┐
      │
      └─────▶ e`);
  const line = findTrace(state, { type: "line", x: 1, y: 0, startDir: Dir.W });

  // Move top corner (index 1) vertically to y=2.
  // Incoming segment s-1 (horizontal) slides to y=2.
  // Outgoing segment 1-2 (vertical) has length 0.
  // Path becomes collinear s -> e. Redundant vertices are simplified.
  moveLinePoint(state, line, 1, { x: 6, y: 2 });

  matchTraceMap(state, `\
s

 ───────────▶ e`);
});

Deno.test("line_edit: create line and drag in Z-shape pattern during creation", () => {
  const state = traceMap("");
  const line = createLine(state, [{ x: 2, y: 0 }, { x: 2, y: 1 }]);
  setTerminusGlyph(state, line.target!, "▶");

  // Drag vertically to (2,3)
  setTerminusLocation(state, line.target!, { x: 2, y: 3 }, 2);

  // Drag horizontally to (5,3)
  setTerminusLocation(state, line.target!, { x: 5, y: 3 }, 2);

  // Drag vertically to (5,5)
  setTerminusLocation(state, line.target!, { x: 5, y: 5 }, 2);

  matchTraceMap(state, `\
  │
  │
  │
  └──┐
     │
     ▼`);
});

Deno.test("line_edit: 1-cell jitter is ignored during line creation", () => {
  const state = traceMap("");
  const line = createLine(state, [{ x: 2, y: 0 }, { x: 3, y: 0 }]);
  setTerminusGlyph(state, line.target!, "▶");

  // Drag to (4,0)
  setTerminusLocation(state, line.target!, { x: 4, y: 0 }, 2);

  // Jitter vertically by 1 cell to (4,1) -> should be ignored, line stays horizontal
  setTerminusLocation(state, line.target!, { x: 4, y: 1 }, 2);

  matchTraceMap(state, `  ──▶`);
});

Deno.test("line_edit: do not allow line to collapse into single cell", () => {
  const state = traceMap(`A ---> B`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  // Try to drag the endpoint at (5,0) to the start at (2,0)
  moveLinePoint(state, line, 1, { x: 2, y: 0 });

  // Line should NOT collapse, should remain unchanged
  matchTraceMap(state, `A ---> B`);
});

Deno.test("line_edit: loops collapse to simplified path during creation or edit", () => {
  const state = traceMap("");
  const line = createLine(state, [{ x: 2, y: 0 }, { x: 2, y: 1 }]);
  setTerminusGlyph(state, line.source!, "▽");
  setTerminusGlyph(state, line.target!, "△");

  // Create a Z-shape: (2,0) -> (2,3) -> (5,3)
  setTerminusLocation(state, line.target!, { x: 2, y: 3 }, 2);
  setTerminusLocation(state, line.target!, { x: 5, y: 3 }, 2);

  // Drag end to (2,2) which intersects the first segment (2,0)->(2,3) at (2,2)
  setTerminusLocation(state, line.target!, { x: 2, y: 2 }, 2);

  // The loop should collapse to a simple vertical line from (2,0) to (2,2)
  matchTraceMap(state, `\
  △
  │
  ▽`);
});

Deno.test("line_edit: endpoint may close an imported broken perimeter", () => {
  const state = traceMap(`\
╭────╮
│ A  │
 ╰───╯`);
  const line = state.traces.find((trace) => trace.type === "line")!;

  setTerminusLocation(state, line.target!, { x: line.source!.x, y: line.source!.y }, 2);

  matchTraceMap(state, `\
╭────╮
│ A  │
╰────╯`);
});

Deno.test("line_edit: endpoint edit drag off-axis adds corner or suppresses jitter", () => {
  const state = traceMap(`s─────▶`);
  const line = findTrace(state, { type: "line", x: 1, y: 0, startDir: Dir.W });

  // Drag endpoint from (6,0) vertically by 1 cell to (6,1) -> should be ignored, stays horizontal
  moveLinePoint(state, line, 1, { x: 6, y: 1 }, 2);
  matchTraceMap(state, `s─────▶`);

  // Drag endpoint vertically by 2 cells to (6,2) -> should spawn a corner!
  moveLinePoint(state, line, 1, { x: 6, y: 2 }, 2);
  matchTraceMap(state, `\
s─────┐
      │
      ▼`);
});

Deno.test("line_edit: omitted bend threshold is exact and Infinity locks to the current axis", () => {
  const immediateState = traceMap("s─────▶");
  const immediateLine = findTrace(immediateState, { type: "line", x: 1, y: 0, startDir: Dir.W });
  setTerminusLocation(immediateState, immediateLine.target!, { x: 6, y: 1 });
  assertEquals({ x: immediateLine.target!.x, y: immediateLine.target!.y }, { x: 6, y: 1 });

  const lockedState = traceMap("s─────▶");
  const lockedLine = findTrace(lockedState, { type: "line", x: 1, y: 0, startDir: Dir.W });
  setTerminusLocation(lockedState, lockedLine.target!, { x: 8, y: 3 }, Infinity);
  assertEquals({ x: lockedLine.target!.x, y: lockedLine.target!.y }, { x: 8, y: 0 });
});
