import { PersistedSignal } from "../signals/persisted-signal.ts";
import editMenuTemplate, { type Params as EditParams, type Refs as EditRefs } from "./edit-menu.html.js";
import createMenuTemplate from "./create-menu.html.js";
import slateTemplate, { type Params } from "./slate.html.js";
import "../css/slate.css";
import { appendChild, materialize } from "@alexdrel/pralinejs";
import { Panel } from "../panel.ts";
import { Slate } from "../../../src-editor/slate/slate.ts";
import type { EditorModel } from "../../../src-editor/model/model.ts";
import { cancelInteraction } from "../app-context.ts";
import { isTypingTarget } from "../dom-utils.ts";
import { type DropdownMenu, initDropdownMenu } from "../menus.ts";
import type { EditorHistory } from "../../../src-editor/model/history.ts";
import { formatSlateStatus } from "../../../src-editor/slate/status.ts";

const rulerGrid = new PersistedSignal("topos-editor-ruler-grid", Boolean);

export class SlatePane extends Panel implements Partial<Params>, Partial<EditParams> {
  model: EditorModel;
  history: EditorHistory;
  slate: Slate;
  editRefs: EditRefs;
  createMenu: DropdownMenu;
  editMenu: DropdownMenu;
  toggleCheatsheet!: (visible?: boolean) => void;
  focus: () => void;

  constructor(model: EditorModel, history: EditorHistory) {
    super(document.getElementById("surface-toolbar-mount")!, document.getElementById("surface-stack")!, "main");
    this.model = model;
    this.history = history;
    const refs = this.materialize(slateTemplate, { toggleHelp: () => this.toggleCheatsheet() });

    const edit = materialize(editMenuTemplate, [
      {
        duplicateRight: () => model.duplicateSelection(1, 0),
        duplicateDown: () => model.duplicateSelection(0, 1),
      },
      this,
    ]);
    this.editRefs = edit.refs;
    refs.editMenuDropdown.append(edit.fragment);
    appendChild(refs.createMenuDropdown, createMenuTemplate, {
      createBox: () => this.startDrawing("box"),
      createText: () => this.startDrawing("text"),
      createLine: () => this.startDrawing("line"),
      createHub: () => this.startDrawing("hub"),
    });

    this.slate = new Slate({
      container: refs.panelBody,
      model,
      hideChrome: true,
      nativeClipboard: true,
      rulerGridVisible: rulerGrid.value,
      onMessage: (message) => {
        switch (message.type) {
          case "statusUpdate":
            refs.slateStatus.textContent = formatSlateStatus(message.status);
            break;
          case "settingsUpdate":
            if (message.settings.rulerGridVisible !== undefined) rulerGrid.value = message.settings.rulerGridVisible;
            break;
        }
      },
    });
    this.focus = this.slate.focus.bind(this.slate);
    this.onResize = this.slate.refresh.bind(this.slate);
    rulerGrid.subscribe((visible) => this.slate.setRulerGridVisible(visible));
    this.createMenu = initDropdownMenu(refs.createMenuDropdown);
    this.editMenu = initDropdownMenu(refs.editMenuDropdown);
    cancelInteraction.subscribe((initiator) => {
      if (initiator !== this.startDrawing) this.slate.cancelInteraction();
      if (initiator !== this.toggleReplay) this.slate.closePopups();
    });
    model.subscribe(this.refreshActions);
    globalThis.addEventListener("keydown", this.onKeyDown);
  }

  toggleReplay = () => {
    cancelInteraction.value = this.toggleReplay;
    this.slate.toggleReplay();
  };

  refreshActions = () => {
    const hasSelection = this.model.selection.length > 0;
    const refs = this.editRefs;
    for (const button of [refs.cut, refs.copy, refs.delete, refs.duplicateRight, refs.duplicateDown]) {
      button.disabled = !hasSelection;
    }
    refs.undo.disabled = !this.history.canUndo;
    refs.redo.disabled = !this.history.canRedo;
  };

  startDrawing = (kind: "box" | "line" | "hub" | "text") => {
    cancelInteraction.value = this.startDrawing;
    this.slate.startDrawing(kind);
    this.refreshActions();
  };

  async copy() {
    try {
      await navigator.clipboard.writeText(this.model.getClipboardText());
    } catch (error) {
      clipboardError("Copy", error);
    }
  }

  async cut() {
    const text = this.model.cutClipboardText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      clipboardError("Cut", error);
    }
  }

  async paste() {
    try {
      this.model.pasteText(await navigator.clipboard.readText());
    } catch (error) {
      clipboardError("Paste", error);
    }
  }

  onKeyDown = (event: KeyboardEvent) => {
    if (!this.visible) return;
    const key = event.key.toLowerCase();
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.altKey && event.shiftKey && event.code === "KeyR") {
      event.preventDefault();
      this.toggleReplay();
      return;
    }
    if (event.key === "?") {
      if (!isTypingTarget(event.target)) {
        event.preventDefault();
        this.toggleCheatsheet();
      }
      return;
    }
    if (isTypingTarget(event.target)) return;
    if (!event.defaultPrevented && !mod && !event.altKey) {
      const drawingKind = ({ b: "box", t: "text", l: "line", h: "hub" } as const)[key as "b" | "t" | "l" | "h"];
      if (drawingKind) {
        event.preventDefault();
        this.startDrawing(drawingKind);
        return;
      }
    }
    if (event.defaultPrevented || !mod) return;
    if (key === "z" && !event.shiftKey) this.history.undo();
    else if (key === "y" || (key === "z" && event.shiftKey)) this.history.redo();
    else return;
    event.preventDefault();
  };
}

function clipboardError(operation: string, error: unknown) {
  console.error(error);
  alert(`${operation} failed. Try the keyboard shortcut.`);
}
