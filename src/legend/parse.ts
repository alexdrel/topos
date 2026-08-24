import type { Annotation, Palette } from "../topos.ts";
import { EIDOS_VALUES } from "../eidos.ts";
import { applyAssignmentToken, applyBareToken, setAnnotation } from "./eidos.ts";

// ── AST Types ─────────────────────────────────────────────────────────────────

export interface Leaf {
  kind: "any" | "unbound" | "root" | "class" | "label" | "id" | "substring" | "startswith";
  value?: string;
  bracket?: string; // "[]" | "()" | "<>" | "{}" — hint for node disambiguation
}

export interface Compound {
  op: ">" | ">>" | "->" | "<-" | "--" | "<->" | "-" | "~>" | "<~" | "~~" | "<~>";
  left: Selector;
  right: Selector;
}

export interface Unary {
  op: "^";
  right: Selector;
}

export type Selector = Leaf | Compound | Unary;

export interface LegendRule {
  selectors: Selector[];
  annotation: Annotation;
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

// Order matters: structural tokens are consumed from the head before falling
// back to bare text. Longer edge operators precede '-', while a dash inside a
// bare token such as A-B is consumed with the surrounding text.
const SELECTOR_OPERATOR = /^(?:>>|<~>|<~|~>|~~|<->|<-|->|--|-|\^|[>,])/;
const SELECTOR_BRACKET = /^(?:\[[^\]]*\]|\([^)]*\)|<[^>]*>|\{[^}]*\})/;
const SELECTOR_PATTERN = /^(?:\*|%[^%]*%|"[^"]*")/;
const SELECTOR_LABEL = /^(?:(?!->|--|~>|~~|-\*)[^\s,><:[\]()\"{}+^])+/;

const ANNOTATION_TOKEN = /^(?: ?= ?|, ?|\s+|"[^"]*"|[^\s,=]+)/;
const ANNOTATION_KEY = /^[\w-]+$/;
const PALETTE_SELECTOR = /^\/([\w-]+)$/;

type TokenizedLine =
  | { kind: "rule"; selector: string[]; annotation: string[] }
  | { kind: "palette"; name: string; value: string };

function tokenizeLine(line: string): TokenizedLine | undefined {
  const selector: string[] = [];
  const annotation: string[] = [];
  let tail = line;
  while (tail) {
    tail = tail.trimStart();
    if (tail.startsWith("//")) break;
    if (tail.startsWith(":")) {
      tail = tail.slice(1);
      break;
    }
    const match = SELECTOR_OPERATOR.exec(tail) ??
      SELECTOR_BRACKET.exec(tail) ??
      SELECTOR_PATTERN.exec(tail) ??
      SELECTOR_LABEL.exec(tail);
    if (!match) break;
    selector.push(match[0]);
    tail = tail.slice(match[0].length);
  }

  if (tail) {
    const palette = selector.length === 1 ? PALETTE_SELECTOR.exec(selector[0]) : undefined;
    if (palette) return { kind: "palette", name: palette[1], value: tail.split("//")[0].trim() };
    while (tail) {
      if (tail.startsWith("//")) break;
      const match = ANNOTATION_TOKEN.exec(tail);
      if (!match) break;
      annotation.push(match[0].trim() || " ");
      tail = tail.slice(match[0].length);
    }
  }
  return selector.length ? { kind: "rule", selector, annotation } : undefined;
}

// ── Top-Level Parser ──────────────────────────────────────────────────────────

export interface ParsedLegend {
  rules: LegendRule[];
  palette: Palette;
}

/** Parses entity annotation rules and `/color: paint` palette declarations. */
export function parseLegend(text: string): ParsedLegend {
  return parseLegendLines(text.split(/\r?\n/));
}

export function parseLegendLines(lines: string[]): ParsedLegend {
  const rules: LegendRule[] = [];
  const palette: Palette = {};
  const colors = new Set<string>(EIDOS_VALUES.color);

  for (const raw of lines) {
    const line = tokenizeLine(raw.trim());
    if (!line) continue;
    if (line.kind === "palette") {
      if (colors.has(line.name) && line.value) palette[line.name] = line.value;
      continue;
    }

    // Legend parsing is intentionally line-local and forgiving: malformed
    // lines are ignored so later legend rules can still be applied.
    try {
      rules.push(parseRuleLine(line));
    } catch {
      continue;
    }
  }

  return { rules, palette };
}

export function parseLegendBlock(text: string): LegendRule[] {
  return parseLegend(text).rules;
}

// ── Line Parsing ──────────────────────────────────────────────────────────────

function parseRuleLine({ selector, annotation }: Extract<TokenizedLine, { kind: "rule" }>): LegendRule {
  return {
    selectors: splitByToken(selector, ",").map(parseSelectorFromTokens),
    annotation: parseAnnotation(annotation),
  };
}

function parseSelectorFromTokens(tokens: string[]): Selector {
  if (tokens.length === 0) throw new Error("empty legend selector");

  // Tree operators: find >> then >
  for (const treeOp of [">>", ">"] as const) {
    const idx = tokens.indexOf(treeOp);
    if (idx !== -1) {
      return {
        op: treeOp,
        left: parseSelectorFromTokens(tokens.slice(0, idx)),
        right: parseSelectorFromTokens(tokens.slice(idx + 1)),
      };
    }
  }

  // Edge operators bind tighter: synthesis (~) and matching/annotation (-, ->, etc.) families
  for (const edgeOp of ["<~>", "<~", "~>", "~~", "<->", "<-", "->", "--", "-"] as const) {
    const idx = tokens.indexOf(edgeOp);
    if (idx !== -1) {
      return {
        op: edgeOp,
        left: parseSelectorFromTokens(tokens.slice(0, idx)),
        right: parseSelectorFromTokens(tokens.slice(idx + 1)),
      };
    }
  }

  // Unary operators prefix '^' bind tighter than tree and edge operators
  if (tokens[0] === "^") {
    return {
      op: "^",
      right: parseSelectorFromTokens(tokens.slice(1)),
    };
  }

  if (tokens.length === 1) {
    return parseLeaf(tokens[0]);
  }
  throw new Error(`unexpected selector tokens: ${tokens.join(" ")}`);
}

function parseLeaf(token: string): Leaf {
  if (token === "*") return { kind: "any" };
  if (token === "_") return { kind: "unbound" };
  if (token === "/") return { kind: "root" };
  if (token.startsWith("#")) return { kind: "id", value: token.slice(1) };
  if (token.startsWith(".")) return { kind: "class", value: token.slice(1) };

  // Bracketed: [Foo], (*), <*>, etc.
  const open = token[0], close = token[token.length - 1];
  const pair = `${open}${close}`;
  if (["[]", "()", "<>", "{}"].includes(pair) && token.length >= 2) {
    const inner = token.slice(1, -1).trim();
    if (inner === "*") return { kind: "any", bracket: pair };
    if (inner === "/") return { kind: "root" };

    return { ...parseTextMatch(inner), bracket: pair };
  }

  return parseTextMatch(token);
}

function parseTextMatch(text: string): Pick<Leaf, "kind" | "value"> {
  if (text.startsWith('"') && text.endsWith('"')) {
    return { kind: "label", value: unquote(text) };
  }
  if (text.startsWith("%") && text.endsWith("%") && text.length >= 2) {
    return { kind: "substring", value: text.slice(1, -1) };
  }
  if (text.endsWith("%") && !text.startsWith("%") && text.length >= 2) {
    return { kind: "startswith", value: text.slice(0, -1) };
  }
  return { kind: "label", value: text };
}

// ── Annotation Parsing ────────────────────────────────────────────────────────

function parseAnnotation(tokens: string[]): Annotation {
  const annotation: Annotation = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === " " || token === "," || token === "=") continue;

    if (ANNOTATION_KEY.test(token) && tokens[i + 1] === "=") {
      const values = [""];
      let valueIndex = i + 2;
      while (tokens[valueIndex]?.trim()) {
        const value = tokens[valueIndex++];
        if (value === ",") values.push("");
        else values[values.length - 1] = unquote(value);
      }
      if (valueIndex > i + 2) i = valueIndex - 1;
      applyAssignmentToken(annotation, token, values);
      continue;
    }

    if (token === "reset") {
      annotation.reset = true;
      continue;
    }

    if (token.startsWith('"') && token.endsWith('"')) {
      annotation.text = unquote(token);
    } else if (token.startsWith("#") || token.startsWith("@") || token.startsWith(".")) {
      setAnnotation(annotation, token);
    } else {
      applyBareToken(annotation, token);
    }
  }
  return annotation;
}

function unquote(token: string): string {
  return token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token;
}

function splitByToken(tokens: string[], sep: string): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const t of tokens) {
    if (t === sep) {
      if (current.length) groups.push(current);
      current = [];
    } else current.push(t);
  }
  if (current.length) groups.push(current);
  return groups;
}
