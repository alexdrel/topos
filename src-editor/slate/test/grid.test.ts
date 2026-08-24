import { assertEquals } from "@std/assert";
import { Dir, type Loc, simplifyPath } from "../../../src/geo.ts";
import { findTrace } from "../../../src/trace/test/trace-utils.ts";
import type { TraceBox } from "../../../src/trace/types.ts";
import { traceMap } from "../../../src/trace/trace-map.ts";
import { selectionConfig } from "../draw.ts";
import {
  cellFromEvent,
  hitTestLineHandle,
  hitTestResizeHandle,
  hitTestTraces,
  pointerFromEvent,
  pxFromCell,
  pxRectFromCell,
  RESIZE_HANDLES,
  reshapeFromHandle,
  resizeHandleWorld,
  selectionCenterPx,
  traceHit,
} from "../grid.ts";

const metrics = { charWidth: 10, charHeight: 20 };
const element = {
  getBoundingClientRect: () => ({ left: 100, top: 200 }),
} as HTMLElement;

function mouse(clientX: number, clientY: number): MouseEvent {
  return { clientX, clientY } as MouseEvent;
}

function selectionContext(config = selectionConfig()) {
  return { element, metrics, offset: { x: 0, y: 0 }, cellAspectInset: 5, config };
}

function hit(traces: TraceBox[], cell: Loc, point = cell): TraceBox | null {
  return hitTestTraces(traces, cell, point);
}

Deno.test("slate grid: converts between client, cell, and pixel coordinates", () => {
  assertEquals(cellFromEvent(mouse(135, 250), element, metrics, { x: 1, y: -1 }), { x: 2, y: 3 });
  assertEquals(pointerFromEvent(mouse(135, 250), element, metrics, { x: 1, y: -1 }), {
    cell: { x: 2, y: 3 },
    point: { x: 2, y: 3 },
  });
  assertEquals(pxFromCell({ x: 2, y: 3 }, metrics, { x: 1, y: -1 }), { x: 30, y: 40 });
  assertEquals(pxFromCell({ x: 2, y: 3 }, metrics, { x: 1, y: -1 }, "center"), { x: 35, y: 50 });
  assertEquals(pxRectFromCell({ x: 2, y: 3, w: 4, h: 2 }, metrics, { x: 1, y: -1 }), { x: 30, y: 40, w: 40, h: 40 });
});

Deno.test("slate grid: pointer side disambiguates shared grid-cell borders", () => {
  const map = traceMap(`\
┌─────┬─────┐
│     │     │
├─────┼─────┤
│     │     │
└─────┴─────┘`);
  const parent = findTrace(map, { type: "box", x: 0, y: 0 });
  const topLeft = findTrace(map, { type: "grid-cell", x: 0, y: 0 });
  const topRight = findTrace(map, { type: "grid-cell", x: 6, y: 0 });
  const bottomLeft = findTrace(map, { type: "grid-cell", x: 0, y: 2 });
  const bottomRight = findTrace(map, { type: "grid-cell", x: 6, y: 2 });

  assertEquals(hit(map.traces, { x: 6, y: 2 }, { x: 5.75, y: 1.75 }), topLeft);
  assertEquals(hit(map.traces, { x: 6, y: 2 }, { x: 6.25, y: 1.75 }), topRight);
  assertEquals(hit(map.traces, { x: 6, y: 2 }, { x: 5.75, y: 2.25 }), bottomLeft);
  assertEquals(hit(map.traces, { x: 6, y: 2 }, { x: 6.25, y: 2.25 }), bottomRight);
  assertEquals(hit(map.traces, { x: 0, y: 1 }, { x: -0.25, y: 1 }), parent);
  assertEquals(hit(map.traces, { x: 0, y: 1 }, { x: 0.25, y: 1 }), topLeft);
  assertEquals(hit(map.traces, { x: 5, y: 1 }, { x: 5.1, y: 1 }), topLeft);
  assertEquals(hit(map.traces, { x: 7, y: 3 }, { x: 6.9, y: 3 }), bottomRight);
  assertEquals(hit(map.traces, { x: -1, y: 1 }, { x: -0.9, y: 1 }), parent);
  assertEquals(hit(map.traces, { x: 1, y: 1 }, { x: 0.9, y: 1 }), topLeft);
});

Deno.test("slate grid: empty space has a half-cell forgiving box-border hit", () => {
  const map = traceMap(`\
┌─────┐
│     │
│     │
└─────┘`);
  const box = findTrace(map, { type: "box", x: 0, y: 0 });

  assertEquals(hit(map.traces, { x: -1, y: 2 }, { x: -0.9, y: 2 }), box);
  assertEquals(hit(map.traces, { x: 1, y: 2 }, { x: 0.9, y: 2 }), box);
  assertEquals(hit(map.traces, { x: 1, y: 2 }), null);
});

Deno.test("slate grid: computes selection center in projected pixels", () => {
  const box = findTrace(traceMap(`\
┌───┐
│   │
└───┘`), { type: "box", x: 0, y: 0 });

  assertEquals(selectionCenterPx([box], metrics, { x: 1, y: 2 }), { x: 35, y: 70 });
  assertEquals(selectionCenterPx([], metrics, { x: 0, y: 0 }), null);
});

Deno.test("slate grid: reshapes from cardinal handles across their anchors", () => {
  const origin = { x: 10, y: 10, w: 5, h: 3 };

  assertEquals(reshapeFromHandle("w", { x: 8, y: 10 }, origin), { x: 8, y: 10, w: 7, h: 3 });
  assertEquals(reshapeFromHandle("e", { x: 16, y: 10 }, origin), { x: 10, y: 10, w: 7, h: 3 });
  assertEquals(reshapeFromHandle("n", { x: 10, y: 7 }, origin), { x: 10, y: 7, w: 5, h: 6 });
  assertEquals(reshapeFromHandle("s", { x: 10, y: 14 }, origin), { x: 10, y: 10, w: 5, h: 5 });
  assertEquals(reshapeFromHandle("nw", { x: 16, y: 14 }, origin), { x: 14, y: 12, w: 3, h: 3 });
});

Deno.test("slate grid: locates every resize handle in world coordinates", () => {
  const box = { x: 2, y: 3, w: 4, h: 2 };

  assertEquals(RESIZE_HANDLES.map((handle) => [handle, resizeHandleWorld(box, handle)]), [
    ["nw", { x: 2, y: 3 }],
    ["ne", { x: 6, y: 3 }],
    ["sw", { x: 2, y: 5 }],
    ["se", { x: 6, y: 5 }],
    ["n", { x: 4, y: 3 }],
    ["s", { x: 4, y: 5 }],
    ["w", { x: 2, y: 4 }],
    ["e", { x: 6, y: 4 }],
  ]);
});

Deno.test("slate grid: hit-tests padded resize handles", () => {
  const box = { x: 0, y: 0, w: 4, h: 2 };

  const hit = (event: MouseEvent, config = selectionConfig()) => hitTestResizeHandle(box, event, selectionContext(config));

  assertEquals(hit(mouse(100, 205)), "nw");
  assertEquals(hit(mouse(120, 235)), "s");
  assertEquals(hit(mouse(85, 202.5)), null);
  assertEquals(hit(mouse(85, 202.5), selectionConfig(2)), "nw");
  assertEquals(hit(mouse(180, 280)), null);
});

Deno.test("slate grid: line-handle hits identify vertices and termini", () => {
  const map = traceMap(`\
A ───┐
     │
     ▼`);
  const line = findTrace(map, { type: "line", x: 2, y: 0, startDir: Dir.W });
  const points = simplifyPath(line.path!);

  const hit = (index: number) => {
    const point = pxFromCell(points[index], metrics, { x: 0, y: 0 }, "center");
    return hitTestLineHandle(line, mouse(100 + point.x, 200 + point.y), selectionContext());
  };

  assertEquals(hit(0), { pointIndex: 0, terminus: line.source });
  assertEquals(hit(1), { pointIndex: 1, terminus: undefined });
  assertEquals(hit(2), { pointIndex: 2, terminus: line.target });
  assertEquals(hitTestLineHandle(line, mouse(190, 290), selectionContext()), null);
});

Deno.test("slate grid: trace hits respect shape and overlap priority", () => {
  const map = traceMap(`\
┌───┐
│ A │
└───┘`);
  const box = findTrace(map, { type: "box", x: 0, y: 0 });
  const text = findTrace(map, { type: "text", x: 2, y: 1 });

  assertEquals(traceHit(box, { x: 0, y: 1 }), true);
  assertEquals(traceHit(box, { x: 2, y: 1 }), false);
  assertEquals(traceHit(box, { x: 8, y: 8 }), false);
  assertEquals(traceHit(text, { x: 2, y: 1 }), true);
  assertEquals(hit(map.traces, { x: 2, y: 1 }), text);
  assertEquals(hit(map.traces, { x: 8, y: 8 }), null);

  const gridMap = traceMap(`\
┌─────┬─────┐
│  A  │  B  │
└─────┴─────┘`);
  const cell = findTrace(gridMap, { type: "grid-cell", x: 0, y: 0 });
  assertEquals(traceHit(cell, { x: 3, y: 1 }), false);
  assertEquals(traceHit(cell, { x: 6, y: 1 }), true);

  const line = findTrace(traceMap("A ───▶ B"), { type: "line", x: 2, y: 0, startDir: Dir.W });
  assertEquals(traceHit(line, { x: 3, y: 0 }), true);
  assertEquals(traceHit(line, { x: 3, y: 1 }), false);

  text.x = line.target!.x;
  text.y = line.target!.y;
  assertEquals(hit([text, line.target!], { x: text.x, y: text.y }), line.target);
});

Deno.test("slate grid: hitTestTraces hits stacked box horizontal lines for dy > 0 and dy < 0", () => {
  // 1st: Down-Right stacked box (dy > 0)
  // Visible lines: y = 0, 3, 4, 5 (y=1, 2 are obscured inside)
  const boxDown: TraceBox = {
    type: "box",
    x: 0,
    y: 0,
    w: 20,
    h: 6,
    stack: { layers: 3, dx: 2, dy: 1 },
  };
  assertEquals(traceHit(boxDown, { x: 5, y: 0 }), true);
  assertEquals(traceHit(boxDown, { x: 5, y: 1 }), false);
  assertEquals(traceHit(boxDown, { x: 5, y: 2 }), false);
  assertEquals(traceHit(boxDown, { x: 5, y: 3 }), true);
  assertEquals(traceHit(boxDown, { x: 5, y: 4 }), true);
  assertEquals(traceHit(boxDown, { x: 5, y: 5 }), true);
  assertEquals(traceHit(boxDown, { x: 5, y: 6 }), false);

  // 2nd: Up-Right stacked box (dy < 0)
  // Visible lines: y = 0, 1, 2, 5 (y=3, 4 are obscured inside)
  const boxUp: TraceBox = {
    type: "box",
    x: 0,
    y: 0,
    w: 20,
    h: 6,
    stack: { layers: 3, dx: 2, dy: -1 },
  };
  assertEquals(traceHit(boxUp, { x: 5, y: 0 }), true);
  assertEquals(traceHit(boxUp, { x: 5, y: 1 }), true);
  assertEquals(traceHit(boxUp, { x: 5, y: 2 }), true);
  assertEquals(traceHit(boxUp, { x: 5, y: 3 }), false);
  assertEquals(traceHit(boxUp, { x: 5, y: 4 }), false);
  assertEquals(traceHit(boxUp, { x: 5, y: 5 }), true);
  assertEquals(traceHit(boxUp, { x: 5, y: 6 }), false);
});
