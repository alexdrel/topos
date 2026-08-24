const SIGIL_TOKEN = String.raw`(?:[#@.][\w-]+)+`;

// Sigil cluster at string start or after whitespace.
// Examples: ".class", "#id.class", "@type .class #id", "#clustId@test.a.b"
const SIGIL_CLUSTER = new RegExp(String.raw`(?:^|\s)${SIGIL_TOKEN}(?=\s|$)`, "g");
const LEADING_SIGILS = new RegExp(String.raw`^\s*(?:${SIGIL_TOKEN}\s*)+`);
const TRAILING_SIGILS = new RegExp(String.raw`(?:\s+${SIGIL_TOKEN})+\s*$`);
const FENCE_RE = /^([`~])\1{2,}/;
const HEADER_TOKEN_PATTERN = /[\w-]+ ?= ?(?:"[^"]*"|\S+)|[\w-]+ ?=|"[^"]*"|\S+/g;

export interface HeaderTail {
  title?: string;
  parameters: Record<string, string>;
}

export interface Fence {
  char: string;
  length: number;
}

export function parseFence(line: string): Fence | undefined {
  const match = FENCE_RE.exec(line);
  return match ? { char: match[1], length: match[0].length } : undefined;
}

/** Parse a section header tail: an optional quoted title plus key=value pairs. */
export function parseHeaderTail(text: string): HeaderTail {
  return parseHeaderTokens(tokenizeHeaderTail(text));
}

function tokenizeHeaderTail(text: string): string[] {
  return text.match(HEADER_TOKEN_PATTERN) ?? [];
}

function parseHeaderTokens(tokens: string[]): HeaderTail {
  const result: HeaderTail = { parameters: {} };

  for (const token of tokens) {
    if (token.startsWith('"') && token.endsWith('"')) {
      result.title ??= token.slice(1, -1);
      continue;
    }

    const equals = token.indexOf("=");
    if (equals <= 0) continue;
    const key = token.slice(0, equals).trim();
    let value = token.slice(equals + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    result.parameters[key] = value;
  }

  return result;
}

export function fencedTextContent(text: string): string | undefined {
  const lines = text.split("\n");
  if (lines.length < 2) return undefined;
  const opener = parseFence(lines[0]);
  const closer = parseFence(lines.at(-1)!);
  if (!opener || !closer || closer.char !== opener.char || closer.length < opener.length) return undefined;
  lines[0] = lines[lines.length - 1] = "";
  return lines.join("\n");
}

/** Removes leading/trailing sigil clusters and title prefixes from text. */
export function stripSigils(text?: string): string | undefined {
  return text?.replace(/^##?\s+/, "").replace(LEADING_SIGILS, "").replace(TRAILING_SIGILS, "");
}

export function isSigilOnly(text: string): boolean {
  return stripSigils(text)!.trim() === "";
}

/** Returns all sigil clusters found in text, in source order, for semantic interpretation. */
export function extractSigilClusters(text: string): string[] {
  return (text.match(SIGIL_CLUSTER) ?? []).map((m) => m.trim());
}
