import { bounds, contains, type Rect, type ResizeOffsets, resizeOffsets, resizeRect } from "../../../src/geo.ts";
import { DEFAULT_PEN } from "../../../src/style.ts";
import { getStackBounds, getStackGeometry, type Stack } from "../../../src/stacked-box.ts";
import { isBordered, type TraceBox, type TraceMap } from "../../../src/trace/types.ts";
import { createTrace } from "./internal.ts";

function clearBoxDerivedGeometry(trace: TraceBox): void {
  trace.path = undefined;
  trace.text = undefined;
}

export function createBox(traceMap: TraceMap, rect: Rect): TraceBox {
  if (rect.w < 2 || rect.h < 2) throw new Error("Box dimensions must be at least 2x2");
  const trace = createTrace("box", { ...rect, style: DEFAULT_PEN });
  clearBoxDerivedGeometry(trace);
  traceMap.traces.push(trace);
  return trace;
}

export function setBoxStack(_traceMap: TraceMap, trace: TraceBox, stack?: Stack, preserveOrigin = false): boolean {
  if (trace.type !== "box") return false;
  const face = trace.stack ? getStackGeometry(trace, trace.stack).face : trace;
  const next = stack ? getStackBounds(face, stack) : face;
  if (preserveOrigin) Object.assign(next, { x: trace.x, y: trace.y });
  Object.assign(trace, next);
  trace.stack = stack;
  clearBoxDerivedGeometry(trace);
  return true;
}

export function resizeBoxTrace(traceMap: TraceMap, trace: TraceBox, delta: ResizeOffsets): boolean {
  return resizeBoxTraces(traceMap, [trace], delta);
}

type Side = keyof ResizeOffsets;
type BoundaryResize = { trace: TraceBox; side: Side; offset: number };

export function resizeBoxTraces(traceMap: TraceMap, traces: TraceBox[], delta: ResizeOffsets): boolean {
  // Group selected cells by their parent box trace
  const selectedPatchworks = new Map<TraceBox, TraceBox[]>();
  for (const trace of traces) {
    const parent = (trace.type === "box") ? trace : trace.parent!;
    const selectedCells = selectedPatchworks.get(parent) ?? [];
    if (trace.type === "grid-cell") {
      selectedCells.push(trace);
    }
    selectedPatchworks.set(parent, selectedCells);
  }

  let changed = false;
  for (const [parent, selectedCells] of selectedPatchworks) {
    changed = resizePatchwork(traceMap, parent, selectedCells, delta) || changed;
  }
  return changed;
}

export function reshapeBoxTrace(traceMap: TraceMap, trace: TraceBox, rect: Rect): boolean {
  if (!isBordered(trace) || rect.w < 2 || rect.h < 2) return false;
  return resizeBoxTrace(traceMap, trace, resizeOffsets(trace, rect));
}

function resizePatchwork(traceMap: TraceMap, parent: TraceBox, selectedCells: TraceBox[], delta: ResizeOffsets): boolean {
  const allCells = [parent, ...traceMap.traces.filter((trace) => trace.type === "grid-cell" && trace.parent === parent)];
  const pending: BoundaryResize[] = [];
  for (const trace of selectedCells.length ? selectedCells : [parent]) {
    for (const [side, offset] of Object.entries(delta) as [Side, number][]) {
      if (offset) pending.push({ trace, side, offset });
    }
  }
  const blueprint = propagateBoundaries(allCells, pending);

  const resizedParent = resizeRect(parent, blueprint.get(parent) ?? {});
  for (const box of allCells) {
    const resized = resizeRect(box, blueprint.get(box) ?? {});
    if (resized.w < 2 || resized.h < 2) return false;
    if (box !== parent && !contains(resizedParent, resized)) return false;
  }

  for (const [box, offsets] of blueprint) {
    Object.assign(box, resizeRect(box, offsets));
    clearBoxDerivedGeometry(box);
  }
  return true;
}

function propagateBoundaries(allCells: TraceBox[], pending: BoundaryResize[]): Map<TraceBox, ResizeOffsets> {
  const blueprint = new Map<TraceBox, ResizeOffsets>();
  for (const { trace, side, offset } of pending) {
    const offsets = blueprint.get(trace) ?? {};
    if (offsets[side] !== undefined) continue;
    blueprint.set(trace, { ...offsets, [side]: offset });

    const traceBounds = bounds(trace);
    const boundaryValue = traceBounds[side];
    const vertical = side === "left" || side === "right";
    const boundary = vertical ? [traceBounds.top, traceBounds.bottom] : [traceBounds.left, traceBounds.right];
    for (const box of allCells) {
      const curBounds = bounds(box);
      for (const curSide of vertical ? ["left", "right"] as const : ["top", "bottom"] as const) {
        if (curBounds[curSide] !== boundaryValue) continue;
        const span = vertical ? [curBounds.top, curBounds.bottom] : [curBounds.left, curBounds.right];
        if (Math.max(boundary[0], span[0]) >= Math.min(boundary[1], span[1])) continue;
        pending.push({ trace: box, side: curSide, offset });
      }
    }
  }
  return blueprint;
}
