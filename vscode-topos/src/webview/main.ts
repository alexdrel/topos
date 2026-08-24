/// <reference lib="dom" />

import { Slate } from "../../../src-editor/slate/slate.ts";
import { EditorModel } from "../../../src-editor/slate/model.ts";
import { ToposDocument } from "../../../src-editor/model/document.ts";
import { formatSlateStatus } from "../../../src-editor/slate/status.ts";
import type { HostToWebviewMessage, SlateSessionState, WebviewToHostMessage } from "./messages.ts";

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const mountEl = document.getElementById("editor-mount")!;

let model: EditorModel | null = null;
let slate: Slate | null = null;
let lastSentText: string | null = null;
let selectionScale = 1;
let configuredFontSizePercent = 100;
let fontSizeDelta = 0;

function sendDocumentChange(): void {
  const currentText = model!.document.source;
  if (currentText === lastSentText) return;
  lastSentText = currentText;
  vscode.postMessage({ type: "change", text: currentText });
}

globalThis.addEventListener("message", (event) => {
  const message = event.data as HostToWebviewMessage;
  switch (message.type) {
    case "update": {
      const text = message.text;
      if (!model) {
        const toposDocument = new ToposDocument(text);
        model = new EditorModel(toposDocument);
        lastSentText = text;
        slate = new Slate({
          container: mountEl,
          model: model,
          nativeClipboard: false,
          selectionScale,
          fontSizePercent: configuredFontSizePercent + fontSizeDelta,
          onEditLegend: () => void vscode.postMessage({ type: "command", command: "editLegend" }),
          onOpenGuide: () => void vscode.postMessage({ type: "command", command: "openGuide" }),
          onMessage: (message) => {
            switch (message.type) {
              case "statusUpdate":
                vscode.postMessage({ type: "status", text: formatSlateStatus(message.status) });
                break;
              case "settingsUpdate":
                if (message.settings.rulerGridVisible !== undefined) {
                  updateSessionState({ rulerGridVisible: message.settings.rulerGridVisible });
                }
                if (message.settings.fontSizePercent !== undefined) {
                  fontSizeDelta = message.settings.fontSizePercent - configuredFontSizePercent;
                  updateSessionState({ fontSizeDelta });
                }
                break;
            }
          },
          onContextMenu: (target, context) => {
            target.dataset.vscodeContext = JSON.stringify(
              context.native
                ? {
                  toposEditor: false,
                }
                : {
                  toposEditor: true,
                  toposEditorSelection: context.hasSelection,
                  toposEditorCanToggleContents: context.canToggleContents,
                },
            );
          },
        });
        slate.focus();

        slate.surface.scrollEl.addEventListener("scrollend", () => {
          updateSessionState({
            scrollLeft: slate!.surface.scrollEl.scrollLeft,
            scrollTop: slate!.surface.scrollEl.scrollTop,
          });
        });

        model.subscribe((_model, event) => {
          if (event?.commit) sendDocumentChange();
        });
      } else if (text !== lastSentText) {
        lastSentText = text;
        model.syncDocumentSource(text);
      }
      break;
    }
    case "paste":
      if (message.text) model?.pasteText(message.text);
      break;
    case "slateContextCommand":
      slate?.contextCommand(message.command);
      break;
    case "toggleReplay":
      slate?.toggleReplay();
      break;
    case "appearance": {
      configuredFontSizePercent = message.fontSizePercent;
      slate?.setFontSizePercent(configuredFontSizePercent + fontSizeDelta);
      const family = message.family.trim();
      if (family && CSS.supports("font-family", family)) {
        mountEl.style.setProperty("--slate-theme-font-family", family);
      } else {
        mountEl.style.removeProperty("--slate-theme-font-family");
      }
      const selectionColor = message.selectionColor.trim();
      if (selectionColor && CSS.supports("color", selectionColor)) {
        mountEl.style.setProperty("--slate-theme-selection-fg", selectionColor);
      } else {
        mountEl.style.removeProperty("--slate-theme-selection-fg");
      }
      selectionScale = message.selectionScale;
      slate?.setSelectionScale(selectionScale);
      slate?.setRulerGridVisible(message.rulerGridVisible);
      break;
    }
    case "sessionState": {
      if (message.state.rulerGridVisible !== undefined) {
        slate?.setRulerGridVisible(message.state.rulerGridVisible);
      }
      fontSizeDelta = message.state.fontSizeDelta ?? 0;
      slate?.setFontSizePercent(configuredFontSizePercent + fontSizeDelta);
      requestAnimationFrame(() => {
        const scrollEl = slate?.surface.scrollEl;
        if (!scrollEl) return;
        scrollEl.scrollLeft = message.state.scrollLeft ?? 0;
        scrollEl.scrollTop = message.state.scrollTop ?? 0;
      });
      break;
    }
    default: {
      const unknownMessage: never = message;
      throw new Error(`Unknown host message: ${JSON.stringify(unknownMessage)}`);
    }
  }
});

function updateSessionState(state: SlateSessionState): void {
  vscode.postMessage({ type: "sessionStateUpdate", state });
}

// Request initial content on load
vscode.postMessage({ type: "ready" });

globalThis.addEventListener("copy", (e) => {
  if (model) {
    const text = model.getClipboardText();
    if (text) {
      vscode.postMessage({ type: "copy", text });
    }
    e.preventDefault();
  }
});

globalThis.addEventListener("cut", (e) => {
  if (model) {
    const text = model.cutClipboardText();
    if (text) {
      vscode.postMessage({ type: "copy", text });
    }
    e.preventDefault();
  }
});

globalThis.addEventListener("paste", (e) => {
  if (e.defaultPrevented) return;
  vscode.postMessage({ type: "paste" });
  e.preventDefault();
});

mountEl.dataset.vscodeContext = JSON.stringify({
  toposEditor: true,
  toposEditorSelection: false,
});
