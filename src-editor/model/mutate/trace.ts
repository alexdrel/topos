import type { Loc } from "../../../src/geo.ts";
import { spec, Trait } from "../../../src/grammar.ts";
import { DEFAULT_PEN, normalizePenStyle, type PenStyle } from "../../../src/style.ts";
import { isBordered, type TraceBox, type TraceMap } from "../../../src/trace/types.ts";
import { createTrace, removeTrace, translatePath } from "./internal.ts";
import { reconcileLabels } from "./label.ts";
import { reconcileTermini, setTerminusGlyph } from "./line.ts";
import { reclassifyTextTrace } from "../../../src/trace/text-turtle.ts";

export function createText(traceMap: TraceMap, loc: Loc, text: string): TraceBox {
  if (!text.trim()) throw new Error("Text must not be blank");
  const trace = createTrace("text", { y: loc.y, ...reclassifyTextTrace(text, loc.x) });
  traceMap.traces.push(trace);
  return trace;
}

export function createHub(traceMap: TraceMap, loc: Loc, glyph: string): TraceBox {
  if (!(spec(glyph).trait & Trait.Hub)) throw new Error("Invalid hub glyph");
  const trace = createTrace("hub", { x: loc.x, y: loc.y, w: 1, h: 1, text: glyph });
  traceMap.traces.push(trace);
  return trace;
}

export function deleteTrace(traceMap: TraceMap, trace: TraceBox): void {
  if (trace.type === "terminus") {
    setTerminusGlyph(traceMap, trace, "");
    return;
  }
  removeTrace(traceMap.traces, trace);
  if (trace.parent?.rawLabels) removeTrace(trace.parent.rawLabels, trace);
  for (const label of trace.rawLabels ?? []) removeTrace(traceMap.traces, label);
  if (trace.type === "box") {
    for (const cell of traceMap.traces.filter((candidate) => candidate.type === "grid-cell" && candidate.parent === trace)) {
      removeTrace(traceMap.traces, cell);
    }
  }
  if (trace.type === "line") {
    if (trace.source) removeTrace(traceMap.traces, trace.source);
    if (trace.target) removeTrace(traceMap.traces, trace.target);
  }
  reconcileLabels(traceMap);
}

/** Remove an uncommitted creation draft without reconciling the surrounding map. */
export function deleteDraftTrace(traceMap: TraceMap, trace: TraceBox): void {
  removeTrace(traceMap.traces, trace);
  if (trace.type === "line") {
    if (trace.source) removeTrace(traceMap.traces, trace.source);
    if (trace.target) removeTrace(traceMap.traces, trace.target);
  }
}

export function setText(_traceMap: TraceMap, trace: TraceBox, text: string): void {
  if (trace.type !== "text" && trace.type !== "inline") {
    throw new Error("Only text and inline traces can edit text");
  }
  if (!text.trim()) throw new Error("Text must not be blank");
  Object.assign(trace, reclassifyTextTrace(text, trace.x));
  trace.path = undefined;
}

function moveTrace(traceMap: TraceMap, trace: TraceBox, dx: number, dy: number): void {
  trace.x += dx;
  trace.y += dy;
  if (trace.type === "line" && trace.path) translatePath(trace.path, dx, dy);
  for (const label of trace.rawLabels ?? []) moveTrace(traceMap, label, dx, dy);
  if (trace.type === "line") {
    if (trace.source) moveTrace(traceMap, trace.source, dx, dy);
    if (trace.target) moveTrace(traceMap, trace.target, dx, dy);
  }
  if (trace.type === "box") {
    for (const cell of traceMap.traces) {
      if (cell.type === "grid-cell" && cell.parent === trace) moveTrace(traceMap, cell, dx, dy);
    }
  }
}

export function moveTraces(traceMap: TraceMap, selection: TraceBox[], dx: number, dy: number): void {
  const movable = selection.filter((trace) => trace.type !== "grid-cell");
  for (const trace of movable) moveTrace(traceMap, trace, dx, dy);
  for (const trace of movable) if (trace.type === "line") reconcileTermini(trace);
}

export function setTraceStyle(_traceMap: TraceMap, trace: TraceBox, style: Partial<PenStyle>): void {
  if (!isBordered(trace) && trace.type !== "line") return;
  const current = trace.style ?? DEFAULT_PEN;
  trace.style = normalizePenStyle({ ...current, ...style });
  if (trace.type === "line" && style.family && style.family !== current.family) {
    const fallback = style.family === "ascii" ? ">" : "▶";
    for (const terminus of [trace.source, trace.target]) {
      if (terminus?.text && (spec(terminus.text).trait & Trait.Arrow)) terminus.text = fallback;
    }
    reconcileTermini(trace);
  }
}

export function setHubTraceGlyph(_traceMap: TraceMap, trace: TraceBox, glyph: string): void {
  if (trace.type !== "hub") throw new Error("Only hub traces can edit glyph");
  if (!(spec(glyph).trait & Trait.Hub)) throw new Error("Hub glyphs must be hub traces, not line termini");
  trace.text = glyph;
}
