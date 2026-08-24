import * as vscode from "vscode";
import { SLATE_CONTEXT_COMMANDS, type SlateContextCommand } from "../../src-editor/slate/context-command.ts";
import type { AppearanceConfig, HostToWebviewMessage, SlateSessionState, WebviewToHostMessage } from "./webview/messages.ts";
import { trackStatusBar, updateStatusBar } from "./status-bar.ts";
import editorTemplate from "./editor.html" with { type: "text" };
import { notifyToposDocumentActivated } from "./source.ts";
import { clamp, sameUri } from "./util.ts";

const VIEW_TYPE = "topos.editor";

function editorHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "out", "webview.js"));
  return editorTemplate
    .replaceAll("{{CSP_SOURCE}}", webview.cspSource)
    .replace("{{SCRIPT_URI}}", scriptUri.toString());
}

function configuredAppearance(): AppearanceConfig {
  const config = vscode.workspace.getConfiguration("topos.editor");
  const fontSizeIncrease = config.get("fontSizeIncrease", 20);
  const selectionSizeIncrease = config.get("selectionSizeIncrease", 0);
  return {
    fontSizePercent: 100 + clamp(fontSizeIncrease, 0, 100),
    family: config.get("fontFamily", ""),
    selectionColor: config.get("selectionColor", ""),
    selectionScale: 1 + clamp(selectionSizeIncrease, 0, 200) / 100,
    rulerGridVisible: config.get("rulerGrid", false),
  };
}

async function editLegendInText(document: vscode.TextDocument): Promise<void> {
  let text = document.getText();
  let header = text.search(/^[ \t]*:legend\b/m);

  if (header === -1) {
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, document.positionAt(text.length), "\n:legend\n");
    await vscode.workspace.applyEdit(edit);
    text = document.getText();
    header = text.search(/^[ \t]*:legend\b/m);
  }

  if (header === -1) return;
  const newline = text.indexOf("\n", header);
  const position = document.positionAt(newline === -1 ? text.length : newline + 1);
  await vscode.window.showTextDocument(document, {
    selection: new vscode.Range(position, position),
    viewColumn: vscode.ViewColumn.Active,
  });
}

export class ToposEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ToposEditorProvider(context.extensionUri);
    provider.updateContext();
    return vscode.Disposable.from(
      vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
        supportsMultipleEditorsPerDocument: true,
      }),
      vscode.window.onDidChangeActiveTextEditor(provider.updateContext),
      vscode.window.tabGroups.onDidChangeTabs(provider.updateContext),
      vscode.window.tabGroups.onDidChangeTabGroups(provider.updateContext),
      vscode.commands.registerCommand("topos.slate.replay", () => provider.toggleReplay()),
      ...SLATE_CONTEXT_COMMANDS.map((command) => vscode.commands.registerCommand(`topos.slate.${command}`, () => provider.contextCommand(command))),
    );
  }

  private readonly panels = new Set<vscode.WebviewPanel>();
  private readonly slateSessions = new Map<string, SlateSessionState>();

  constructor(private readonly extensionUri: vscode.Uri) {}

  private updateContext = (): void => {
    void vscode.commands.executeCommand("setContext", "toposEditor", [...this.panels].some((panel) => panel.active));
  };

  private contextCommand(command: SlateContextCommand): void {
    const panel = [...this.panels].find((candidate) => candidate.active);
    if (!panel) return;
    void panel.webview.postMessage({ type: "slateContextCommand", command });
  }

  private toggleReplay(): void {
    const panel = [...this.panels].find((candidate) => candidate.active);
    if (panel) void panel.webview.postMessage({ type: "toggleReplay" });
  }

  public resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): void {
    this.panels.add(webviewPanel);
    const updateViewState = () => {
      this.updateContext();
      if (webviewPanel.active) notifyToposDocumentActivated(document);
    };
    updateViewState();
    const statusSubscription = trackStatusBar(webviewPanel);
    const viewSubscription = webviewPanel.onDidChangeViewState(updateViewState);
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "out"),
      ],
    };

    webviewPanel.iconPath = vscode.Uri.joinPath(this.extensionUri, "resources", "topos-edit.svg");

    const sessionKey = `${document.uri.toString()}@${webviewPanel.viewColumn ?? 0}`;
    const sessionState = this.slateSessions.get(sessionKey) ?? {};
    const postMessage = (message: HostToWebviewMessage) => webviewPanel.webview.postMessage(message);
    const updateAppearance = () => {
      const appearance = configuredAppearance();
      appearance.rulerGridVisible = sessionState.rulerGridVisible ?? appearance.rulerGridVisible;
      void postMessage({ type: "appearance", ...appearance });
    };

    let webviewText: string | undefined;
    const updateWebview = () => {
      const text = document.getText();
      if (text === webviewText) return;
      webviewText = text;
      void postMessage({ type: "update", text });
    };
    const updateDocument = (text: string) => {
      webviewText = text;
      if (text === document.getText()) return;
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
      void vscode.workspace.applyEdit(edit);
    };

    // Receive events from the webview client
    const messageListener = webviewPanel.webview.onDidReceiveMessage((message: WebviewToHostMessage) => {
      switch (message.type) {
        case "ready":
          webviewText = undefined;
          updateWebview();
          updateAppearance();
          void postMessage({ type: "sessionState", state: sessionState });
          break;
        case "change":
          updateDocument(message.text);
          break;
        case "copy":
          vscode.env.clipboard.writeText(message.text);
          break;
        case "paste":
          vscode.env.clipboard.readText().then((text) => postMessage({ type: "paste", text }));
          break;
        case "status":
          updateStatusBar(webviewPanel, message);
          break;
        case "sessionStateUpdate":
          Object.assign(sessionState, message.state);
          this.slateSessions.set(sessionKey, sessionState);
          break;
        case "command": {
          const command = message.command;
          switch (command) {
            case "editLegend":
              void editLegendInText(document);
              break;
            case "openGuide":
              void vscode.commands.executeCommand("topos.openGuide");
              break;
            default: {
              const unknownCommand: never = command;
              throw new Error(`Unknown webview command: ${unknownCommand}`);
            }
          }
          break;
        }
        default: {
          const unknownMessage: never = message;
          throw new Error(`Unknown webview message: ${JSON.stringify(unknownMessage)}`);
        }
      }
    });

    // Listen to changes to the document from the host side (e.g. undo/redo, disk changes)
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (sameUri(event.document.uri, document.uri)) updateWebview();
    });

    const configurationSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("topos.editor")) updateAppearance();
    });

    webviewPanel.onDidDispose(() => {
      this.panels.delete(webviewPanel);
      this.updateContext();
      messageListener.dispose();
      changeSubscription.dispose();
      configurationSubscription.dispose();
      statusSubscription.dispose();
      viewSubscription.dispose();
    });

    webviewPanel.webview.html = editorHtml(
      webviewPanel.webview,
      this.extensionUri,
    );
  }
}
