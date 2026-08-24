import { Dir } from "../geo.ts";
import { TextGrid } from "./text-grid.ts";
import { isBordered, TraceBox, TraceMap, Tracer } from "./types.ts";
import { canSpawnBoxAnt, tracePerimeter } from "./perimeter-ant.ts";
import { canSpawnArrowMouse, traceArrow } from "./arrow-mouse.ts";
import { canMergeTextTraces, cascadingMergeTextTraces, traceHub, traceText } from "./text-turtle.ts";
import { extractLabelsFromPath, isLabelAssociated } from "./label.ts";
import { AntEvent, BlackBox, DefaultBlackBox } from "./recorder.ts";

export interface TraceMapOptions {
  recorder?: BlackBox;
  record?: boolean;
}

export function traceMap(text: string, options: TraceMapOptions = {}) {
  return traceMapLines(text.split(/\r?\n/), options);
}

/**
 * Orchestrates the discovery of diagram entities (traces) on the TextGrid using agents.
 *
 * Phase 1: Ants    — box perimeters (claim borders + labels with Dir.Text)
 * Phase 2: Mice    — arrow lines (claim horizontal segments + labels with Dir.Text, skip hub glyphs)
 * Phase 3: Spiders — hub glyphs (claim each glyph with Dir.Text before turtles run)
 * Phase 4: Turtles — text runs (never sees hubs; classify each trace inline)
 */
export function traceMapLines(lines: string[], options: TraceMapOptions = {}): TraceMap & { events?: AntEvent[] } {
  const grid = TextGrid.fromLines(lines);
  const recorder = options.recorder || options.record ? new DefaultBlackBox() : undefined;
  const traces: TraceBox[] = [];

  // ==========================================
  // PHASE 1: THE ANTS (Structure)
  // ==========================================
  for (const loc of grid.scan()) {
    if (canSpawnBoxAnt(grid, loc)) {
      const [box, ...cells] = tracePerimeter(loc, grid, recorder);

      traces.push(...buildTraceBox(box));

      for (const cell of cells) {
        const childBox = buildTraceBox(cell, box as TraceBox);
        traces.push(...childBox);
      }
    }
  }

  // ==========================================
  // PHASE 2: THE MICE (Connectors/Edges)
  // ==========================================
  for (const loc of grid.scan()) {
    for (let possibleDirMask = Dir.All; possibleDirMask !== Dir.None;) {
      const next = canSpawnArrowMouse(grid, loc, possibleDirMask);
      if (!next) break;
      possibleDirMask = next.possibleDirMask;

      const line = traceArrow(loc, grid, recorder, next.dir);
      traces.push(...buildTraceBox(line));
    }
  }

  // ==========================================
  // PHASE 3: THE SPIDERS (Hub Glyphs)
  // ==========================================
  for (const loc of grid.scan()) {
    traces.push(...buildTraceBox(traceHub(loc, grid, recorder)));
  }

  // ==========================================
  // PHASE 4: THE TURTLES (Content)
  // ==========================================
  for (const loc of grid.scan()) {
    const [text] = buildTraceBox(traceText(loc, grid, recorder));
    if (text && (text.type === "inline" || !skipTextTrace(traces, text))) {
      traces.push(text);
    }
  }

  return { grid, traces, events: recorder?.getEvents() };

  function buildTraceBox(tracer: Tracer, parent?: TraceBox): TraceBox[] {
    if (!tracer) return [];
    const trace = tracer as TraceBox;
    const xs = tracer.path.map((p) => p.x), ys = tracer.path.map((p) => p.y);
    tracer.x = Math.min(...xs);
    tracer.y = Math.min(...ys);
    tracer.w = Math.max(...xs) - tracer.x + 1;
    trace.h = Math.max(...ys) - trace.y + 1;

    if (!isBordered(trace)) trace.text = grid ? tracer.path.map((c) => grid.peek(c)).join("") : "";
    if (parent) trace.parent = parent;

    let rawLabels: TraceBox[] = [];
    if (trace.type === "line" || trace.type === "box") {
      rawLabels = extractLabelsFromPath(trace, grid);
      if (rawLabels.length) {
        trace.rawLabels = rawLabels;
      }
    }
    const termini: TraceBox[] = [];
    if (trace.type === "line") {
      if (trace.source) {
        trace.source.parent = trace;
        termini.push(trace.source);
      }
      if (trace.target) {
        trace.target.parent = trace;
        termini.push(trace.target);
      }
    }
    return [trace, ...rawLabels, ...termini];
  }
}

function skipTextTrace(traces: TraceBox[], txt: TraceBox): boolean {
  // 1. Is it a label for an existing hub or line?
  let parent = traces.find((t) => (t.type === "hub" || t.type === "line") && isLabelAssociated(traces, txt, t));
  if (parent) {
    txt.type = "label";
    txt.parent = parent;
    (parent.rawLabels ??= []).push(txt);
    if (parent.type === "line") {
      parent.x = Math.min(parent.x, txt.x);
      parent.y = Math.min(parent.y, txt.y);
      parent.w = Math.max(parent.w, txt.x + txt.w - parent.x);
      parent.h = Math.max(parent.h, txt.y + txt.h - parent.y);
    }
    return false;
  }

  // 2. Plain text — try to merge as multiline continuation of previous text trace
  const line = txt.text!;

  const headerMatch = /^(#{1,3})\s/.exec(line);
  if (headerMatch) {
    txt.header = headerMatch[1].length;
    return false;
  }

  parent = traces.find((t) => canMergeTextTraces(t, txt));
  if (!parent) return false;

  cascadingMergeTextTraces(parent, txt, traces);
  return true;
}
