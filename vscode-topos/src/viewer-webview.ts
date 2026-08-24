import * as vscode from "vscode";
import type { ToposRenderResult, ViewerAppearance } from "./render.ts";
import { trackStatusBar, updateStatusBar } from "./status-bar.ts";
import { escapeHtml } from "./util.ts";
import viewerTemplate from "./viewer.html" with { type: "text" };

const viewers = new Set<ViewerWebview>();
const THEMES: ViewerAppearance["theme"][] = ["host", "light", "dark"];

export interface ViewerSessionState {
  zoom?: number;
  fitMode?: "all" | "width" | "height" | null;
  scrollLeft?: number;
  scrollTop?: number;
}

function activeViewer(): ViewerWebview | undefined {
  return [...viewers].find((viewer) => viewer.active);
}

function updateViewerContext(): void {
  void vscode.commands.executeCommand("setContext", "toposViewer", !!activeViewer());
}

function viewerContent(result: ToposRenderResult): string {
  if (result.ok) return `<main class="stage">${result.svg}</main>`;
  return `<main class="error"><h1>Render failed</h1><pre>${escapeHtml(result.error)}</pre></main>`;
}

export class ViewerWebview implements vscode.Disposable {
  public static register(context: vscode.ExtensionContext): void {
    updateViewerContext();
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(updateViewerContext),
      vscode.window.tabGroups.onDidChangeTabs(updateViewerContext),
      vscode.window.tabGroups.onDidChangeTabGroups(updateViewerContext),
      vscode.commands.registerCommand("topos.viewer.toggleFit", () => {
        const viewer = activeViewer();
        if (viewer) void viewer.panel.webview.postMessage({ type: "toggleFit" });
      }),
      vscode.commands.registerCommand("topos.viewer.cycleTheme", () => activeViewer()?.cycleTheme()),
      vscode.commands.registerCommand("topos.viewer.toggleForce", () => activeViewer()?.toggleForce()),
    );
  }

  private readonly subscriptions: vscode.Disposable;
  private readonly appearance: ViewerAppearance = { theme: "host", force: false };
  private ready = false;

  constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly render: (appearance: ViewerAppearance) => ToposRenderResult,
    private readonly sessionState: ViewerSessionState = {},
    private readonly onSessionStateUpdate?: () => void,
  ) {
    panel.webview.options = { ...panel.webview.options, enableScripts: true };
    this.subscriptions = vscode.Disposable.from(
      trackStatusBar(panel),
      panel.onDidChangeViewState(updateViewerContext),
      panel.webview.onDidReceiveMessage((message: unknown) => this.receive(message)),
    );
    viewers.add(this);
    updateViewerContext();
    panel.webview.html = viewerTemplate;
  }

  public update(): void {
    if (!this.ready) return;
    void this.panel.webview.postMessage({ type: "update", content: viewerContent(this.render(this.appearance)) });
  }

  public get active(): boolean {
    return this.panel.active;
  }

  public dispose(): void {
    viewers.delete(this);
    updateViewerContext();
    this.subscriptions.dispose();
  }

  private cycleTheme(): void {
    this.appearance.theme = THEMES[(THEMES.indexOf(this.appearance.theme) + 1) % THEMES.length];
    this.update();
  }

  private toggleForce(): void {
    this.appearance.force = !this.appearance.force;
    this.update();
  }

  private receive(message: unknown): void {
    if (updateStatusBar(this.panel, message)) return;
    const webviewMessage = message as { type?: string; state?: ViewerSessionState; action?: string } | null;
    if (webviewMessage?.type === "action") {
      if (webviewMessage.action === "cycleTheme") this.cycleTheme();
      else if (webviewMessage.action === "toggleForce") this.toggleForce();
      else if (webviewMessage.action === "export") void vscode.commands.executeCommand("topos.export");
      return;
    }
    if (webviewMessage?.type === "sessionStateUpdate" && webviewMessage.state) {
      Object.assign(this.sessionState, webviewMessage.state);
      this.onSessionStateUpdate?.();
      return;
    }
    if (webviewMessage?.type !== "ready") return;
    this.ready = true;
    this.update();
    void this.panel.webview.postMessage({ type: "sessionState", state: this.sessionState });
    if (this.panel.active) this.panel.reveal(this.panel.viewColumn, false);
  }
}
