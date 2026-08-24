import { svgEl } from "./dom.ts";
import type { XmlEl } from "../../src/jsonml/jsonml.ts";
import type { Loc, Rect } from "../../src/geo.ts";
import { INLINE_RESIZE_HANDLES, pxFromCell, pxRectFromCell, RESIZE_HANDLES, resizeHandlePx } from "./grid.ts";
import type { GridMetrics, ResizeHandle } from "./grid.ts";
import { isBordered, type TraceBox } from "../../src/trace/types.ts";
import { boundingRect, simplifyPath } from "../../src/geo.ts";
import { gridCellSelectionRect } from "../model/selection.ts";

const SELECTION_STROKE_WIDTH = 2;
const SELECTION_HANDLE_SIZE = 8;
const SELECTION_HIT_RADIUS = 7;

export interface SelectionConfig {
  strokeWidth: number;
  halfStrokeWidth: number;
  handleSize: number;
  hitRadius: number;
}

export interface SelectionContext {
  element: HTMLElement;
  metrics: GridMetrics;
  offset: Loc;
  cellAspectInset: number;
  config: SelectionConfig;
}

export function normalizeSelectionScale(scale: number): number {
  return Math.max(1, Math.min(3, Number.isFinite(scale) ? scale : 1));
}

export function selectionConfig(scale = 1): SelectionConfig {
  const normalized = normalizeSelectionScale(scale);
  const strokeWidth = SELECTION_STROKE_WIDTH * normalized;
  return {
    strokeWidth,
    halfStrokeWidth: strokeWidth / 2,
    handleSize: SELECTION_HANDLE_SIZE * normalized,
    hitRadius: SELECTION_HIT_RADIUS * normalized,
  };
}

function drawBoxHandles(box: Rect, handles: ResizeHandle[], context: SelectionContext): XmlEl[] {
  const elements: XmlEl[] = [];
  const { config } = context;
  for (const handleName of handles) {
    const px = resizeHandlePx(box, handleName, context);
    elements.push(svgEl("rect", {
      x: px.x - config.handleSize / 2,
      y: px.y - config.handleSize / 2,
      width: config.handleSize,
      height: config.handleSize,
      "data-role": "select-handle",
      "data-handle": handleName,
    }));
  }
  return elements;
}

function drawRectSelection(box: Rect, handles: ResizeHandle[], context: SelectionContext, useVerticalInset: boolean): XmlEl[] {
  const elements: XmlEl[] = [];
  const { metrics, offset, config } = context;
  const verticalInset = useVerticalInset ? context.cellAspectInset : 0;
  const pxRect = pxRectFromCell(box, metrics, offset);

  elements.push(svgEl("rect", {
    x: pxRect.x - config.halfStrokeWidth,
    y: pxRect.y + verticalInset - config.halfStrokeWidth,
    width: pxRect.w + config.strokeWidth,
    height: pxRect.h - verticalInset * 2 + config.strokeWidth,
    "stroke-width": config.strokeWidth,
    "data-role": "select-rect",
  }));

  if (handles.length > 0) {
    elements.push(...drawBoxHandles(box, handles, context));
  }

  return elements;
}

function drawPolylineSelection(points: Loc[], showHandles: boolean, context: SelectionContext): XmlEl[] {
  const elements: XmlEl[] = [];
  const { metrics, offset, config } = context;

  elements.push(svgEl("polyline", {
    points: points.map((point) => {
      const p = pxFromCell(point, metrics, offset, "center");
      return `${p.x},${p.y}`;
    }).join(" "),
    "stroke-width": config.strokeWidth,
    "data-role": "select-line",
  }));

  if (showHandles) {
    points.forEach((pt, idx) => {
      const p = pxFromCell(pt, metrics, offset, "center");
      const isTerminus = idx === 0 || idx === points.length - 1;
      elements.push(
        isTerminus
          ? svgEl("ellipse", {
            cx: p.x,
            cy: p.y,
            "data-role": "select-terminus",
            "data-point": String(idx),
          })
          : svgEl("rect", {
            x: p.x - config.handleSize / 2,
            y: p.y - config.handleSize / 2,
            width: config.handleSize,
            height: config.handleSize,
            "data-role": "select-handle",
            "data-point": String(idx),
          }),
      );
    });
  }

  return elements;
}

function drawSelectionEllipse(loc: Loc, context: SelectionContext): XmlEl {
  const center = pxFromCell(loc, context.metrics, context.offset, "center");
  return svgEl("ellipse", {
    cx: center.x,
    cy: center.y,
    "data-role": "select-terminus",
  });
}

export type MarqueeOperation = "replace" | "add" | "subtract";

export function createMarqueeEl(start: Loc, current: Loc, metrics: GridMetrics, offset: Loc, operation: MarqueeOperation): XmlEl {
  const rect = {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(start.x - current.x) + 1,
    h: Math.abs(start.y - current.y) + 1,
  };
  const pxRect = pxRectFromCell(rect, metrics, offset);
  return svgEl("rect", {
    x: pxRect.x,
    y: pxRect.y,
    width: pxRect.w,
    height: pxRect.h,
    "data-role": "marquee",
    "data-operation": operation,
  });
}

export function createTearEls(start: Loc, current: Loc, metrics: GridMetrics, offset: Loc): XmlEl[] {
  const delta = { x: current.x - start.x, y: current.y - start.y };
  const origin = pxFromCell({ x: start.x + 1, y: start.y + 1 }, metrics, offset);
  const fromLeftEdge = start.x < 0 && delta.x > 0;
  const fromTopEdge = start.y < 0 && delta.y > 0;
  const verticalLeft = Math.min(origin.x, origin.x + delta.x * metrics.charWidth);
  const verticalRight = origin.x + Math.max(0, delta.x * metrics.charWidth);
  const horizontalBottom = origin.y + Math.max(0, delta.y * metrics.charHeight);
  const vertical = {
    x: fromLeftEdge ? "calc(-1 * var(--slate-padding))" : verticalLeft,
    w: fromLeftEdge ? `calc(${verticalRight}px + var(--slate-padding))` : Math.abs(delta.x * metrics.charWidth),
  };
  const horizontal = {
    y: fromTopEdge ? "calc(-1 * var(--slate-padding))" : Math.min(origin.y, origin.y + delta.y * metrics.charHeight),
    h: fromTopEdge ? `calc(${horizontalBottom}px + var(--slate-padding))` : Math.abs(delta.y * metrics.charHeight),
  };
  const elements: XmlEl[] = [];
  if (delta.x) {
    elements.push(svgEl("rect", {
      x: vertical.x,
      y: "calc(-1 * var(--slate-padding))",
      width: vertical.w,
      height: "calc(100% + 2 * var(--slate-padding))",
      "data-role": delta.x > 0 ? "tear-positive" : "tear-negative",
    }));
  }
  if (delta.y) {
    const role = delta.y > 0 ? "tear-positive" : "tear-negative";
    if (!delta.x || !fromLeftEdge) {
      const leftWidth = delta.x ? `calc(${verticalLeft}px + var(--slate-padding))` : "calc(100% + 2 * var(--slate-padding))";
      elements.push(svgEl("rect", {
        x: "calc(-1 * var(--slate-padding))",
        y: horizontal.y,
        width: leftWidth,
        height: horizontal.h,
        "data-role": role,
      }));
    }
    if (delta.x) {
      elements.push(svgEl("rect", {
        x: verticalRight,
        y: horizontal.y,
        width: `calc(100% + var(--slate-padding) - ${verticalRight}px)`,
        height: horizontal.h,
        "data-role": role,
      }));
    }
  }
  return elements;
}

export function drawSelection(traces: TraceBox[], context: SelectionContext): XmlEl[] {
  const elements: XmlEl[] = [];
  const showTraceHandles = traces.length === 1;

  for (const trace of traces) {
    if (trace.type === "terminus" || (trace.type === "hub" && !trace.rawLabels?.length)) {
      elements.push(drawSelectionEllipse(trace, context));
      continue;
    }

    if (trace.type === "line") {
      const points = simplifyPath(trace.path!);
      elements.push(...drawPolylineSelection(points, showTraceHandles, context));
      continue;
    }

    const traceRect = { x: trace.x, y: trace.y, w: Math.max(1, trace.w), h: Math.max(1, trace.h) };
    const rect = trace.type === "hub" ? boundingRect([traceRect, ...trace.rawLabels!])! : traceRect;
    const handles = showTraceHandles ? isBordered(trace) ? RESIZE_HANDLES : trace.type === "inline" ? INLINE_RESIZE_HANDLES : [] : [];
    elements.push(...drawRectSelection(rect, handles, context, isBordered(trace)));
  }

  const gridSelectionRect = gridCellSelectionRect(traces);
  if (gridSelectionRect) elements.push(...drawBoxHandles(gridSelectionRect, RESIZE_HANDLES, context));

  return elements;
}
