import sourceHtml from "./source.html?raw";
import { initGlyphPane } from "./glyphs.ts";

interface SourceEditorApi {
  setText(text: string): void;
  focus(): void;
  insertAtCursor(text: string): void;
}

function initSourceEditor(onChange: (source: string) => void, onCommit: () => void): SourceEditorApi {
  const sourceInput = document.getElementById("source-input") as HTMLTextAreaElement;
  const caretPos = document.getElementById("caret-pos") as HTMLSpanElement;
  const overwriteBtn = document.getElementById("btn-overwrite") as HTMLButtonElement;

  let overwriteMode = true;
  let isNormalizing = false;

  // Sync initial UI state
  if (overwriteBtn) {
    overwriteBtn.classList.toggle("active", overwriteMode);
  }
  sourceInput.classList.toggle("ovr-active", overwriteMode);

  function toggleOverwrite() {
    overwriteMode = !overwriteMode;
    if (overwriteBtn) {
      overwriteBtn.classList.toggle("active", overwriteMode);
    }
    sourceInput.classList.toggle("ovr-active", overwriteMode);
    updateCaretPositionDisplay();
  }

  if (overwriteBtn) {
    overwriteBtn.addEventListener("click", toggleOverwrite);
  }

  function applyFullTextChangeUndoable(newValue: string, newStart: number, newEnd: number) {
    const oldValue = sourceInput.value;
    if (oldValue === newValue) {
      sourceInput.setSelectionRange(newStart, newEnd);
      return;
    }

    const { scrollTop, scrollLeft } = sourceInput;

    // Find minimal range to replace to avoid "Select All" in undo history
    let i = 0;
    while (i < oldValue.length && i < newValue.length && oldValue[i] === newValue[i]) i++;

    let j = 0;
    while (
      j < oldValue.length - i &&
      j < newValue.length - i &&
      oldValue[oldValue.length - 1 - j] === newValue[newValue.length - 1 - j]
    ) {
      j++;
    }

    const rangeStart = i;
    const rangeEnd = oldValue.length - j;
    const replacement = newValue.slice(i, newValue.length - j);

    sourceInput.focus();
    sourceInput.setSelectionRange(rangeStart, rangeEnd);

    // execCommand('insertText') is the only way to preserve undo stack in textarea
    if (!document.execCommand("insertText", false, replacement)) {
      sourceInput.value = newValue;
    }

    sourceInput.setSelectionRange(newStart, newEnd);
    sourceInput.scrollTop = scrollTop;
    sourceInput.scrollLeft = scrollLeft;
  }

  sourceInput.addEventListener("keydown", (e) => {
    if (e.key === "Insert") {
      e.preventDefault();
      toggleOverwrite();
      return;
    }

    if (overwriteMode && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
  });

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

  function updateCaretPositionDisplay() {
    const index = sourceInput.selectionStart ?? 0;
    const { x, y } = caretFromText(sourceInput.value, index);
    caretPos.textContent = `x ${x}, y ${y}`;
  }

  function indexFromCaret(lines: string[], x: number, y: number): number {
    let index = 0;
    for (let i = 0; i < y; i++) {
      index += lines[i].length + 1;
    }
    return index + x;
  }

  function normalizeGrid(forceAll = false) {
    if (isNormalizing) return;
    isNormalizing = true;
    try {
      const text = sourceInput.value;
      const start = sourceInput.selectionStart ?? 0;
      const end = sourceInput.selectionEnd ?? 0;

      const { x: startX, y: startY } = caretFromText(text, start);
      const { x: endX, y: endY } = caretFromText(text, end);

      const lines = text.split("\n");
      const targetW = Math.max(0, ...lines.map((l) => l.length));

      let changed = false;
      const nextLines = lines.map((l, i) => {
        // Only pad the lines within current selection by default.
        // This keeps the edit diff minimal and prevents "Select All" on Undo.
        if ((forceAll || (i >= startY && i <= endY)) && l.length < targetW) {
          changed = true;
          return l.padEnd(targetW);
        }
        return l;
      });

      if (changed) {
        const nextText = nextLines.join("\n");
        const newStart = indexFromCaret(nextLines, startX, startY);
        const newEnd = indexFromCaret(nextLines, endX, endY);
        applyFullTextChangeUndoable(nextText, newStart, newEnd);
      }
    } finally {
      isNormalizing = false;
    }
  }

  function onInteraction(event: Event) {
    normalizeGrid(false);
    updateCaretPositionDisplay();
    if (event.type === "input") onChange(sourceInput.value);
  }

  ["input", "click", "keyup", "select", "focus"].forEach((evt) => {
    sourceInput.addEventListener(evt, onInteraction);
  });

  sourceInput.addEventListener("blur", () => {
    normalizeGrid(true);
    onChange(sourceInput.value);
    onCommit();
  });

  return {
    setText: (text: string) => {
      sourceInput.value = text;
      normalizeGrid();
      updateCaretPositionDisplay();
    },
    focus: () => {
      requestAnimationFrame(() => {
        sourceInput.focus({ preventScroll: true });
        updateCaretPositionDisplay();
      });
    },
    insertAtCursor: (text: string) => {
      const start = sourceInput.selectionStart ?? 0;
      const end = sourceInput.selectionEnd ?? 0;
      sourceInput.setSelectionRange(start, end);
      if (!document.execCommand("insertText", false, text)) {
        sourceInput.setRangeText(text, start, end, "end");
      }
      normalizeGrid();
      sourceInput.focus();
      sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
    },
  };
}

export interface SourceApi {
  open(source: string): void;
  close(): void;
}

export function initSource(config: { change(source: string): void; commit(): void }): SourceApi {
  const mount = document.getElementById("source-mount") as HTMLDivElement;
  const template = document.createElement("template");
  template.innerHTML = sourceHtml;
  const toolbar = template.content.querySelector<HTMLElement>("[data-source-part=toolbar]")!;
  const pane = template.content.querySelector<HTMLElement>("[data-source-part=body]")!;
  document.getElementById("surface-toolbar-mount")!.appendChild(toolbar);
  mount.appendChild(pane);
  const editor = initSourceEditor(config.change, config.commit);
  initGlyphPane({ onInsert: editor.insertAtCursor });

  function close() {
    toolbar.classList.add("hidden");
    pane.classList.add("hidden");
  }

  function open(text: string) {
    editor.setText(text);
    toolbar.classList.remove("hidden");
    pane.classList.remove("hidden");
    editor.focus();
  }

  return { open, close };
}
