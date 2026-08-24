import * as vscode from "vscode";
import { renderToposDocument } from "./render.ts";
import { type ActiveToposSource, isToposTabInput, showNoSource } from "./source.ts";
import { sameUri, uriFilename } from "./util.ts";
import { ViewerWebview } from "./viewer-webview.ts";

const snapshotTexts = new Map<vscode.WebviewPanel, string>();

export function activeSnapshotText(): string | undefined {
  for (const [panel, text] of snapshotTexts) {
    if (panel.active) return text;
  }
  return undefined;
}

export async function editSource(source: ActiveToposSource | undefined): Promise<void> {
  if (!source) return showNoSource();

  if (source.kind === "document") {
    await openDocumentWith(source, "topos.editor");
    return;
  }

  await openTextInSlate(source.text);
}

export async function openTextInSlate(text: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "topos",
    content: text,
  });
  await vscode.commands.executeCommand(
    "vscode.openWith",
    document.uri,
    "topos.editor",
    vscode.ViewColumn.Beside,
  );
}

export function viewSource(context: vscode.ExtensionContext, source: ActiveToposSource | undefined): void {
  if (!source) return showNoSource();

  const filename = uriFilename(source.document.uri, "diagram");
  const { text, fence, override } = source;
  const panel = vscode.window.createWebviewPanel(
    "topos.view",
    `View: ${filename}`,
    vscode.ViewColumn.Active,
    { enableScripts: true },
  );
  panel.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "topos-view.svg",
  );
  const viewer = new ViewerWebview(
    panel,
    (appearance) => renderToposDocument(text, fence, override, appearance),
  );
  snapshotTexts.set(panel, text);
  panel.onDidDispose(() => {
    snapshotTexts.delete(panel);
    viewer.dispose();
  });
}

async function openDocumentWith(source: ActiveToposSource, viewType: string): Promise<void> {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (isToposTabInput(input) && sameUri(input.uri, source.document.uri)) {
    await vscode.commands.executeCommand("reopenActiveEditorWith", viewType);
  } else {
    await vscode.commands.executeCommand("vscode.openWith", source.document.uri, viewType);
  }
}
