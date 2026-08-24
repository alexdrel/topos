import type { Rect, ResizeOffsets } from "../../../src/geo.ts";
import type { TraceBox, TraceMap } from "../../../src/trace/types.ts";

const INLINE_BRACKETS = ["[]", "()", "<>", "{}"];

export function toggleInlineNote(_traceMap: TraceMap, trace: TraceBox): boolean {
  if (trace.h !== 1 || !trace.text || trace.type !== "text" && trace.type !== "inline") return false;
  if (trace.type === "text") {
    trace.type = "inline";
    trace.bracket = "[]";
    trace.text = `[${trace.text}]`;
    trace.x--;
    trace.w += 2;
  } else {
    const inner = trace.text.slice(1, -1);
    const content = inner.trim();
    trace.type = "text";
    trace.bracket = undefined;
    trace.text = content;
    trace.x += 1 + inner.length - inner.trimStart().length;
    trace.w = content.length;
  }
  trace.path = undefined;
  return true;
}

export function cycleInlineBracket(_traceMap: TraceMap, trace: TraceBox): boolean {
  if (trace.type !== "inline" || !trace.text) return false;
  const current = INLINE_BRACKETS.indexOf(trace.bracket ?? "");
  const bracket = INLINE_BRACKETS[(current + 1) % INLINE_BRACKETS.length];
  trace.bracket = bracket;
  trace.text = `${bracket[0]}${trace.text.slice(1, -1)}${bracket[1]}`;
  trace.path = undefined;
  return true;
}

export function resizeInlineTrace(traceMap: TraceMap, trace: TraceBox, delta: ResizeOffsets): boolean {
  if (trace.type !== "inline") return false;
  if (!(delta.left ?? 0) && !(delta.right ?? 0)) return false;
  return reshapeInlineTrace(traceMap, trace, {
    x: trace.x + (delta.left ?? 0),
    y: trace.y,
    w: trace.w + (delta.right ?? 0) - (delta.left ?? 0),
    h: 1,
  });
}

export function reshapeInlineTrace(_traceMap: TraceMap, trace: TraceBox, rect: Rect): boolean {
  if (trace.type !== "inline" || rect.h !== 1 || !trace.text) return false;
  const content = trace.text.slice(1, -1).trim();
  const minimumWidth = content.length + 2;
  if (rect.w < minimumWidth) return false;

  const padding = rect.w - minimumWidth;
  const leftPadding = Math.ceil(padding / 2);
  const rightPadding = Math.floor(padding / 2);
  const bracket = trace.bracket ?? `${trace.text[0]}${trace.text.at(-1)}`;
  Object.assign(trace, rect);
  trace.text = `${bracket[0]}${" ".repeat(leftPadding)}${content}${" ".repeat(rightPadding)}${bracket[1]}`;
  trace.path = undefined;
  return true;
}
