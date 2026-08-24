import type { Loc, ResizeOffsets } from "../../src/geo.ts";
import { boundingRect, contains, rectFromPoints, resizeOffsets, simplifyPath } from "../../src/geo.ts";
import { isBordered, type TraceBox } from "../../src/trace/types.ts";
import * as mut from "../model/mutate.ts";
import { type Interaction } from "./interact.ts";
import { type GridMetrics, HANDLE_CURSORS, reshapeFromHandle, type ResizeHandle } from "./grid.ts";
import { createMarqueeEl, createTearEls, type MarqueeOperation } from "./draw.ts";
import type { XmlEl } from "../../src/jsonml/jsonml.ts";

const POINTER_BEND_THRESHOLD = 2;
const LOCK_TERMINUS_TO_AXIS = 10;

export function createStructureInteraction(onClick: (cell: Loc) => TraceBox[] | undefined): Interaction {
  let draft: TraceBox | undefined;

  return {
    onMove({ cell, startCell }, model) {
      const rect = rectFromPoints(startCell, cell);
      let kind: "box" | "line" | "hub" | undefined;
      if (rect.w > 1 && rect.h > 1) kind = "box";
      else if (rect.w > 1 || rect.h > 1) kind = "line";
      else if (draft) kind = "hub";
      if (!kind) return;

      model.updateMap((m) => {
        if (draft?.type !== kind) {
          if (draft) mut.deleteDraftTrace(m.traceMap, draft);
          if (kind === "box") {
            draft = mut.createBox(m.traceMap, rect);
            mut.setTraceStyle(m.traceMap, draft, model.defaultBoxStyle);
          } else if (kind === "line") {
            draft = mut.createLine(m.traceMap, [startCell, cell]);
            mut.setTraceStyle(m.traceMap, draft, model.defaultLineStyle);
            mut.setTerminusGlyph(m.traceMap, draft.target!, model.defaultArrowhead);
          } else {
            draft = mut.createHub(m.traceMap, startCell, model.defaultHubGlyph);
          }
        } else if (kind === "box") {
          mut.reshapeBoxTrace(m.traceMap, draft, rect);
        } else if (kind === "line") {
          mut.setTerminusLocation(m.traceMap, draft.target!, cell);
        }
      });
      return [draft!];
    },
    onUp({ startCell }) {
      return draft ? [draft] : onClick(startCell);
    },
  };
}

export function createBoxInteraction(): Interaction {
  let draft: TraceBox | undefined;

  return {
    onMove({ cell, startCell }, model) {
      const rect = rectFromPoints(startCell, cell);
      rect.w = Math.max(2, rect.w);
      rect.h = Math.max(2, rect.h);
      model.updateMap((m) => {
        if (!draft) {
          draft = mut.createBox(m.traceMap, rect);
          mut.setTraceStyle(m.traceMap, draft, model.defaultBoxStyle);
        } else {
          mut.reshapeBoxTrace(m.traceMap, draft, rect);
        }
      });
      return [draft!];
    },
    onUp({ startCell }, model) {
      if (!draft) {
        model.updateMap((m) => {
          draft = mut.createBox(m.traceMap, { ...startCell, w: 10, h: 3 });
          mut.setTraceStyle(m.traceMap, draft, model.defaultBoxStyle);
        });
      }
      return [draft!];
    },
  };
}

export function createHubInteraction(): Interaction {
  let hub: TraceBox | undefined;

  return {
    onMove({ cell, stepDelta }, model) {
      model.updateMap((m) => {
        if (hub) mut.moveTraces(m.traceMap, [hub], stepDelta.x, stepDelta.y);
        else hub = mut.createHub(m.traceMap, cell, model.defaultHubGlyph);
      });
      return [hub!];
    },
    onUp({ cell }, model) {
      if (!hub) {
        model.updateMap((m) => {
          hub = mut.createHub(m.traceMap, cell, model.defaultHubGlyph);
        });
      }
      return [hub!];
    },
  };
}

export function createTextInteraction(startEditing: (cell: Loc) => void): Interaction {
  return {
    onUp({ startCell }) {
      startEditing(startCell);
    },
  };
}

export function createGlyphInteraction(text: string): Interaction {
  return {
    onUp({ startCell }, model) {
      let glyph: TraceBox | undefined;
      model.updateMap((m) => {
        glyph = mut.createText(m.traceMap, startCell, text);
      });
      return [glyph!];
    },
  };
}

export function createLineInteraction(altGesture = false): Interaction {
  let trace: TraceBox | null = null;

  return {
    onMove({ cell, startCell }, model) {
      model.updateMap((m) => {
        if (!trace) {
          trace = mut.createLine(m.traceMap, [startCell, cell]);
          mut.setTraceStyle(m.traceMap, trace, model.defaultLineStyle);
          mut.setTerminusGlyph(m.traceMap, trace.target!, model.defaultArrowhead);
        } else {
          mut.setTerminusLocation(m.traceMap, trace.target!, cell, POINTER_BEND_THRESHOLD);
        }
      });
      return [];
    },
    onUp({ startCell }, model) {
      if (!trace) {
        model.updateMap((m) => {
          if (altGesture) {
            trace = mut.createHub(m.traceMap, startCell, model.defaultHubGlyph);
          } else {
            trace = mut.createLine(m.traceMap, [startCell, { x: startCell.x + 5, y: startCell.y }]);
            mut.setTraceStyle(m.traceMap, trace, model.defaultLineStyle);
            mut.setTerminusGlyph(m.traceMap, trace.target!, model.defaultArrowhead);
          }
        });
      }
      if (trace) return [altGesture && trace.type === "line" ? trace.target! : trace];
    },
  };
}

export function moveTraceInteraction(traces: TraceBox[], hitTrace?: TraceBox): Interaction {
  // Capture original terminus endpoint positions before any drag starts
  const termini = traces.filter((t) => t.type === "terminus");
  const bodies = traces.filter((t) => t.type !== "terminus");
  const constrainTerminiToLine = bodies.some((trace) => trace.type === "box");
  // Store original positions for terminus absolute-delta calculation
  const originMap = new Map<TraceBox, Loc>(termini.map((t) => [t, { x: t.x, y: t.y }]));

  return {
    cursor: "move",
    onMove({ stepDelta, dragDelta }, model) {
      model.updateMap((m) => {
        if (bodies.length) mut.moveTraces(m.traceMap, bodies, stepDelta.x, stepDelta.y);
        for (const term of termini) {
          const parentLine = term.parent;
          if (parentLine?.type !== "line") continue;
          if (bodies.includes(parentLine)) continue;
          const origin = originMap.get(term)!;
          const next = { x: origin.x + dragDelta.x, y: origin.y + dragDelta.y };
          mut.setTerminusLocation(m.traceMap, term, next, constrainTerminiToLine ? LOCK_TERMINUS_TO_AXIS : POINTER_BEND_THRESHOLD);
        }
      });
    },
    onUp({ hasMoved, shift, mod }) {
      if (!hasMoved && !shift && !mod && hitTrace) {
        return [hitTrace];
      }
    },
  };
}

export function spaceTearInteraction(metrics: GridMetrics, getOffset: () => Loc): Interaction {
  let traces: { trace: TraceBox; right: boolean; below: boolean }[];
  let visualMin: Loc;
  let tearEls: XmlEl[] | null = null;
  const applied = { x: 0, y: 0 };

  return {
    cursor: "move",
    get overlayElements() {
      return tearEls ?? undefined;
    },
    onMove({ cell, startCell }, model) {
      if (!traces) {
        traces = model.traceMap.traces
          .filter((trace) => trace.type !== "label" && trace.type !== "terminus")
          .map((trace) => ({ trace, right: trace.x > startCell.x, below: trace.y > startCell.y }))
          .filter(({ right, below }) => right || below);
        const right = traces.filter((item) => item.right);
        const below = traces.filter((item) => item.below);
        visualMin = {
          x: right.length ? Math.min(...right.map(({ trace }) => trace.x)) + model.projection.offset.x : 0,
          y: below.length ? Math.min(...below.map(({ trace }) => trace.y)) + model.projection.offset.y : 0,
        };
      }
      const target = {
        x: traces.some(({ right }) => right) ? Math.max(cell.x - startCell.x, -visualMin.x) : 0,
        y: traces.some(({ below }) => below) ? Math.max(cell.y - startCell.y, -visualMin.y) : 0,
      };
      if (
        (target.x !== applied.x || target.y !== applied.y) &&
        model.updateMap((m) => {
          for (const { trace, right, below } of traces) {
            mut.moveTraces(m.traceMap, [trace], right ? target.x - applied.x : 0, below ? target.y - applied.y : 0);
          }
        })
      ) Object.assign(applied, target);
      tearEls = createTearEls(startCell, { x: startCell.x + applied.x, y: startCell.y + applied.y }, metrics, getOffset());
      return true;
    },
  };
}

export function marqueeInteraction(
  onClick: ((cell: Loc) => void) | undefined,
  metrics: GridMetrics,
  getOffset: () => Loc,
): Interaction {
  let marqueeEl: XmlEl | null = null;

  return {
    cursor: "default",
    get overlayElements() {
      return marqueeEl ? [marqueeEl] : undefined;
    },
    onMove({ cell, startCell, shift, mod, alt }) {
      const operation: MarqueeOperation = shift && alt ? "subtract" : shift || mod ? "add" : "replace";
      marqueeEl = createMarqueeEl(startCell, cell, metrics, getOffset(), operation);
      return true;
    },
    onUp({ shift, mod, alt, hasMoved, cell, startCell }, model) {
      if (!hasMoved) {
        if (!shift && !mod) {
          onClick?.(startCell);
        }
        return;
      }
      const rect = rectFromPoints(startCell, cell);
      const inMarquee = model.traceMap.traces.filter((t) => contains(rect, t));
      if (shift && alt) {
        const nextSelection = model.selection.filter((trace) => !inMarquee.includes(trace));
        return nextSelection;
      }
      const additive = shift || mod;

      const nextSelection = additive ? [...model.selection] : [];
      for (const t of inMarquee) {
        if (t.type !== "label" && !nextSelection.includes(t)) {
          nextSelection.push(t);
        }
      }
      return nextSelection;
    },
  };
}

export function resizeTraceInteraction(trace: TraceBox, handle: ResizeHandle): Interaction {
  const startRect = { ...trace };
  let failed = false;

  return {
    get cursor() {
      return failed ? "not-allowed" : HANDLE_CURSORS[handle];
    },
    onMove({ cell }, model) {
      const nextRect = reshapeFromHandle(handle, cell, startRect);
      failed = !model.updateMap((m) => {
        if (isBordered(trace)) {
          return mut.reshapeBoxTrace(m.traceMap, trace, nextRect);
        }
        if (trace.type === "inline") {
          return mut.reshapeInlineTrace(m.traceMap, trace, nextRect);
        }
        return false;
      });
    },
  };
}

export function resizeGridCellsInteraction(traces: TraceBox[], handle: ResizeHandle): Interaction {
  const startRect = boundingRect(traces)!;
  let applied: ResizeOffsets = {};
  let failed = false;

  return {
    get cursor() {
      return failed ? "not-allowed" : HANDLE_CURSORS[handle];
    },
    onMove({ cell }, model) {
      const nextRect = reshapeFromHandle(handle, cell, startRect);
      const target = resizeOffsets(startRect, nextRect);
      const delta = {
        top: (target.top ?? 0) - (applied.top ?? 0),
        left: (target.left ?? 0) - (applied.left ?? 0),
        bottom: (target.bottom ?? 0) - (applied.bottom ?? 0),
        right: (target.right ?? 0) - (applied.right ?? 0),
      };
      failed = !model.updateMap((m) => mut.resizeBoxTraces(m.traceMap, traces, delta));
      if (!failed) applied = target;
    },
  };
}

export function linePointInteraction(trace: TraceBox, pointIndex: number, clickSelection?: TraceBox): Interaction {
  let currentIndex = pointIndex;
  let failed = false;

  return {
    get cursor() {
      return failed ? "not-allowed" : "move";
    },
    onMove({ cell }, model) {
      const oldPoints = simplifyPath(trace.path!);
      const wasEnd = currentIndex === oldPoints.length - 1;
      failed = !model.updateMap((m) => {
        mut.moveLinePoint(m.traceMap, trace, currentIndex, cell, POINTER_BEND_THRESHOLD);
      });
      if (wasEnd) {
        currentIndex = simplifyPath(trace.path!).length - 1;
      }
    },
    onUp({ hasMoved }) {
      if (!hasMoved && clickSelection) {
        return [clickSelection];
      }
    },
  };
}
