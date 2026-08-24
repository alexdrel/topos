import * as vscode from "vscode";
import { renderToposDocument } from "./render.ts";
import { type ActiveToposSource, documentSource, findToposSource, onDidActivateToposDocument } from "./source.ts";
import { sameUri, uriFilename } from "./util.ts";
import { ViewerWebview } from "./viewer-webview.ts";

const VIEW_TYPE = "topos.preview";

export class ToposPreview {
  private readonly panel: vscode.WebviewPanel;
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly disposeCallbacks: Array<() => void> = [];
  private source: ActiveToposSource;
  private readonly viewer: ViewerWebview;

  public constructor(source: ActiveToposSource, extensionUri: vscode.Uri) {
    this.source = source;
    this.panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      previewTitle(source.document),
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.panel.iconPath = vscode.Uri.joinPath(
      extensionUri,
      "resources",
      "topos-view.svg",
    );
    this.viewer = new ViewerWebview(
      this.panel,
      (appearance) => renderToposDocument(this.source.text, this.source.fence, this.source.override, appearance),
    );
    this.subscriptions.push(this.viewer);

    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (sameUri(event.document.uri, this.source.document.uri)) {
          if (this.source.kind === "document") {
            this.source = documentSource(event.document);
            this.update();
          } else {
            this.updateFromActiveSource();
          }
        }
      }),
    );
    this.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
      this.updateFromActiveSource();
    }));
    this.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(() => {
      this.updateFromActiveSource();
    }));
    this.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(() => {
      this.updateFromActiveSource();
    }));
    this.subscriptions.push(vscode.window.tabGroups.onDidChangeTabGroups(() => {
      this.updateFromActiveSource();
    }));
    this.subscriptions.push(onDidActivateToposDocument((document) => {
      this.source = documentSource(document);
      this.update();
    }));

    this.panel.onDidDispose(() => this.dispose());
  }

  public reveal(): void {
    this.panel.reveal(vscode.ViewColumn.Beside);
  }

  public show(source: ActiveToposSource): void {
    this.source = source;
    this.update();
    this.reveal();
  }

  public onDispose(callback: () => void): void {
    this.disposeCallbacks.push(callback);
  }

  private updateFromActiveSource(): void {
    const source = findToposSource();
    if (!source) return;
    this.source = source;
    this.update();
  }

  private update(): void {
    this.panel.title = previewTitle(this.source.document);
    this.viewer.update();
  }

  private dispose(): void {
    while (this.subscriptions.length) {
      this.subscriptions.pop()?.dispose();
    }
    while (this.disposeCallbacks.length) {
      this.disposeCallbacks.pop()?.();
    }
  }
}

function previewTitle(document: vscode.TextDocument): string {
  return `Preview ${uriFilename(document.uri, "Topos")}`;
}
