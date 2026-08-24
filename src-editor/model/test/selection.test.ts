import { assertEquals } from "@std/assert";
import { traceMap } from "../../../src/trace/trace-map.ts";
import { findTrace } from "../../../src/trace/test/trace-utils.ts";
import {
  contentsSelectionToggle,
  isSelectionArea,
  normalizeTraceSelection,
  smallestContainingBox,
} from "../selection.ts";

Deno.test("trace selection: nested boxes remain independently selected", () => {
  const map = traceMap(`\
┌─────────┐
│ ┌─────┐ │
│ │  A  │ │
│ └─────┘ │
└─────────┘`);
  const boxes = map.traces.filter((trace) => trace.type === "box");

  assertEquals(normalizeTraceSelection(boxes), boxes);
});

Deno.test("trace selection: contents target is the smallest selected container", () => {
  const map = traceMap(`\
┌─────────┐
│ ┌─────┐ │
│ │  A  │ │
│ └─────┘ │
└─────────┘`);
  const outer = findTrace(map, { type: "box", x: 0, y: 0 });
  const inner = findTrace(map, { type: "box", x: 2, y: 1 });

  assertEquals(smallestContainingBox([outer, inner], { x: 5, y: 2 }), inner);
});

Deno.test("trace selection: grid cells are contents containers but not movement areas", () => {
  const map = traceMap(`\
┌─────┬─────┐
│  A  │  B  │
└─────┴─────┘`);
  const cell = findTrace(map, { type: "grid-cell", x: 0, y: 0 });

  assertEquals(smallestContainingBox([cell], { x: 3, y: 1 }), cell);
  assertEquals(isSelectionArea([cell], { x: 3, y: 1 }), false);
});

Deno.test("trace selection: toggles contents of selected sibling grid cells together", () => {
  const map = traceMap(`\
┌─────┬─────┐
│  A  │  B  │
└─────┴─────┘`);
  const cells = map.traces.filter((trace) => trace.type === "grid-cell");
  const texts = map.traces.filter((trace) => trace.type === "text");

  const withContents = contentsSelectionToggle(map, cells, { x: 3, y: 1 }, texts[0])!;
  assertEquals(withContents, [...cells, ...texts]);
  assertEquals(contentsSelectionToggle(map, withContents, { x: 3, y: 1 }, texts[0]), cells);
});
