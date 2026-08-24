import editMenuHtml from "./edit-menu.html?raw";
import createMenuHtml from "./create-menu.html?raw";
import slateHtml from "./slate.html?raw";

import { Slate } from "../../../src-editor/slate/slate.ts";
import type { EditorModel } from "../../../src-editor/model/model.ts";
import { initDropdownMenu, isTypingTarget } from "../dom-utils.ts";
import { initCheatsheet } from "./cheatsheet.ts";
import type { EditorHistory } from "../../../src-editor/model/history.ts";
import { formatSlateStatus } from "../../../src-editor/slate/status.ts";

const RULER_GRID_STORAGE_KEY = "topos-editor-ruler-grid";

interface SlatePaneApi {
  focus(): void;
  refresh(): void;
  cancel(): void;
  setVisible(visible: boolean): void;
}

export function initSlatePane(model: EditorModel, history: EditorHistory): SlatePaneApi {
  const template = document.createElement("template");
  template.innerHTML = slateHtml;
  const toolbar = template.content.querySelector<HTMLElement>("[data-slate-part=toolbar]")!;
  const controls = template.content.querySelector<HTMLElement>("[data-slate-part=controls]")!;
  const status = template.content.querySelector<HTMLElement>("[data-slate-part=status]")!;
  const help = template.content.querySelector<HTMLButtonElement>("[data-slate-part=help]")!;
  const replay = template.content.querySelector<HTMLButtonElement>("[data-slate-part=replay]")!;
  const canvas = template.content.querySelector<HTMLDivElement>("[data-slate-part=canvas]")!;
  document.getElementById("surface-toolbar-mount")!.appendChild(toolbar);
  document.getElementById("slate-pane-mount")!.appendChild(canvas);

  function element<T extends HTMLElement>(id: string): T {
    return controls.querySelector<T>(`#${id}`)!;
  }

  element("edit-menu-dropdown").innerHTML = editMenuHtml;
  element("create-menu-dropdown").innerHTML = createMenuHtml;

  let visible = true;
  const slate = new Slate({
    container: canvas,
    model,
    hideChrome: true,
    nativeClipboard: true,
    rulerGridVisible: localStorage.getItem(RULER_GRID_STORAGE_KEY) === "true",
    onMessage: (message) => {
      switch (message.type) {
        case "statusUpdate":
          status.textContent = formatSlateStatus(message.status);
          break;
        case "settingsUpdate":
          if (message.settings.rulerGridVisible !== undefined) {
            localStorage.setItem(RULER_GRID_STORAGE_KEY, String(message.settings.rulerGridVisible));
          }
          break;
      }
    },
  });

  const createMenu = initDropdownMenu(
    element("btn-create-menu"),
    element("create-menu-content"),
    () => editMenu.close(),
  );
  const editMenu = initDropdownMenu(
    element("btn-edit-menu"),
    element("edit-menu-content"),
    () => createMenu.close(),
  );
  const cheatsheet = initCheatsheet();
  help.addEventListener("click", () => {
    slate.closePopups();
    cheatsheet.toggle();
  });
  replay.addEventListener("click", () => {
    cheatsheet.hide();
    slate.toggleReplay();
  });

  function cancel() {
    slate.cancelInteraction();
  }

  function refreshActions() {
    const hasSelection = model.selection.length > 0;
    for (const id of ["btn-cut", "btn-copy", "btn-delete", "btn-duplicate-right", "btn-duplicate-down"]) {
      element<HTMLButtonElement>(id).disabled = !hasSelection;
    }
    element<HTMLButtonElement>("btn-undo").disabled = !history.canUndo;
    element<HTMLButtonElement>("btn-redo").disabled = !history.canRedo;
  }

  function bindCreateButton(id: string, kind: "box" | "line" | "hub" | "text") {
    element(id).addEventListener("click", () => {
      slate.startDrawing(kind);
      createMenu.close();
      refreshActions();
    });
  }

  bindCreateButton("btn-create-box", "box");
  bindCreateButton("btn-create-text", "text");
  bindCreateButton("btn-create-line", "line");
  bindCreateButton("btn-create-hub", "hub");

  function clipboardError(operation: string, error: unknown) {
    console.error(error);
    alert(`${operation} failed. Try the keyboard shortcut.`);
  }

  function pasteText(text: string): void {
    model.pasteText(text);
  }

  element("btn-undo").addEventListener("click", () => history.undo());
  element("btn-redo").addEventListener("click", () => history.redo());
  element("btn-delete").addEventListener("click", () => model.deleteSelected());
  element("btn-duplicate-right").addEventListener("click", () => model.duplicateSelection(1, 0));
  element("btn-duplicate-down").addEventListener("click", () => model.duplicateSelection(0, 1));
  element("btn-copy").addEventListener("click", () => {
    void navigator.clipboard.writeText(model.getClipboardText()).catch((error) => clipboardError("Copy", error));
  });
  element("btn-cut").addEventListener("click", () => {
    const text = model.cutClipboardText();
    if (text) void navigator.clipboard.writeText(text).catch((error) => clipboardError("Cut", error));
  });
  element("btn-paste").addEventListener("click", () => {
    void navigator.clipboard.readText().then(pasteText).catch((error) => clipboardError("Paste", error));
  });

  model.subscribe(refreshActions);
  globalThis.addEventListener("keydown", onKeyDown);

  function onKeyDown(event: KeyboardEvent) {
    if (!visible) return;
    const key = event.key.toLowerCase();
    const mod = event.metaKey || event.ctrlKey;

    if (mod && event.altKey && event.shiftKey && event.code === "KeyR") {
      event.preventDefault();
      slate.toggleReplay();
      return;
    }

    if (event.key === "?") {
      if (!isTypingTarget(event.target)) {
        event.preventDefault();
        cheatsheet.toggle();
      }
      return;
    }
    if (event.key === "Escape") cheatsheet.hide();
    if (isTypingTarget(event.target)) return;

    if (!event.defaultPrevented && !mod && !event.altKey) {
      const drawingKind = ({ b: "box", t: "text", l: "line", h: "hub" } as const)[key as "b" | "t" | "l" | "h"];
      if (drawingKind) {
        event.preventDefault();
        slate.startDrawing(drawingKind);
        refreshActions();
        return;
      }
    }

    if (event.defaultPrevented || !mod) return;
    if (key === "z" && !event.shiftKey) history.undo();
    else if (key === "y" || (key === "z" && event.shiftKey)) history.redo();
    else return;
    event.preventDefault();
  }

  return {
    focus: slate.focus.bind(slate),
    refresh: slate.refresh.bind(slate),
    cancel,
    setVisible(next) {
      visible = next;
      canvas.classList.toggle("hidden", !visible);
      toolbar.classList.toggle("hidden", !visible);
      if (!visible) {
        cancel();
        cheatsheet.hide();
      }
    },
  };
}
