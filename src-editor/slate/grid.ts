/// <reference lib="dom" />

import type { Loc, Rect } from "../../src/geo.ts";
import { borderProximity, boundingRect, contains, isPointOnPolyline, simplifyPath } from "../../src/geo.ts";
import { isBordered, type TraceBox, type TraceKind } from "../../src/trace/types.ts";
import { isBoxHorizontalLine } from "../../src/stacked-box.ts";
import type { SelectionContext } from "./draw.ts";

export interface GridMetrics {
  charWidth: number;
  charHeight: number;
}

export type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e";
export const RESIZE_HANDLES: ResizeHandle[] = ["nw", "ne", "sw", "se", "n", "s", "w", "e"];
export const INLINE_RESIZE_HANDLES: ResizeHandle[] = ["w", "e"];
const BORDER_HIT_DISTANCE = 1;

export const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  se: "nwse-resize",
  n: "ns-resize",
  s: "ns-resize",
  w: "ew-resize",
  e: "ew-resize",
};

export function cellFromEvent(event: MouseEvent, el: HTMLElement, metrics: GridMetrics, offset: Loc): Loc {
  return pointerFromEvent(event, el, metrics, offset).cell;
}

export function pointerFromEvent(event: MouseEvent, el: HTMLElement, metrics: GridMetrics, offset: Loc) {
  const box = el.getBoundingClientRect();
  const point = {
    x: (event.clientX - box.left) / metrics.charWidth - offset.x - 0.5,
    y: (event.clientY - box.top) / metrics.charHeight - offset.y - 0.5,
  };
  return {
    cell: { x: Math.floor(point.x + 0.5), y: Math.floor(point.y + 0.5) },
    point,
  };
}

export function pxFromCell(
  loc: Loc,
  metrics: GridMetrics,
  offset: Loc,
  mode: "top-left" | "center" = "top-left",
): Loc {
  const x = (loc.x + offset.x) * metrics.charWidth;
  const y = (loc.y + offset.y) * metrics.charHeight;
  if (mode === "center") {
    return {
      x: x + metrics.charWidth / 2,
      y: y + metrics.charHeight / 2,
    };
  }
  return { x, y };
}

export function pxRectFromCell(rect: Rect, metrics: GridMetrics, offset: Loc): Rect {
  return {
    x: (rect.x + offset.x) * metrics.charWidth,
    y: (rect.y + offset.y) * metrics.charHeight,
    w: rect.w * metrics.charWidth,
    h: rect.h * metrics.charHeight,
  };
}

export function selectionCenterPx(selection: TraceBox[], metrics: GridMetrics, offset: Loc): Loc | null {
  const bounds = boundingRect(selection);
  if (!bounds) return null;
  const rect = pxRectFromCell(bounds, metrics, offset);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function reshapeFromHandle(handle: ResizeHandle, loc: Loc, origin: Rect): Rect {
  const next = { ...origin };

  if (/[we]/.test(handle)) {
    const anchorX = handle.includes("w") ? origin.x + origin.w - 1 : origin.x;
    next.x = Math.min(anchorX, loc.x);
    next.w = Math.abs(anchorX - loc.x) + 1;
  }
  if (/[ns]/.test(handle)) {
    const anchorY = handle.includes("n") ? origin.y + origin.h - 1 : origin.y;
    next.y = Math.min(anchorY, loc.y);
    next.h = Math.abs(anchorY - loc.y) + 1;
  }

  return next;
}

export function resizeHandleWorld(box: Rect, handle: ResizeHandle): Loc {
  if (handle === "nw") return { x: box.x, y: box.y };
  if (handle === "ne") return { x: box.x + box.w, y: box.y };
  if (handle === "sw") return { x: box.x, y: box.y + box.h };
  if (handle === "se") return { x: box.x + box.w, y: box.y + box.h };
  if (handle === "n") return { x: box.x + box.w / 2, y: box.y };
  if (handle === "s") return { x: box.x + box.w / 2, y: box.y + box.h };
  if (handle === "w") return { x: box.x, y: box.y + box.h / 2 };
  return { x: box.x + box.w, y: box.y + box.h / 2 };
}

export function resizeHandlePx(box: Rect, handle: ResizeHandle, context: SelectionContext): Loc {
  const { metrics, offset, cellAspectInset, config } = context;
  const p = pxFromCell(resizeHandleWorld(box, handle), metrics, offset);
  let dx = 0;
  if (handle.includes("w")) dx = -config.halfStrokeWidth;
  else if (handle.includes("e")) dx = config.halfStrokeWidth;

  let dy = 0;
  if (handle.includes("n")) dy = cellAspectInset - config.halfStrokeWidth;
  else if (handle.includes("s")) dy = config.halfStrokeWidth - cellAspectInset;
  return { x: p.x + dx, y: p.y + dy };
}

export function hitTestResizeHandle(node: Rect, event: MouseEvent, context: SelectionContext, handles = RESIZE_HANDLES): ResizeHandle | null {
  const { element, config } = context;
  const box = element.getBoundingClientRect();
  const lx = event.clientX - box.left;
  const ly = event.clientY - box.top;
  for (const handle of handles) {
    const p = resizeHandlePx(node, handle, context);
    if (Math.abs(lx - p.x) <= config.hitRadius && Math.abs(ly - p.y) <= config.hitRadius) return handle;
  }
  return null;
}

export interface LineHandleHit {
  pointIndex: number;
  terminus?: TraceBox;
}

export function hitTestLineHandle(
  line: TraceBox,
  event: MouseEvent,
  context: SelectionContext,
): LineHandleHit | null {
  const { element, metrics, offset, config } = context;
  const points = simplifyPath(line.path!);
  const box = element.getBoundingClientRect();
  const lx = event.clientX - box.left;
  const ly = event.clientY - box.top;
  const radius = config.hitRadius;
  for (let i = 0; i < points.length; i++) {
    const p = pxFromCell(points[i], metrics, offset, "center");
    if (Math.abs(lx - p.x) <= radius && Math.abs(ly - p.y) <= radius) {
      const terminus = i === 0 ? line.source : i === points.length - 1 ? line.target : undefined;
      return { pointIndex: i, terminus };
    }
  }
  return null;
}

const FOREGROUND_HIT_ORDER: Partial<Record<TraceKind, number>> = {
  terminus: 0,
  label: 1,
  text: 2,
  inline: 2,
  hub: 2,
  line: 3,
};

export function traceHit(trace: TraceBox, cell: Loc): boolean {
  if (trace.type === "line" && trace.path) return isPointOnPolyline(trace.path, cell);
  if (isBordered(trace)) {
    if (!contains(trace, cell)) return false;
    if (cell.x === trace.x || cell.x === trace.x + trace.w - 1) return true;
    if (trace.type === "grid-cell") return cell.y === trace.y || cell.y === trace.y + trace.h - 1;
    return isBoxHorizontalLine(trace, cell.y, trace.stack);
  }
  return contains(trace, cell);
}

export function hitTestTraces(traces: TraceBox[], cell: Loc, point: Loc): TraceBox | null {
  const foreground = traces
    .filter((trace) => traceHit(trace, cell) && !isBordered(trace))
    .sort((a, b) => FOREGROUND_HIT_ORDER[a.type]! - FOREGROUND_HIT_ORDER[b.type]!)[0];
  if (foreground) return foreground;

  return traces
    .filter(isBordered)
    .map((trace) => {
      const proximity = borderProximity(trace, point);
      return {
        trace,
        proximity: traceHit(trace, cell) ? (proximity <= 0 ? -0.5 : 0.5) : proximity,
      };
    })
    .filter(({ proximity }) => Math.abs(proximity) < BORDER_HIT_DISTANCE)
    .sort((a, b) => {
      const distance = Math.abs(a.proximity) - Math.abs(b.proximity);
      if (distance) return distance;
      if (a.proximity !== b.proximity) return a.proximity - b.proximity;
      const area = a.trace.w * a.trace.h - b.trace.w * b.trace.h;
      // Smaller wins inside; larger wins outside.
      return -Math.sign(a.proximity) * area;
    })[0]?.trace ?? null;
}
