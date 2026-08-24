import * as vscode from "vscode";
import { renderToposDocument } from "./render.ts";
import { type ViewerSessionState, ViewerWebview } from "./viewer-webview.ts";
import { sameUri } from "./util.ts";

const VIEW_TYPE = "topos.viewer";

export class ToposViewerProvider implements vscode.CustomTextEditorProvider {
  public static register(extensionUri: vscode.Uri): vscode.Disposable {
    const provider = new ToposViewerProvider(extensionUri);
    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      supportsMultipleEditorsPerDocument: true,
    });
  }

  constructor(private readonly extensionUri: vscode.Uri) {}

  private readonly sessions = new Map<string, ViewerSessionState>();

  public resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): void {
    webviewPanel.iconPath = vscode.Uri.joinPath(this.extensionUri, "resources", "topos-view.svg");
    const sessionKey = `${document.uri.toString()}@${webviewPanel.viewColumn ?? 0}`;
    const sessionState = this.sessions.get(sessionKey) ?? {};
    const viewer = new ViewerWebview(
      webviewPanel,
      (appearance) => renderToposDocument(document.getText(), {}, false, appearance),
      sessionState,
      () => this.sessions.set(sessionKey, sessionState),
    );

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (sameUri(event.document.uri, document.uri)) {
        viewer.update();
      }
    });
    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      viewer.dispose();
    });
  }
}
