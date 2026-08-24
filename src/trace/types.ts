import { type Direction, type Loc, type Rect } from "../geo.ts";
import type { TextGrid } from "../trace/text-grid.ts";
import type { PenStyle } from "../style.ts";
import type { Stack } from "../stacked-box.ts";

export type TraceKind = "box" | "grid-cell" | "line" | "text" | "label" | "hub" | "inline" | "terminus";

export interface TraceBox extends Rect {
  type: TraceKind;
  path?: Loc[];
  text?: string; // mandatory for text, label
  dir?: Direction;
  recoilDir?: Direction;
  source?: TraceBox; // terminus trace at path[0]
  target?: TraceBox; // terminus trace at path[N]
  stack?: Stack;
  parent?: TraceBox;
  rawLabels?: TraceBox[]; // only TraceBox & { type: "label" }
  bracket?: string;
  header?: number;
  style?: PenStyle;
}

export function isBordered(trace: TraceBox): trace is TraceBox & { type: "box" | "grid-cell" } {
  return trace.type === "box" || trace.type === "grid-cell";
}

export function supportsLabel(trace: TraceBox): trace is TraceBox & { type: "box" | "line" | "hub" } {
  return trace.type === "box" || trace.type === "line" || trace.type === "hub";
}

export function isAttachment(trace: TraceBox): trace is TraceBox & { type: "label" | "terminus" | "grid-cell" } {
  return trace.type === "label" || trace.type === "terminus" || trace.type === "grid-cell";
}

export type Tracer = Partial<TraceBox> & { type: TraceKind; path: Loc[] } | null;

export interface TraceMap {
  grid: TextGrid;
  traces: TraceBox[];
}
