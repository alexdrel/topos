/// <reference lib="dom" />
import { Slate } from "../src-editor/slate/slate.ts";
import { EditorModel } from "../src-editor/slate/model.ts";
import { isModKey } from "../src-editor/slate/dom.ts";
import { ToposDocument } from "../src-editor/model/document.ts";
import { isTypingTarget } from "./editor/dom-utils.ts";
import { EditorHistory } from "../src-editor/model/history.ts";
import { formatSlateStatus } from "../src-editor/slate/status.ts";

const INITIAL_SOURCE = `\
           # Sample ⏎ Slate Editor

   ╭────────────────────────────────────╮
   │               [Top]                │
   │                ┏━━━━━━━━━━━━━━━┓   │
   │      ┌─────────┨               ┃   │
   │  ╔═══●════╗    ┃               ┃   │
   │  ║        ║    ┃      CC       ┃   │
   │  ║   DD   ║    ┃               ┃   │
   │  ║        ║    ┃               ┃   │
   │  ╚═════□══╝    ┗━━━━━━━━▲━━━━━━┛   │
   │        │                ┃          │
   ╰────────┼────────────────╂──────────╯
            │                ┃
            │                ┃
            └──────┐         ┗━━Foo━┓
                   │                ┃
         ┏━━━━━━━━━┿━━ Bottom ━━━━━━╋━━━━━━━━━━┓
         ┃         │                ┃          ┃
         ┃         │                ┃          ┃
         ┃    ┌────▼─────┐      ┌───◆───┐      ┃
         ┃    │          │      │       │      ┃
         ┃    │    AA    ├─────▶│  BB   │      ┃
         ┃    │          │      │       │      ┃
         ┃    └────▲─────┘      └───┬───┘      ┃
         ┃         │                │          ┃
         ┃         └─────── Bar ────┘          ┃
         ┃                                     ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
:legend
[Top] : #top
[Bottom] : #bottom
[AA] : .blue
[BB] : .red
[CC] : .green
[DD] : .yellow
`;

const mountEl = document.getElementById("editor-mount")!;
const sourceOut = document.getElementById("source-out") as HTMLTextAreaElement;
const btnUndo = document.getElementById("btn-undo") as HTMLButtonElement;
const btnRedo = document.getElementById("btn-redo") as HTMLButtonElement;
const slateStatus = document.getElementById("slate-status")!;

const toposDocument = new ToposDocument(INITIAL_SOURCE);
const model = new EditorModel(toposDocument);
const history = new EditorHistory(model);

function undo() {
  history.undo();
  sourceOut.value = toposDocument.source;
  updateButtons();
}

function redo() {
  history.redo();
  sourceOut.value = toposDocument.source;
  updateButtons();
}

const slate = new Slate({
  container: mountEl,
  model: model,
  nativeClipboard: true,
  onMessage: (message) => {
    if (message.type === "statusUpdate") slateStatus.textContent = formatSlateStatus(message.status);
  },
  onEditLegend: () => {
    let idx = sourceOut.value.search(/^[ \t]*:legend\b/m);
    if (idx === -1) {
      const text = sourceOut.value;
      const needsPrecedingNewline = text.length > 0 && !text.endsWith("\n");
      sourceOut.value = text + (needsPrecedingNewline ? "\n" : "") + ":legend\n";
      history.updateSource(sourceOut.value);
      idx = sourceOut.value.search(/^[ \t]*:legend\b/m);
    }

    if (idx !== -1) {
      const newlineIdx = sourceOut.value.indexOf("\n", idx);
      const targetIdx = newlineIdx !== -1 ? newlineIdx + 1 : sourceOut.value.length;
      sourceOut.focus();
      sourceOut.setSelectionRange(targetIdx, targetIdx);
      const lineCountBefore = sourceOut.value.substring(0, targetIdx).split("\n").length;
      const lineHeight = 18;
      sourceOut.scrollTop = Math.max(0, (lineCountBefore - 2) * lineHeight);
    } else {
      sourceOut.focus();
    }
  },
});

function updateButtons() {
  btnUndo.disabled = !history.canUndo;
  btnRedo.disabled = !history.canRedo;
}

btnUndo.addEventListener("click", undo);
btnRedo.addEventListener("click", redo);

document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || isTypingTarget(e.target)) return;
  const mod = isModKey(e);
  if (mod && e.altKey && e.shiftKey && e.code === "KeyR") {
    e.preventDefault();
    slate.toggleReplay();
    return;
  }
  if (mod && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
    e.preventDefault();
    redo();
  }
});

// Subscribe to model changes
model.subscribe((_, event) => {
  const isInitial = event === undefined;
  const shouldUpdateText = isInitial || event?.commit;

  if (shouldUpdateText && document.activeElement !== sourceOut) {
    sourceOut.value = toposDocument.source;
  }
  updateButtons();
});

// Intentionally live: this standalone page emulates VS Code host document
// updates, matching the production editor's live Source pane.
sourceOut.addEventListener("input", () => {
  history.updateSource(sourceOut.value);
  updateButtons();
});
sourceOut.addEventListener("blur", () => {
  history.commitSource();
  updateButtons();
});
