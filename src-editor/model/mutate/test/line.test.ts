import { assertEquals, assertThrows } from "@std/assert";
import { Dir } from "../../../../src/geo.ts";
import { traceMap } from "../../../../src/trace/trace-map.ts";
import { createBox, createLabel, createLine, createText, moveLinePoint, moveTraces, OPEN_TERMINUS_GLYPH, reverseLineTrace, setTerminusGlyph, setTerminusLocation, setTraceStyle } from "../../mutate.ts";
import { findTrace, matchTraceMap } from "../../../../src/trace/test/trace-utils.ts";

Deno.test("trace: move line trace", () => {
  const state = traceMap(`\
A ───▶ B`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  moveTraces(state, [line], 0, 2);

  assertEquals(line.source && { x: line.source.x, y: line.source.y }, { x: 2, y: 2 });
  assertEquals(line.target && { x: line.target.x, y: line.target.y }, { x: 5, y: 2 });

  matchTraceMap(state, `\
A      B

  ───▶`);
});

Deno.test("trace: translating an open line preserves its endpoint corner", () => {
  const state = traceMap(`\
┌───────────
●`);
  const line = findTrace(state, { type: "line", x: 0, y: 0, startDir: Dir.S });

  moveTraces(state, [line], 0, 2);

  matchTraceMap(state, `\

●
┌───────────`);
});

Deno.test("trace: move line endpoint regenerates orthogonal path", () => {
  const state = traceMap(`\
A ───▶ B`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  moveLinePoint(state, line, 1, { x: 5, y: 2 });

  matchTraceMap(state, `\
A ───┐ B
     │
     ▼`);
});

Deno.test("trace: set box and line styles", () => {
  const state = traceMap(`\
┌───┐
│ A ├──▶ B
└───┘`);
  const box = findTrace(state, { type: "box", x: 0, y: 0 });
  const line = findTrace(state, { type: "line", x: 4, y: 1, startDir: Dir.None });

  setTraceStyle(state, box, { weight: "double" });
  setTraceStyle(state, line, { weight: "bold" });

  matchTraceMap(state, `\
╔═══╗
║ A ╠━━▶ B
╚═══╝`);

  setTraceStyle(state, line, { family: "ascii", weight: "single" });

  matchTraceMap(state, `\
╔═══╗
║ A +--> B
╚═══╝`);
});

Deno.test("trace: reverse line trace", () => {
  const state = traceMap(`\
A ───▶ B`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  reverseLineTrace(state, line);

  matchTraceMap(state, `\
A ◀─── B`);
});

Deno.test("trace: create text, box, and line traces", () => {
  const state = traceMap("");

  createText(state, { x: 0, y: 0 }, "Hello");
  const box = createBox(state, { x: 0, y: 2, w: 7, h: 3 });
  createLabel(state, box, "Box");
  const line = createLine(state, [{ x: 8, y: 3 }, { x: 9, y: 3 }]);
  setTerminusGlyph(state, line.source!, "◀");
  setTerminusGlyph(state, line.target!, "▶");
  setTerminusLocation(state, line.target!, { x: 12, y: 5 }, 2);

  matchTraceMap(state, `\
Hello

┌─Box─┐
│     │ ◀───┐
└─────┘     │
            ▼`);
});

Deno.test("trace: create line from a simplified path", () => {
  const state = traceMap("");
  const line = createLine(state, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }]);
  setTerminusGlyph(state, line.target!, "▼");

  matchTraceMap(state, `\
────┐
    │
    ▼`);
});

Deno.test("trace: drag intermediate line turn slides adjacent segment", () => {
  const state = traceMap(`\
A ───┐ B
     │
     ▼`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  // Drag the turn at (5,0) to (3,0)
  moveLinePoint(state, line, 1, { x: 3, y: 0 });

  matchTraceMap(state, `\
A ─┐   B
   │
   ▼`);
});

Deno.test("trace: moving line endpoint parallel extends without new turns", () => {
  const state = traceMap(`\
A ───┐ B
     │
     ▼`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  // Move the endpoint at (5,2) to (5,4) (parallel to the vertical segment)
  moveLinePoint(state, line, 2, { x: 5, y: 4 });

  matchTraceMap(state, `\
A ───┐ B
     │
     │
     │
     ▼`);
});

Deno.test("trace: set start and end terminus glyphs", () => {
  const state = traceMap(`A ───▶ B`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });

  // Currently it has no startGlyph and endGlyph is ▶
  assertEquals(line.source?.text, "");
  assertEquals(line.target?.text, "▶");

  assertThrows(
    () => setTerminusGlyph(state, line.source!, "●"),
    Error,
    "Terminus glyphs must be arrow",
  );

  setTerminusGlyph(state, line.source!, "◀");
  setTerminusGlyph(state, line.target!, "▶");
  matchTraceMap(state, `A ◀──▶ B`);
});

Deno.test("trace: setting an arrowhead connects an open terminus", () => {
  const state = traceMap("╶──╴");
  const line = findTrace(state, { type: "line", x: 0, y: 0, startDir: Dir.None });

  setTerminusGlyph(state, line.source!, "◀");

  assertEquals(line.source!.dir, Dir.W);
  matchTraceMap(state, "◀──╴");
});

Deno.test("trace: terminus glyph variants toggle no connection", () => {
  const state = traceMap("────");
  const line = findTrace(state, { type: "line", x: 0, y: 0, startDir: Dir.W });

  setTerminusGlyph(state, line.source!, OPEN_TERMINUS_GLYPH);
  matchTraceMap(state, "╶───");

  setTerminusGlyph(state, line.source!, "");
  matchTraceMap(state, "────");
});

Deno.test("trace: line creation requires two distinct points", () => {
  const state = traceMap("");
  assertThrows(() => createLine(state, []));
  assertThrows(() => createLine(state, [{ x: 0, y: 0 }]));
  assertThrows(() => createLine(state, [{ x: 0, y: 0 }, { x: 0, y: 0 }]));
  assertEquals(state.traces, []);
});
