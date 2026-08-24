import { simplifyPath } from "../../../src/geo.ts";
import { isLabelAssociated } from "../../../src/trace/label.ts";
import { reclassifyTextTrace } from "../../../src/trace/text-turtle.ts";
import { supportsLabel, type TraceBox, type TraceMap } from "../../../src/trace/types.ts";
import { createTrace } from "./internal.ts";

export function newLabelLocation(parent: TraceBox, labelWidth: number): { x: number; y: number } {
  if (parent.type === "line" && parent.path) {
    const vertices = simplifyPath(parent.path);
    let start = vertices[0];
    let end = vertices[1];
    let longest = start && end ? Math.abs(end.x - start.x) + Math.abs(end.y - start.y) : 0;
    for (let i = 2; i < vertices.length; i++) {
      const candidateStart = vertices[i - 1];
      const candidateEnd = vertices[i];
      const length = Math.abs(candidateEnd.x - candidateStart.x) + Math.abs(candidateEnd.y - candidateStart.y);
      if (length > longest) {
        start = candidateStart;
        end = candidateEnd;
        longest = length;
      }
    }
    if (start && end) {
      if (start.y === end.y) {
        const left = Math.min(start.x, end.x);
        const width = Math.abs(end.x - start.x) + 1;
        const centeredX = left + Math.floor((width - labelWidth) / 2);
        return { x: Math.max(left + 1, centeredX), y: start.y };
      }
      const top = Math.min(start.y, end.y);
      const height = Math.abs(end.y - start.y) + 1;
      return { x: start.x, y: top + Math.floor(height / 2) };
    }
  }

  const centeredX = parent.x + Math.floor((parent.w - labelWidth) / 2);
  return {
    x: parent.type === "hub" ? parent.x + 2 : Math.max(parent.x + 1, centeredX),
    y: parent.type === "hub" ? parent.y : parent.type === "box" ? parent.y : parent.y + Math.floor(parent.h / 2),
  };
}

export function reconcileLabels(traceMap: TraceMap): void {
  for (const trace of traceMap.traces) {
    reconcileInline(trace);
    if (trace.type === "label") {
      const parent = trace.parent;
      if (!parent || !isLabelAssociated(traceMap.traces, trace, parent)) {
        trace.type = "text";
        trace.parent = undefined;
        if (parent?.rawLabels) {
          parent.rawLabels = parent.rawLabels.filter((label) => label !== trace);
        }
      }
    } else if (trace.type === "text") {
      for (const parent of traceMap.traces) {
        if (supportsLabel(parent) && isLabelAssociated(traceMap.traces, trace, parent)) {
          trace.type = "label";
          trace.parent = parent;
          (parent.rawLabels ??= []).push(trace);
          break;
        }
      }
    }
  }
}

function reconcileInline(trace: TraceBox): void {
  if (trace.type !== "text" && trace.type !== "inline") return;
  Object.assign(trace, reclassifyTextTrace(trace.text ?? "", trace.x));
}

export function createLabel(traceMap: TraceMap, parent: TraceBox, text: string): TraceBox {
  if (!supportsLabel(parent)) throw new Error("Only boxes, lines, and hubs can own labels");
  if (!text.trim()) throw new Error("Label must not be blank");
  if (text.includes("\n")) throw new Error("Label must be a single line");
  const loc = newLabelLocation(parent, text.length);
  const label = createTrace("label", { ...loc, text, parent, w: text.length, h: 1 });
  (parent.rawLabels ??= []).push(label);
  traceMap.traces.push(label);
  return label;
}

export function setLabel(_traceMap: TraceMap, label: TraceBox, text: string): void {
  if (label.type !== "label" || !label.parent) throw new Error("Only attached labels can edit label text");
  if (!text.trim()) throw new Error("Label must not be blank");
  if (text.includes("\n")) throw new Error("Label must be a single line");
  const parent = label.parent;
  if (parent.type === "hub") {
    const wasLeft = label.x + label.w <= parent.x;
    label.text = text;
    label.w = text.length;
    if (wasLeft) label.x = parent.x - 1 - text.length;
  } else {
    label.text = text;
    label.w = text.length;
  }
}
