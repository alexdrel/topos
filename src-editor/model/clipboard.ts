import { boundingRect, type Loc, type Rect } from "../../src/geo.ts";
import { projectTracesToGrid } from "../../src/ink/ink.ts";
import { TextGrid } from "../../src/trace/text-grid.ts";
import { traceMap as parseTraceMap } from "../../src/trace/trace-map.ts";
import type { TraceBox, TraceMap } from "../../src/trace/types.ts";
import { moveTraces, reconcileLabels } from "./mutate.ts";
import { expandTraceSelection, normalizeTraceSelection } from "./selection.ts";

export function collectTraceClipboardSelection(traceMap: TraceMap, selection: TraceBox[]): TraceBox[] {
  return expandTraceSelection(traceMap, selection);
}

export function traceSelectionBounds(traceMap: TraceMap, selection: TraceBox[]): Rect | null {
  return boundingRect(collectTraceClipboardSelection(traceMap, selection));
}

export function traceSelectionToText(traceMap: TraceMap, selection: TraceBox[]): string {
  const selected = collectTraceClipboardSelection(traceMap, selection);
  const rect = boundingRect(selected);
  if (!rect) return "";

  const grid = new TextGrid([], rect.x, rect.y, rect.w, rect.h);
  return projectTracesToGrid({ grid, traces: selected }).text;
}

export function insertTraceText(traceMap: TraceMap, text: string, loc: Loc): TraceBox[] {
  if (!text.trim()) return [];

  const parsed = parseTraceMap(text);
  if (parsed.traces.length === 0) return [];

  const rect = boundingRect(parsed.traces);
  if (!rect) return [];

  moveTraces(parsed, normalizeTraceSelection(parsed.traces), loc.x - rect.x, loc.y - rect.y);
  traceMap.traces.push(...parsed.traces);
  reconcileLabels(traceMap);
  return parsed.traces;
}
