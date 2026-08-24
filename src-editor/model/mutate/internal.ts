import type { Loc } from "../../../src/geo.ts";
import type { TraceBox } from "../../../src/trace/types.ts";

export function translatePath(path: Loc[], dx: number, dy: number): void {
  for (const loc of path) {
    loc.x += dx;
    loc.y += dy;
  }
}

export function recalculateTraceBounds(trace: TraceBox): void {
  if (!trace.path?.length) return;

  const xs = trace.path.map((point) => point.x);
  const ys = trace.path.map((point) => point.y);
  trace.x = Math.min(...xs);
  trace.y = Math.min(...ys);
  trace.w = Math.max(...xs) - trace.x + 1;
  trace.h = Math.max(...ys) - trace.y + 1;
}

export function createTrace<T extends TraceBox["type"]>(
  type: T,
  fields: Partial<TraceBox> = {},
): TraceBox & { type: T } {
  const text = fields.text ?? (type === "text" || type === "label" ? "" : undefined);
  const lines = (text ?? "").split("\n");
  const trace: TraceBox = {
    type,
    x: 0,
    y: 0,
    w: fields.w ?? Math.max(...lines.map((line) => line.length)),
    h: fields.h ?? lines.length,
    ...fields,
    text,
  };
  if (type === "line") recalculateTraceBounds(trace);
  return trace as TraceBox & { type: T };
}

export function removeTrace(traces: TraceBox[], trace: TraceBox): void {
  const index = traces.indexOf(trace);
  if (index >= 0) traces.splice(index, 1);
}
