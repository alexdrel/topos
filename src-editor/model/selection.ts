import { boundingRect, compareByArea, contains, type Loc, type Rect } from "../../src/geo.ts";
import { isAttachment, isBordered, type TraceBox, type TraceMap } from "../../src/trace/types.ts";

export function normalizeTraceSelection(selection: TraceBox[]): TraceBox[] {
  const selected = new Set(selection);
  return selection.filter((trace) => !isAttachment(trace) || !trace.parent || !selected.has(trace.parent));
}

export function expandTraceSelection(traceMap: TraceMap, selection: TraceBox[]): TraceBox[] {
  const selected = new Set(selection);
  for (const trace of traceMap.traces) {
    if (trace.parent && isAttachment(trace) && selected.has(trace.parent)) selected.add(trace);
  }
  return [...selected];
}

export function smallestContainingBox(traces: TraceBox[], cell: Loc): TraceBox | null {
  const containers = traces.filter((trace) => isBordered(trace) && contains(trace, cell));
  return containers.sort(compareByArea)[0] ?? null;
}

export function isSelectionArea(selection: TraceBox[], cell: Loc): boolean {
  return selection.some((trace) => trace.type === "box" && contains(trace, cell));
}

export function selectedSiblingGridCells(selection: TraceBox[], cell: TraceBox): TraceBox[] {
  if (cell.type !== "grid-cell" || !cell.parent) return [];
  return selection.filter((trace) => trace.type === "grid-cell" && trace.parent === cell.parent);
}

export function gridCellSelectionRect(selection: TraceBox[]): Rect | null {
  if (selection.length < 2) return null;
  const cells = selectedSiblingGridCells(selection, selection[0]);
  if (cells.length !== selection.length) return null;
  const rect = boundingRect(cells)!;
  const selectedArea = cells.reduce((area, cell) => area + (cell.w - 1) * (cell.h - 1), 0);
  return selectedArea === (rect.w - 1) * (rect.h - 1) ? rect : null;
}

export function traceWithContents(traceMap: TraceMap, trace: TraceBox): TraceBox[] {
  const traces = isBordered(trace) ? traceMap.traces.filter((candidate) => contains(trace, candidate)) : [trace];
  return normalizeTraceSelection(traces);
}

export function toggleTraceSelection(selection: TraceBox[], targets: TraceBox[]): TraceBox[] {
  if (targets.every((trace) => selection.includes(trace))) {
    return selection.filter((trace) => !targets.includes(trace));
  }
  return [...new Set([...selection, ...targets])];
}

export function contentsSelectionToggle(
  traceMap: TraceMap,
  selection: TraceBox[],
  cell: Loc,
  hit: TraceBox | null,
): TraceBox[] | undefined {
  const selectedContainer = smallestContainingBox(selection, cell);
  if (!selectedContainer) return hit ? traceWithContents(traceMap, hit) : undefined;

  const containers = selectedContainer.type === "grid-cell" ? selectedSiblingGridCells(selection, selectedContainer) : [selectedContainer];
  const contained = traceMap.traces.filter((trace) => containers.some((container) => contains(container, trace)));
  const normalized = normalizeTraceSelection([...new Set([...selection, ...contained])]);
  const contents = normalized.filter((trace) => !containers.includes(trace) && contained.includes(trace));
  return toggleTraceSelection(selection, contents);
}
