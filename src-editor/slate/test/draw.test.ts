import { assertEquals } from "@std/assert";
import { Dir } from "../../../src/geo.ts";
import { findTrace } from "../../../src/trace/test/trace-utils.ts";
import { traceMap } from "../../../src/trace/trace-map.ts";
import { createLabel } from "../../model/mutate.ts";
import { createMarqueeEl, drawSelection, selectionConfig } from "../draw.ts";

const metrics = { charWidth: 10, charHeight: 20 };

function selectionContext(scale = 1) {
  return {
    element: {} as HTMLElement,
    metrics,
    offset: { x: 0, y: 0 },
    cellAspectInset: 5,
    config: selectionConfig(scale),
  };
}

Deno.test("slate draw: selected line uses ellipses for termini and square handles for turns", () => {
  const map = traceMap(`\
A ───┐
     │
     ▼`);
  const line = findTrace(map, { type: "line", x: 2, y: 0, startDir: Dir.W });

  const selection = drawSelection([line], selectionContext());

  assertEquals(selection.map(([tag, attrs]) => [tag, attrs["data-role"], attrs["data-point"]]), [
    ["polyline", "select-line", undefined],
    ["ellipse", "select-terminus", "0"],
    ["rect", "select-handle", "1"],
    ["ellipse", "select-terminus", "2"],
  ]);
});

Deno.test("slate draw: selected box uses vertically padded bounds and resize handles", () => {
  const map = traceMap(`\
┌───┐
│   │
└───┘`);
  const box = findTrace(map, { type: "box", x: 0, y: 0 });

  const selection = drawSelection([box], selectionContext());

  assertEquals(selection.length, 9);
  assertEquals(selection[0], ["rect", {
    x: -1,
    y: 4,
    width: 52,
    height: 52,
    "stroke-width": 2,
    "data-role": "select-rect",
  }]);
  assertEquals(selection.slice(1).map(([, attrs]) => attrs["data-handle"]), ["nw", "ne", "sw", "se", "n", "s", "w", "e"]);

  const enlarged = drawSelection([box], selectionContext(2));
  assertEquals(enlarged[0], ["rect", {
    x: -2,
    y: 3,
    width: 54,
    height: 54,
    "stroke-width": 4,
    "data-role": "select-rect",
  }]);
  assertEquals(enlarged[1][1].width, 16);
  assertEquals(enlarged[1][1].height, 16);
});

Deno.test("slate draw: selected inline has horizontal resize handles", () => {
  const inline = findTrace(traceMap("[Spirit]"), { type: "inline", x: 0, y: 0 });

  const selection = drawSelection([inline], selectionContext());

  assertEquals(selection.slice(1).map(([, attrs]) => attrs["data-handle"]), ["w", "e"]);
});

Deno.test("slate draw: multi-selection hides line handles and draws a selected terminus", () => {
  const map = traceMap("A ───▶ B");
  const line = findTrace(map, { type: "line", x: 2, y: 0, startDir: Dir.W });

  const selection = drawSelection([line, line.target!], selectionContext());

  assertEquals(selection.map(([tag, attrs]) => [tag, attrs["data-role"], attrs["data-point"]]), [
    ["polyline", "select-line", undefined],
    ["ellipse", "select-terminus", undefined],
  ]);
});

Deno.test("slate draw: rectangular grid-cell selection has resize handles", () => {
  const map = traceMap(`\
┌─────┬─────┐
│  A  │  B  │
├─────┼─────┤
│  C  │  D  │
└─────┴─────┘`);
  const cells = map.traces.filter((trace) => trace.type === "grid-cell");

  const complete = drawSelection(cells, selectionContext());
  assertEquals(complete.slice(-8).map(([, attrs]) => attrs["data-handle"]), ["nw", "ne", "sw", "se", "n", "s", "w", "e"]);

  const mixed = drawSelection([...cells, findTrace(map, { type: "text", x: 3, y: 1 })], selectionContext());
  assertEquals(mixed.some(([, attrs]) => attrs["data-handle"]), false);

  const incomplete = drawSelection(cells.slice(0, 3), selectionContext());
  assertEquals(incomplete.some(([, attrs]) => attrs["data-handle"]), false);
});

Deno.test("slate draw: selected hub bounds include its label", () => {
  const map = traceMap("●");
  const hub = findTrace(map, { type: "hub", x: 0, y: 0 });
  createLabel(map, hub, "Hi");

  const selection = drawSelection([hub], selectionContext());

  assertEquals(selection, [["rect", {
    x: -1,
    y: -1,
    width: 42,
    height: 22,
    "stroke-width": 2,
    "data-role": "select-rect",
  }]]);
});

Deno.test("slate draw: selected unlabeled hub uses the terminus ellipse", () => {
  const hub = findTrace(traceMap("●"), { type: "hub", x: 0, y: 0 });

  const selection = drawSelection([hub], selectionContext());

  assertEquals(selection, [["ellipse", {
    cx: 5,
    cy: 10,
    "data-role": "select-terminus",
  }]]);
});

Deno.test("slate draw: marquee normalizes reverse drag and applies projection offset", () => {
  const marquee = createMarqueeEl({ x: 4, y: 3 }, { x: 2, y: 1 }, { charWidth: 10, charHeight: 20 }, { x: 1, y: 2 }, "subtract");

  assertEquals(marquee, ["rect", {
    x: 30,
    y: 60,
    width: 30,
    height: 60,
    "data-role": "marquee",
    "data-operation": "subtract",
  }]);
});
