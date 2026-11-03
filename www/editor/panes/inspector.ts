import { boundingRect } from "../../../src/geo.ts";
import type { TraceBox } from "../../../src/trace/types.ts";
import type { EditorModel } from "../../../src-editor/model/model.ts";
import template, { type Refs } from "./inspector.html.js";
import "../css/inspector.css";
import { Panel } from "../panel.ts";

interface InspectorRow {
  key: string;
  value: string;
}

function traceText(trace: TraceBox): string {
  if (trace.type === "line" || trace.type === "box" || trace.type === "hub") {
    return (
      trace.rawLabels
        ?.map((label) => label.text)
        .filter(Boolean)
        .join(" · ") ?? ""
    );
  }
  return trace.text ?? "";
}

function styleText(trace: TraceBox): string {
  if (!trace.style) return "";
  return [trace.style.family, trace.style.corner, trace.style.weight].filter(Boolean).join(" · ");
}

function singleTraceRows(trace: TraceBox): InspectorRow[] {
  const rows: InspectorRow[] = [
    { key: "Kind", value: trace.type },
    { key: "Position", value: `${trace.x}, ${trace.y}` },
  ];
  if (trace.w || trace.h) rows.push({ key: "Size", value: `${trace.w} × ${trace.h}` });
  const text = traceText(trace);
  if (text) rows.push({ key: "Text", value: text });
  const style = styleText(trace);
  if (style) rows.push({ key: "Style", value: style });
  if (trace.type === "line") {
    rows.push({ key: "Points", value: String(trace.path?.length ?? 0) });
    rows.push({ key: "Start", value: trace.source?.text || "none" });
    rows.push({ key: "End", value: trace.target?.text || "none" });
  }
  if (trace.type === "terminus" && trace.parent) {
    rows.push({ key: "Line", value: trace.parent.rawLabels?.[0]?.text || "unlabelled" });
  }
  return rows;
}

function selectionRows(selection: TraceBox[]): InspectorRow[] {
  if (selection.length === 1) return singleTraceRows(selection[0]);
  const counts = new Map<string, number>();
  for (const trace of selection) counts.set(trace.type, (counts.get(trace.type) ?? 0) + 1);
  const kinds = [...counts].map(([kind, count]) => `${count} ${kind}`).join(" · ");
  const bounds = boundingRect(selection);
  return [
    { key: "Selected", value: String(selection.length) },
    { key: "Kinds", value: kinds },
    ...(bounds ? [{ key: "Bounds", value: `${bounds.x}, ${bounds.y} · ${bounds.w} × ${bounds.h}` }] : []),
  ];
}

function diagramRows(model: EditorModel): InspectorRow[] {
  const lines = model.projection.text.split("\n");
  const width = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const traces = model.traceMap.traces.filter((trace) => trace.type !== "label" && trace.type !== "terminus");
  const counts = new Map<string, number>();
  for (const trace of traces) counts.set(trace.type, (counts.get(trace.type) ?? 0) + 1);
  const kinds = [...counts].map(([kind, count]) => `${count} ${kind}`).join(" · ");
  return [
    { key: "Kind", value: "diagram" },
    { key: "Size", value: `${width} × ${lines.length}` },
    { key: "Elements", value: String(traces.length) },
    ...(kinds ? [{ key: "Kinds", value: kinds }] : []),
  ];
}

export class InspectorPane extends Panel {
  model: EditorModel;
  refs: Refs;

  constructor(model: EditorModel) {
    const mount = document.getElementById("inspector-section")!;
    super(mount, mount, "side");
    this.model = model;
    this.refs = this.materialize(template);
  }

  render() {
    const { inspectorMeta: meta, inspectorRow } = this.refs;
    const selection = this.model.selection;
    meta.textContent = selection.length === 1 ? selection[0].type : selection.length ? `${selection.length} selected` : "diagram";
    const rows = selection.length ? selectionRows(selection) : diagramRows(this.model);
    inspectorRow.replaceItems(rows);
  }
}
