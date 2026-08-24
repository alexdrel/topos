import * as vscode from "vscode";
import type { StatusConfig } from "./webview/messages.ts";

let item: vscode.StatusBarItem | undefined;
const panelStatus = new Map<vscode.WebviewPanel, StatusConfig>();

export function registerStatusBar(context: vscode.ExtensionContext): void {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.name = "Topos Dimensions and Zoom";
  context.subscriptions.push(item);
}

export function trackStatusBar(panel: vscode.WebviewPanel): vscode.Disposable {
  const refreshSubscription = panel.onDidChangeViewState(refreshStatusBar);
  const disposeSubscription = panel.onDidDispose(() => {
    panelStatus.delete(panel);
    refreshStatusBar();
  });
  return vscode.Disposable.from(refreshSubscription, disposeSubscription);
}

export function updateStatusBar(panel: vscode.WebviewPanel, message: unknown): boolean {
  if (!isStatusMessage(message)) return false;
  panelStatus.set(panel, message);
  refreshStatusBar();
  return true;
}

function refreshStatusBar(): void {
  if (!item) return;
  const status = [...panelStatus].find(([panel]) => panel.active)?.[1];
  if (!status) {
    item.hide();
    return;
  }
  item.text = status.text;
  item.tooltip = status.tooltip;
  item.command = status.command;
  item.show();
}

function isStatusMessage(message: unknown): message is StatusConfig & { type: "status" } {
  const status = message as Partial<StatusConfig & { type: string }>;
  return status?.type === "status" && typeof status.text === "string" &&
    (!status.command || typeof status.command === "string" && status.command.startsWith("topos."));
}
