import type { Loc } from "../../src/geo.ts";
import { supportsLabel, type TraceBox } from "../../src/trace/types.ts";
import type { InteractionHost } from "./interact.ts";
import { newLabelLocation } from "../model/mutate/label.ts";
import { createText } from "../model/mutate/trace.ts";
import { isModKey } from "./dom.ts";

export function startInlineEditor(host: InteractionHost, traceOrCell: TraceBox | Loc, overwriteChar?: string) {
  const trace = "type" in traceOrCell ? traceOrCell : undefined;
  if (trace?.type === "grid-cell") return;

  const containerEl = host.gridEl.parentElement as HTMLElement;
  const metrics = host.metrics;
  const offset = host.model.projection.offset;

  let initialText = trace?.text ?? "";
  let x = traceOrCell.x;
  let y = traceOrCell.y;
  let w = trace?.w ?? 5;
  let h = trace?.h ?? 1;
  const singleLine = !!trace && trace.type !== "text";

  if (trace) {
    if (supportsLabel(trace)) {
      const label = trace.rawLabels?.[0];
      initialText = label?.text ?? "";
      const loc = label ?? newLabelLocation(trace, 3);
      x = loc.x;
      y = loc.y;
      w = label ? Math.max(1, label.w) : 1;
      h = 1;
    } else {
      const lines = initialText.split("\n");
      w = Math.max(3, trace?.w ?? 0, ...lines.map((line) => line.length));
      h = Math.max(1, trace?.h ?? 0, lines.length);
    }
  }

  const startW = w;
  const startH = h;

  // The editor host may have padding (the full editor does, slate.html does
  // not). Absolute children are positioned from the host's padding box while
  // cell coordinates are relative to the grid itself, so include the grid's
  // actual layout origin.
  const pxLeft = host.gridEl.offsetLeft + (x + offset.x) * metrics.charWidth;
  const pxTop = host.gridEl.offsetTop + (y + offset.y) * metrics.charHeight;
  const pxWidth = w * metrics.charWidth;
  const pxHeight = h * metrics.charHeight;

  const textarea = document.createElement("textarea");
  textarea.setAttribute("data-part", "label-editor");
  textarea.value = overwriteChar !== undefined ? overwriteChar : initialText;

  textarea.style.left = `${pxLeft}px`;
  textarea.style.top = `${pxTop}px`;
  textarea.style.width = `${pxWidth}px`;
  textarea.style.height = `${pxHeight}px`;

  const adjustSize = () => {
    const lines = textarea.value.split("\n");
    const maxLen = Math.max(startW, ...lines.map((l) => l.length));
    textarea.style.width = `${(maxLen + 2) * metrics.charWidth}px`;
    const rows = singleLine ? 1 : Math.max(startH, lines.length);
    textarea.style.height = `${rows * metrics.charHeight}px`;
  };

  textarea.addEventListener("input", adjustSize);
  for (const event of ["mousedown", "dblclick", "copy", "cut", "paste"]) {
    textarea.addEventListener(event, (e) => e.stopPropagation());
  }
  adjustSize();

  containerEl.appendChild(textarea);
  host.setInlineEditing(true);
  textarea.focus();
  if (overwriteChar === undefined) {
    textarea.select();
  }

  let finished = false;
  const commit = (apply: boolean, clearSelection = false) => {
    if (finished) return;
    if (apply) {
      const val = textarea.value;
      if (val !== initialText) {
        try {
          if (trace) {
            host.model.applyLabel(val, trace);
          } else if (val.trim()) {
            host.model.command((model) => {
              const text = createText(model.traceMap, traceOrCell, val);
              model.selection = [text];
            });
          }
        } catch (_e) {
          return;
        }
      }
    }
    finished = true;
    textarea.remove();
    if (clearSelection || !apply) host.model.setSelection(null);
    host.setInlineEditing(false);
  };

  textarea.addEventListener("blur", () => {
    commit(true, true);
  });

  textarea.addEventListener("keydown", (e) => {
    if (isModKey(e) && !e.altKey && e.key.toLowerCase() === "z") {
      document.execCommand(e.shiftKey ? "redo" : "undo");
    } else if (e.key === "Enter" && (singleLine || !e.shiftKey)) {
      commit(true);
    } else if (e.key === "Escape") {
      commit(false);
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  });
}
