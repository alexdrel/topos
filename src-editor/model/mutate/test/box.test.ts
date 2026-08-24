import { assertEquals, assertThrows } from "@std/assert";
import { traceMap } from "../../../../src/trace/trace-map.ts";
import { createBox, moveTraces, reshapeBoxTrace, resizeBoxTrace } from "../../mutate.ts";
import { findTrace, matchTraceMap } from "../../../../src/trace/test/trace-utils.ts";

Deno.test("trace: resize box trace regenerates visible perimeter", () => {
  const state = traceMap(`\
┌───┐
│ A │
└───┘`);
  const box = findTrace(state, { type: "box", x: 0, y: 0 });

  resizeBoxTrace(state, box, { right: 2, bottom: 1 });

  matchTraceMap(state, `\
┌─────┐
│ A   │
│     │
└─────┘`);
});

Deno.test("trace: box creation rejects dimensions below 2x2", () => {
  const state = traceMap("");
  assertThrows(() => createBox(state, { x: 0, y: 0, w: 1, h: 2 }));
  assertThrows(() => createBox(state, { x: 0, y: 0, w: 2, h: 1 }));
  assertEquals(state.traces, []);
});

Deno.test("trace: box resizing locks to 2x2 minimum", () => {
  const state = traceMap("");
  const box = createBox(state, { x: 0, y: 0, w: 2, h: 2 });

  // Can be resized to 3x3
  resizeBoxTrace(state, box, { right: 1, bottom: 1 });
  assertEquals(box.w, 3);
  assertEquals(box.h, 3);

  // Can be resized back to 2x2
  resizeBoxTrace(state, box, { right: -1, bottom: -1 });
  assertEquals(box.w, 2);
  assertEquals(box.h, 2);

  // Trying to shrink below 2x2 leaves the box unchanged
  assertEquals(resizeBoxTrace(state, box, { right: -1 }), false);
  assertEquals(box.w, 2);
});

Deno.test("trace: grid cells cannot move independently", () => {
  const state = traceMap(`\
┌───┬───┐
│ A │ B │
└───┴───┘`);
  const cell = findTrace(state, { type: "grid-cell", x: 0, y: 0 });

  moveTraces(state, [cell], 3, 2);

  matchTraceMap(state, `\
┌───┬───┐
│ A │ B │
└───┴───┘`);
});

Deno.test("trace: parent resize keeps shared cell boundaries attached", () => {
  const state = traceMap(`\
┏━━━━━━━━━┓
┃    A    ┃
┣━━━━━━━━━┫
┃    B    ┃
┗━━━━━━━━━┛`);
  const parent = findTrace(state, { type: "box", x: 0, y: 0 });

  assertEquals(resizeBoxTrace(state, parent, { right: 2, bottom: 1 }), true);

  matchTraceMap(state, `\
┏━━━━━━━━━━━┓
┃    A      ┃
┣━━━━━━━━━━━┫
┃    B      ┃
┃           ┃
┗━━━━━━━━━━━┛`);
});

Deno.test("trace: cell resize cascades through shared boundary segments but not point junctions", () => {
  const state = traceMap(`\
┌─────┬─────┐
│  A  │  B  │
│     │     │
├─────┼─────┤
│  C  │  D  │
│     │     │
└─────┴─────┘`);
  const topLeft = findTrace(state, { type: "grid-cell", x: 0, y: 0 });

  assertEquals(resizeBoxTrace(state, topLeft, { right: 1 }), true);

  matchTraceMap(state, `\
┌──────┬────┐
│  A   │ B  │
│      │    │
├─────┬┴────┤
│  C  │  D  │
│     │     │
└─────┴─────┘`);
});

Deno.test("trace: reshapeBoxTrace ignores updates under 2x2 but updates successfully for >= 2x2", () => {
  const state = traceMap("");
  const box = createBox(state, { x: 0, y: 0, w: 3, h: 3 });

  // Reshape to a valid 2x2 size
  assertEquals(reshapeBoxTrace(state, box, { x: 0, y: 0, w: 2, h: 2 }), true);
  assertEquals(box.w, 2);
  assertEquals(box.h, 2);

  // Reshape to an invalid 1x2 size (should be ignored, no throw)
  assertEquals(reshapeBoxTrace(state, box, { x: 0, y: 0, w: 1, h: 1 }), false);
  assertEquals(box.w, 2); // Unchanged
  assertEquals(box.h, 2);
});
