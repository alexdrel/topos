import * as vscode from "vscode";

import { activeSnapshotText, editSource, openTextInSlate, viewSource } from "./actions.ts";
import { cliLauncherPath } from "./cli-launcher.ts";
import { exportDiagram } from "./export.ts";
import { ToposPreview } from "./preview.ts";
import { type ActiveToposSource, findToposSelection, findToposSource, showNoSource } from "./source.ts";

const GUIDE_SCHEME = "topos-guide";
const GUIDE_URI = vscode.Uri.from({
  scheme: GUIDE_SCHEME,
  path: "/Topos Guide.md",
});

let trackingPreview: ToposPreview | undefined;

export function registerToposCommands(
  context: vscode.ExtensionContext,
): vscode.Disposable[] {
  return [
    vscode.workspace.registerTextDocumentContentProvider(GUIDE_SCHEME, {
      provideTextDocumentContent: () => readGuide(context.extensionUri),
    }),
    vscode.commands.registerCommand(
      "topos.newDiagram",
      () => newToposDiagram(),
    ),
    vscode.commands.registerCommand(
      "topos.openGuide",
      () => openGuide(),
    ),
    vscode.commands.registerCommand(
      "topos.copyCodingAgentInstructions",
      () => copyCodingAgentInstructions(context),
    ),
    vscode.commands.registerCommand(
      "topos.openPreviewToSide",
      () => openPreviewToSide(context.extensionUri),
    ),
    vscode.commands.registerCommand(
      "topos.export",
      () => exportCurrent(context.extensionUri),
    ),
    vscode.commands.registerCommand(
      "topos.edit",
      () => {
        const text = activeSnapshotText();
        return text === undefined ? editSource(getCurrentSource()) : openTextInSlate(text);
      },
    ),
    vscode.commands.registerCommand(
      "topos.view",
      () => viewSource(context, getCurrentViewSource()),
    ),
    vscode.commands.registerCommand(
      "topos.reopenAsView",
      () => reopenActiveAsView(),
    ),
    vscode.commands.registerCommand(
      "topos.reopenAsEditor",
      () => reopenActiveAsEditor(),
    ),
    vscode.commands.registerCommand(
      "topos.reopenAsText",
      () => reopenActiveAsText(),
    ),
  ];
}

async function readGuide(extensionUri: vscode.Uri): Promise<string> {
  return await readExtensionText(extensionUri, "docs", "Topos Guide.md");
}

async function readExtensionText(
  extensionUri: vscode.Uri,
  ...path: string[]
): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(
    vscode.Uri.joinPath(extensionUri, ...path),
  );
  return new TextDecoder().decode(bytes);
}

async function copyCodingAgentInstructions(
  context: vscode.ExtensionContext,
): Promise<void> {
  const template = await readExtensionText(
    context.extensionUri,
    "docs",
    "Coding Agent Instructions.md",
  );
  const instructions = template
    .replaceAll(
      "{{TOPOS_CLI}}",
      cliLauncherPath(context.globalStorageUri.fsPath),
    )
    .replaceAll(
      "{{TOPOS_GUIDE}}",
      vscode.Uri.joinPath(context.extensionUri, "docs", "Topos Guide.md")
        .fsPath,
    );
  await vscode.env.clipboard.writeText(instructions);
  await vscode.window.showInformationMessage(
    "Topos coding-agent instructions copied to the clipboard.",
  );
}

async function openGuide(): Promise<void> {
  const document = await vscode.workspace.openTextDocument(GUIDE_URI);
  await vscode.window.showTextDocument(document, {
    preview: false,
    viewColumn: vscode.ViewColumn.Active,
  });
  await vscode.commands.executeCommand("markdown.showPreviewToSide");
}

async function newToposDiagram(): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "topos",
    content: "",
  });
  await vscode.commands.executeCommand(
    "vscode.openWith",
    document.uri,
    "topos.editor",
    vscode.ViewColumn.Active,
  );
}

function openPreviewToSide(extensionUri: vscode.Uri): void {
  const source = findToposSource();
  if (!source) {
    void vscode.window.showInformationMessage(
      "Open a Topos document or place the cursor in a Topos fence.",
    );
    return;
  }

  if (trackingPreview) {
    trackingPreview.show(source);
    return;
  }

  trackingPreview = new ToposPreview(source, extensionUri);
  trackingPreview.onDispose(() => trackingPreview = undefined);
}

function exportCurrent(extensionUri: vscode.Uri): void {
  const source = getCurrentSource();
  if (!source) return showNoSource();
  void exportDiagram(source, extensionUri);
}

function getCurrentSource(): ActiveToposSource | undefined {
  return findToposSource() ?? findToposSelection();
}

function getCurrentViewSource(): ActiveToposSource | undefined {
  return findToposSelection() ?? findToposSource();
}

function reopenActiveAsText(): void {
  void vscode.commands.executeCommand("reopenActiveEditorWith", "default");
}

function reopenActiveAsView(): void {
  void vscode.commands.executeCommand("reopenActiveEditorWith", "topos.viewer");
}

function reopenActiveAsEditor(): void {
  void vscode.commands.executeCommand("reopenActiveEditorWith", "topos.editor");
}
