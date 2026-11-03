import template, { type Refs } from "./source.html.js";
import "../css/source.css";
import { Panel } from "../panel.ts";
import { observe } from "@alexdrel/perky";

function caretFromText(text: string, index: number): { x: number; y: number } {
  const bounded = Math.max(0, Math.min(index, text.length));
  let y = 0;
  let lastBreak = -1;
  for (let i = 0; i < bounded; i++) {
    if (text.charCodeAt(i) === 10) {
      y++;
      lastBreak = i;
    }
  }
  return { x: bounded - (lastBreak + 1), y };
}

function indexFromCaret(lines: string[], x: number, y: number): number {
  let index = 0;
  for (let i = 0; i < y; i++) index += lines[i].length + 1;
  return index + x;
}

function normalizeGrid(text: string, start: number, end: number, forceAll: boolean) {
  const { x: startX, y: startY } = caretFromText(text, start);
  const { x: endX, y: endY } = caretFromText(text, end);
  const lines = text.split("\n");
  const width = Math.max(0, ...lines.map((line) => line.length));

  let changed = false;
  const padded = lines.map((line, index) => {
    // Pad selected lines by default to keep the edit and undo range small.
    if ((forceAll || (index >= startY && index <= endY)) && line.length < width) {
      changed = true;
      return line.padEnd(width);
    }
    return line;
  });
  if (!changed) return;
  return {
    text: padded.join("\n"),
    start: indexFromCaret(padded, startX, startY),
    end: indexFromCaret(padded, endX, endY),
  };
}

function textChange(oldText: string, newText: string) {
  let start = 0;
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) start++;

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, end: oldEnd, replacement: newText.slice(start, newEnd) };
}

export class Source extends Panel {
  refs: Refs;
  change: (source: string) => void;
  commit: () => void;
  overwriteMode = false;
  isNormalizing = false;

  constructor(change: (source: string) => void, commit: () => void) {
    super(document.getElementById("surface-toolbar-mount")!, document.getElementById("surface-stack")!, "main");
    this.change = change;
    this.commit = commit;
    const refs = this.materialize(template, { toggleOverwrite: () => (this.overwriteMode = !this.overwriteMode) });
    this.refs = refs;
    observe(this, "overwriteMode", (overwrite) => {
      refs.overwriteBtn.classList.toggle("active", overwrite);
      refs.overwriteBtn.setAttribute("aria-pressed", String(overwrite));
      refs.sourceInput.classList.toggle("ovr-active", overwrite);
    });
    refs.sourceInput.addEventListener("keydown", this.onKeydown);
    for (const event of ["input", "click", "keyup", "select", "focus"]) {
      refs.sourceInput.addEventListener(event, this.onInteraction);
    }
    refs.sourceInput.addEventListener("blur", this.onBlur);
  }

  applyFullTextChangeUndoable(newValue: string, newStart: number, newEnd: number) {
    const { sourceInput } = this.refs;
    const oldValue = sourceInput.value;
    if (oldValue === newValue) {
      sourceInput.setSelectionRange(newStart, newEnd);
      return;
    }

    const { scrollTop, scrollLeft } = sourceInput;
    const { start, end, replacement } = textChange(oldValue, newValue);

    sourceInput.focus();
    sourceInput.setSelectionRange(start, end);

    // execCommand('insertText') is the only way to preserve undo stack in textarea
    if (!document.execCommand("insertText", false, replacement)) {
      sourceInput.value = newValue;
    }

    sourceInput.setSelectionRange(newStart, newEnd);
    sourceInput.scrollTop = scrollTop;
    sourceInput.scrollLeft = scrollLeft;
  }

  onKeydown = (e: KeyboardEvent) => {
    const { sourceInput } = this.refs;
    if (e.key === "Insert") {
      e.preventDefault();
      this.overwriteMode = !this.overwriteMode;
      return;
    }

    if (this.overwriteMode && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const start = sourceInput.selectionStart;
      if (start === sourceInput.selectionEnd) {
        const val = sourceInput.value;
        if (start < val.length && val[start] !== "\n") {
          e.preventDefault();
          sourceInput.setSelectionRange(start, start + 1);
          if (!document.execCommand("insertText", false, e.key)) {
            sourceInput.setRangeText(e.key, start, start + 1, "end");
          }
          sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
      }
    }
  };

  updateCaretPositionDisplay() {
    const { sourceInput, caretPos } = this.refs;
    const index = sourceInput.selectionStart ?? 0;
    const { x, y } = caretFromText(sourceInput.value, index);
    caretPos.textContent = `x ${x}, y ${y}`;
  }

  normalizeGrid(forceAll = false) {
    if (this.isNormalizing) return;
    this.isNormalizing = true;
    const { sourceInput } = this.refs;
    try {
      const normalized = normalizeGrid(sourceInput.value, sourceInput.selectionStart, sourceInput.selectionEnd, forceAll);
      if (normalized) this.applyFullTextChangeUndoable(normalized.text, normalized.start, normalized.end);
    } finally {
      this.isNormalizing = false;
    }
  }

  onInteraction = (event: Event) => {
    this.normalizeGrid(false);
    this.updateCaretPositionDisplay();
    if (event.type === "input") this.change(this.refs.sourceInput.value);
  };

  onBlur = () => {
    this.normalizeGrid(true);
    this.change(this.refs.sourceInput.value);
    this.commit();
  };

  insertAtCursor = (text: string) => {
    const { sourceInput } = this.refs;
    const start = sourceInput.selectionStart ?? 0;
    const end = sourceInput.selectionEnd ?? 0;
    sourceInput.setSelectionRange(start, end);
    if (!document.execCommand("insertText", false, text)) {
      sourceInput.setRangeText(text, start, end, "end");
    }
    this.normalizeGrid();
    sourceInput.focus();
    sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
  };

  open(text: string) {
    this.refs.sourceInput.value = text;
    this.normalizeGrid();
    this.updateCaretPositionDisplay();
    this.toggle(true);
    requestAnimationFrame(() => {
      this.refs.sourceInput.focus({ preventScroll: true });
      this.updateCaretPositionDisplay();
    });
  }
}
