import * as vscode from "vscode";
import { EIDOS_PROPERTIES, EIDOS_VALUES, SCOPE_NAMES } from "#topos-core";

type Suggestion = {
  label: string;
  kind: vscode.CompletionItemKind;
  detail: string;
  sortText?: string;
  filterText?: string;
  suggestValue?: boolean;
};

const VALUES: Suggestion[] = Object.entries(EIDOS_VALUES).flatMap(([axis, values]) =>
  values.map((value) => ({ label: value, kind: vscode.CompletionItemKind.EnumMember, detail: axis, sortText: `1-${value}` }))
);

const SCOPES: Suggestion[] = SCOPE_NAMES.map((scope, index) => ({
  label: `${scope}=`,
  kind: vscode.CompletionItemKind.Property,
  detail: "Eidos scope",
  sortText: `0-${index}`,
  suggestValue: true,
}));

const PROPERTIES: Suggestion[] = Object.entries(EIDOS_PROPERTIES).flatMap(([axis, keys]) =>
  keys.map((key) => ({
    label: `${key}=`,
    kind: vscode.CompletionItemKind.Property,
    detail: `${axis} property`,
    sortText: `2-${key}`,
  }))
);

const SEMANTIC_TYPES: Suggestion[] = ["cloud", "database", "file", "folder"].map((type) => ({
  label: `@${type}`,
  kind: vscode.CompletionItemKind.TypeParameter,
  detail: "semantic type",
}));

const COMMON_SCOPES = SCOPES.filter(({ label }) => ["fill=", "stroke=", "label="].includes(label));
const COMMON_VALUES = VALUES.filter(({ label }) => ["soft", "strong", "bold", "double", "rounded", "pill", "center", "left", "middle", "top"].includes(label));

const ALL = [...VALUES, ...SCOPES, ...PROPERTIES, ...SEMANTIC_TYPES];

const LEGEND_HEADER = /^\s*:(map|legend)(?=\s|$)/;

// Partial annotation token at the cursor. Whitespace and commas begin a new
// token; '.' and '@' remain part of it so their dedicated contexts can win.
const TOKEN = /(?:^|[\s,])([.@]?[\w-]*)$/;

// Partial map-text selector at the cursor. Manual completion also works without
// a prefix.
const SELECTOR_PREFIX = /[\p{L}\p{N}_-]+$/u;

// Active key=value list at the cursor, preserving the key across comma-separated
// values and optional comma whitespace (`fill=blue, soft, `).
const ASSIGNMENT_VALUE = /(?:^|\s)([\w-]+) ?= ?([^\s,]*(?:, ?[^\s,]*)*)$/;

// Complete text candidates authored on map lines. One space, a single dash,
// and an ampersand may continue text; repeated spaces/dashes and diagram glyphs
// break it, preventing connected nodes from becoming one selector candidate.
const MAP_TEXT = /[\p{L}\p{N}_]+(?:[-'][\p{L}\p{N}_]+)*(?:(?:[ \t]|[ \t]&[ \t])[\p{L}\p{N}_]+(?:[-'][\p{L}\p{N}_]+)*)*/gu;

// Logical words inside one MAP_TEXT candidate. Used only to shorten long text
// to a valid `%first two words%` selector; it does not discover candidates.
const MAP_WORD = /[\p{L}\p{N}_]+(?:[-'][\p{L}\p{N}_]+)*/gu;

export function registerToposCompletions(): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider("topos", { provideCompletionItems }, " ", "@", "-", ",", "=");
}

function provideCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  _token: vscode.CancellationToken,
  context: vscode.CompletionContext,
): vscode.CompletionItem[] | vscode.CompletionList | undefined {
  if (!isLegendSection(document, position.line)) return undefined;

  const line = document.lineAt(position.line).text.slice(0, position.character);
  if (LEGEND_HEADER.test(line)) return undefined;
  if (line.trimStart().startsWith("/")) return undefined;

  const separator = line.indexOf(":");
  if (separator < 0) return selectorCompletions(document, position, line, context);

  const assignment = line.slice(separator + 1);
  if (assignment.includes("//") || hasOpenQuote(assignment)) return undefined;

  const value = ASSIGNMENT_VALUE.exec(assignment);
  if (value) {
    const [, key, values] = value;
    if (!SCOPE_NAMES.some((scope) => scope === key)) return undefined;
    const token = values.slice(values.lastIndexOf(",") + 1).trimStart();
    const range = new vscode.Range(position.translate(0, -token.length), position);
    return token === "" ? new vscode.CompletionList(completions(COMMON_VALUES, range), true) : completions(VALUES, range);
  }

  const match = TOKEN.exec(assignment);
  if (!match) return undefined;

  const token = match[1];
  const range = new vscode.Range(position.translate(0, -token.length), position);
  if (token.startsWith(".")) return undefined;
  if (token.startsWith("@")) return completions(SEMANTIC_TYPES, range);
  if (token === "" && context.triggerCharacter === ",") return undefined;
  if (token === "" && context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && context.triggerCharacter === " ") {
    return new vscode.CompletionList(completions(COMMON_SCOPES, range), true);
  }

  return completions(ALL, range);
}

function selectorCompletions(
  document: vscode.TextDocument,
  position: vscode.Position,
  line: string,
  context: vscode.CompletionContext,
): vscode.CompletionItem[] | undefined {
  if (line.includes("//") || hasOpenQuote(line)) return undefined;

  const match = SELECTOR_PREFIX.exec(line);
  if (!match && context.triggerKind !== vscode.CompletionTriggerKind.Invoke) return undefined;

  const texts = new Set<string>();
  for (let i = 0; i < document.lineCount; i++) {
    const mapLine = document.lineAt(i).text;
    if (/^:legend(?:\s|$)/.test(mapLine)) break;
    if (/^:map(?:\s|$)/.test(mapLine)) continue;
    for (const text of mapLine.matchAll(MAP_TEXT)) texts.add(text[0]);
  }

  const range = new vscode.Range(position.translate(0, -(match?.[0].length ?? 0)), position);
  const selectors = new Set([...texts].map(selectorText));
  return completions(
    [...selectors].map((selector) => ({
      label: selector,
      kind: vscode.CompletionItemKind.Text,
      detail: "map text",
      filterText: selector.replaceAll("%", ""),
      sortText: `${selector.startsWith("%") ? 1 : 0}-${selector}`,
    })),
    range,
  );
}

function selectorText(text: string): string {
  const words = [...text.matchAll(MAP_WORD)];
  if (words.length === 1) return text;
  const prefix = words.length === 2 ? text : text.slice(0, words[1].index! + words[1][0].length);
  return `%${prefix}%`;
}

function isLegendSection(document: vscode.TextDocument, line: number): boolean {
  for (let i = line; i >= 0; i--) {
    const section = LEGEND_HEADER.exec(document.lineAt(i).text)?.[1];
    if (section) return section === "legend";
  }
  return false;
}

function hasOpenQuote(text: string): boolean {
  let quotes = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"' && text[i - 1] !== "\\") quotes++;
  }
  return quotes % 2 !== 0;
}

function completions(suggestions: readonly Suggestion[], range: vscode.Range): vscode.CompletionItem[] {
  return suggestions.map((suggestion) => {
    const item = new vscode.CompletionItem(suggestion.label, suggestion.kind);
    item.detail = `Topos ${suggestion.detail}`;
    item.range = range;
    item.sortText = suggestion.sortText;
    item.filterText = suggestion.filterText;
    if (suggestion.suggestValue) item.command = { command: "editor.action.triggerSuggest", title: "Suggest Eidos values" };
    return item;
  });
}
