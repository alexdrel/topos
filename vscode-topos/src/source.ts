import * as vscode from "vscode";
import type { StringParameters } from "#topos-core";
import { parseToposFenceInfo } from "./markdown.ts";
import { sameUri } from "./util.ts";

interface ToposSourceBase {
  document: vscode.TextDocument;
  range: vscode.Range;
  text: string;
  fence: StringParameters;
  override: boolean;
}

export type ActiveToposSource =
  | (ToposSourceBase & { kind: "document" })
  | (ToposSourceBase & { kind: "fence" })
  | (ToposSourceBase & { kind: "selection" });

const FENCE_LINE_PATTERN = /^\s*(`{3,}|~{3,})(.*)$/;
const activeDocumentEmitter = new vscode.EventEmitter<vscode.TextDocument>();

export const onDidActivateToposDocument = activeDocumentEmitter.event;

export function notifyToposDocumentActivated(document: vscode.TextDocument): void {
  activeDocumentEmitter.fire(document);
}

export function findToposSource(): ActiveToposSource | undefined {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (input instanceof vscode.TabInputCustom) {
    const document = findToposDocument(input.uri);
    if (document) return documentSource(document);
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const { document, selection } = editor;

  if (isToposDocument(document)) return documentSource(document);

  if (document.languageId === "markdown") {
    const range = findFencedBlockRange(document, selection.active.line);
    if (range) return fenceSource(document, range);
  }

  return undefined;
}

export function findToposSelection(): ActiveToposSource | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return undefined;
  return selectionSource(editor.document, new vscode.Range(editor.selection.start, editor.selection.end));
}

export function findToposDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find((candidate) => sameUri(candidate.uri, uri) && isToposDocument(candidate));
}

export function isToposTabInput(input: unknown): input is vscode.TabInputCustom | vscode.TabInputText {
  if (input instanceof vscode.TabInputCustom) {
    return input.viewType === "topos.editor" || input.viewType === "topos.viewer";
  }
  return input instanceof vscode.TabInputText && findToposDocument(input.uri) !== undefined;
}

export function showNoSource(): void {
  void vscode.window.showInformationMessage(
    "Open a Topos document or fence, or select an ASCII diagram.",
  );
}

export function wholeDocumentRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = document.lineCount - 1;
  return new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).text.length);
}

export function documentSource(document: vscode.TextDocument): ActiveToposSource {
  const range = wholeDocumentRange(document);
  return { kind: "document", document, range, text: document.getText(), fence: {}, override: false };
}

function fenceSource(document: vscode.TextDocument, range: vscode.Range): ActiveToposSource {
  const fence = fenceInfoForContentRange(document, range);
  return {
    kind: "fence",
    document,
    range,
    text: document.getText(range),
    fence: fence ? { ...fence.parameters, title: fence.title } : {},
    override: fence?.override ?? false,
  };
}

function selectionSource(document: vscode.TextDocument, range: vscode.Range): ActiveToposSource {
  const selected = document.getText(range);
  const text = markdownFenceContent(selected) ?? selected;
  const opening = parseFenceLine(selected.split(/\r?\n/, 1)[0]);
  const fence = opening ? parseToposFenceInfo(opening.info) : undefined;
  return {
    kind: "selection",
    document,
    range,
    text,
    fence: fence ? { ...fence.parameters, title: fence.title } : {},
    override: fence?.override ?? false,
  };
}

function markdownFenceContent(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const opening = parseFenceLine(lines[0] ?? "");
  const closing = parseFenceLine(lines.at(-1) ?? "");
  if (
    !opening || !closing || closing.info ||
    closing.marker[0] !== opening.marker[0] ||
    closing.marker.length < opening.marker.length
  ) return undefined;
  return lines.slice(1, -1).join("\n");
}

function isToposDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "topos" || document.uri.path.toLowerCase().endsWith(".topos");
}

function fenceInfoForContentRange(document: vscode.TextDocument, range: vscode.Range) {
  if (range.start.line === 0) return undefined;
  const opening = parseFenceLine(document.lineAt(range.start.line - 1).text);
  return opening ? parseToposFenceInfo(opening.info) : undefined;
}

function parseFenceLine(text: string): { marker: string; info: string } | undefined {
  const match = text.match(FENCE_LINE_PATTERN);
  if (!match) return undefined;
  return { marker: match[1], info: match[2].trim() };
}

function findFencedBlockRange(document: vscode.TextDocument, cursorLine: number): vscode.Range | undefined {
  let opening: { line: number; marker: string; info: string } | undefined;
  for (let i = 0; i < document.lineCount; i++) {
    const fence = parseFenceLine(document.lineAt(i).text);
    if (!fence) continue;
    if (!opening) {
      opening = { line: i, ...fence };
      continue;
    }
    if (fence.info || fence.marker[0] !== opening.marker[0] || fence.marker.length < opening.marker.length) continue;
    if (cursorLine >= opening.line && cursorLine < i) {
      const accepted = !opening.info || !!parseToposFenceInfo(opening.info);
      if (i <= opening.line + 1 || !accepted) return undefined;
      const firstContentLine = opening.line + 1;
      const lastContentLine = i - 1;
      return new vscode.Range(firstContentLine, 0, lastContentLine, document.lineAt(lastContentLine).text.length);
    }
    opening = undefined;
  }
  return undefined;
}
