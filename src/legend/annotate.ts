import { Annotation, Edge, MapAST, Node, Terminus, Topos } from "../topos.ts";
import { spec } from "../grammar.ts";
import { mergeEidos, setAnnotation } from "./eidos.ts";
import { extractSigilClusters, fencedTextContent, isSigilOnly, stripSigils } from "../sigil.ts";
import { parseCodeText, parseLiteralText, parseText } from "./format.ts";
import type { Compound, Leaf, LegendRule, Selector, Unary } from "./parse.ts";
import { SYNTH_OPS, synthesizeEdges } from "./synthesize.ts";
import { boundingRect, Dir } from "../geo.ts";

export type Entity = Node | Edge;

export function annotateMap(mapAST: MapAST, rules: LegendRule[]): Topos {
  applyLabelsAndSigils(mapAST);
  applyRules(mapAST.root, rules);
  synthesizeEdges(mapAST, rules);
  formatText(mapAST);
  resolveLinkReferences(mapAST, rules);

  return { ...mapAST, parameters: {}, palette: {} };
}

export function annotateTitle(mapAST: Topos, title: string): void {
  const { root } = mapAST;
  root.text = title;
  root.segmentedText = parseText(title);
  if (!root.segmentedText) return;

  const content = boundingRect([...mapAST.nodes, ...mapAST.edges]) ?? root;
  const missingHeight = Math.max(0, 2 - Math.max(0, content.y - root.y));
  root.y -= missingHeight;
  root.h += missingHeight;
}

function resolveLinkReferences(mapAST: MapAST, rules: LegendRule[]): void {
  const hrefs = new Map<string, string>();
  for (const rule of rules) {
    const href = rule.annotation.properties?.href;
    if (!href) continue;
    for (const selector of rule.selectors) {
      if (!("op" in selector) && selector.kind === "id" && selector.value) hrefs.set(selector.value, href);
    }
  }

  const entities = [mapAST.root, ...mapAST.nodes, ...mapAST.edges] as Entity[];
  for (const entity of entities) {
    for (const line of entity.segmentedText ?? []) {
      for (const segment of line) {
        if (segment.linkRef) {
          const href = hrefs.get(segment.linkRef);
          if (href) segment.href = href;
        } else if (entity.properties?.href) {
          segment.href ??= entity.properties.href;
        }
      }
    }
  }
}

// ── Inline Sigils & Styling ───────────────────────────────────────────────────

export function applyLabelsAndSigils(mapAST: MapAST): void {
  const entities = [mapAST.root, ...mapAST.nodes, ...mapAST.edges] as Entity[];
  for (const entity of entities) {
    if (entity.rawLabels) {
      entity.text ??= entity.rawLabels.filter(({ text }) => !isSigilOnly(text)).map(({ text }) => stripSigils(text)).join(" ");
    }
    const eidos = entity.eidos ??= {};

    if (entity.style) {
      eidos.weight ??= entity.style.weight;
      eidos.corner ??= entity.style.corner;
    }

    if (isNode(entity) && entity.nodeType === "inline") {
      const corner = inlineCorner(entity.bracket);
      if (corner) eidos.corner ??= corner;
    }

    if (isEdge(entity)) {
      const isDisconnected = (term: Terminus) => !term.node && term.dir === Dir.None;

      /** Returns the marker for a terminus, or undefined if suppressed (hub at offset 0). */
      const terminusMarker = (term: Terminus) => {
        if (isDisconnected(term)) return "end-cap";
        if (term.node?.nodeType === "hub" && term.offset === 0) return undefined;
        return spec(term.glyph).marker ?? "arrow";
      };

      if (isDisconnected(entity.source) || entity.direction === "bi" || entity.source.glyph) {
        const marker = terminusMarker(entity.source);
        if (marker) eidos.tail ??= { marker };
      }
      if (isDisconnected(entity.target) || entity.direction === "uni" || entity.direction === "bi" || entity.target.glyph) {
        const marker = terminusMarker(entity.target);
        if (marker) eidos.head ??= { marker };
      }
    }

    if (isNode(entity) && entity.nodeType === "hub") {
      eidos.marker ??= spec(entity.glyph!).marker ?? "dot";
    }

    for (const seg of entity.rawLabels ?? []) {
      let txt = seg.text;
      if (isNode(entity) && entity.nodeType === "inline") {
        txt = txt.slice(1, -1);
      }
      for (const cluster of extractSigilClusters(txt)) {
        setAnnotation(entity, cluster);
      }
    }
  }
}

function inlineCorner(bracket: string | undefined) {
  if (bracket === "()") return "pill";
  if (bracket === "<>") return "rhombus";
  if (bracket === "{}") return "parallelogram";
  return undefined;
}

function formatText(mapAST: MapAST): void {
  const entities = [mapAST.root, ...mapAST.nodes, ...mapAST.edges] as Entity[];
  for (const entity of entities) {
    if (!entity.text) continue;
    let text = stripSigils(entity.text)!;
    if (isNode(entity) && entity.nodeType === "note") {
      const fenced = fencedTextContent(text);
      if (entity.eidos?.noteMode === undefined && fenced !== undefined) {
        (entity.eidos ??= {}).noteMode = "code";
        text = fenced;
      }
      const noteMode = entity.eidos?.noteMode ?? "prose";
      if (noteMode !== "prose") {
        entity.segmentedText = noteMode === "code" ? parseCodeText(text) : parseLiteralText(text);
        continue;
      }
    }
    entity.segmentedText = parseText(text);
  }
}

// ── Tree Walking ──────────────────────────────────────────────────────────────

function applyRules(node: Node, rules: LegendRule[]): void {
  for (const rule of rules) {
    if (ruleMatches(rule, node)) applyAnnotation(node, rule.annotation);
  }

  for (const child of node.children) applyRules(child, rules);
  for (const edge of node.edges) {
    for (const rule of rules) {
      if (ruleMatches(rule, edge)) applyAnnotation(edge, rule.annotation);
    }
  }
}

// ── Matching ──────────────────────────────────────────────────────────────────

function ruleMatches(rule: LegendRule, entity: Entity): boolean {
  return rule.selectors.some((sel) => matches(entity, sel));
}

export function matches(entity: Entity | undefined, sel: Selector): boolean {
  if (!entity) {
    return !("op" in sel) && !sel.bracket && (sel.kind === "any" || sel.kind === "unbound");
  }
  if ("op" in sel) {
    if (!("left" in sel)) {
      return matchesUnary(entity, sel);
    }
    return matchesCompound(entity, sel);
  }
  return matchesLeaf(entity, sel);
}

function matchesUnary(entity: Entity, sel: Unary): boolean {
  const { op, right } = sel;
  if (op === "^") {
    if (!isNode(entity)) return false;
    const childMatch = entity.children.some((child) => matches(child, right));
    const edgeMatch = entity.edges.some((edge) => matches(edge, right));
    return childMatch || edgeMatch;
  }
  return false;
}

function matchesLeaf(entity: Entity, sel: Leaf): boolean {
  if (sel.bracket && (!isNode(entity) || (entity.bracket !== sel.bracket && !matchesBracketHint(entity, sel.bracket)))) return false;

  switch (sel.kind) {
    case "any":
      return true;
    case "unbound":
      return false;
    case "root":
      return isNode(entity) && entity.nodeType === "root";
    case "label":
      if (entity.label === sel.value) return true;
      return (!!sel.bracket && isNode(entity)) ? matchesHubGlyph(entity, sel.value!) : false;
    case "id":
      return entity.id === sel.value;
    case "substring":
    case "startswith": {
      if (!entity.text) return false;
      const val = sel.value!.toLowerCase();
      const entityLabel = entity.text.toLowerCase();
      return sel.kind === "substring" ? entityLabel.includes(val) : entityLabel.startsWith(val);
    }
    case "class":
      return entity.classes?.includes(sel.value!) ?? false;
    default:
      return false;
  }
}

function matchesHubGlyph(node: Node, value: string): boolean {
  return node.nodeType === "hub" && (node.glyph === value || (!!node.glyph && spec(node.glyph).marker === value));
}

function matchesCompound(entity: Entity, sel: Compound): boolean {
  const { op, left, right } = sel;

  // Synthesis operators are handled exclusively by synthesizeEdges
  if (SYNTH_OPS.has(op)) return false;

  // Tree operators: entity must match right, ancestor(s) must match left
  if (op === ">" || op === ">>") {
    if (!matches(entity, right)) return false;
    const parent = entity.parent;
    if (!parent) return false;
    if (op === ">") return matches(parent, left);
    let cur: Node | undefined = parent;
    while (cur) {
      if (matches(cur, left)) return true;
      cur = cur.parent;
    }
    return false;
  }

  // Edge operators: entity must be an edge
  if (!isEdge(entity)) return false;
  const src = entity.source.node, tgt = entity.target.node;
  const fwd = matchesEndpoint(src, left) && matchesEndpoint(tgt, right);
  const rev = matchesEndpoint(src, right) && matchesEndpoint(tgt, left);

  if (op === "-") return fwd || rev;
  if (op === "->") return entity.direction === "uni" && fwd;
  if (op === "<-") return entity.direction === "uni" && rev;
  if (op === "<->") return entity.direction === "bi" && (fwd || rev);
  return entity.direction === "none" && (fwd || rev);
}

function matchesEndpoint(node: Node | undefined, sel: Selector): boolean {
  if (matches(node, sel)) return true;
  if (node?.parent && (node.isPort || node.isGridCell)) return matches(node.parent, sel);
  return false;
}

/** Bracket hint matches nodeType families, not the literal bracket field. */
function matchesBracketHint(node: Node, bracket: string): boolean {
  if (bracket === "[]") return node.nodeType === "box";
  if (bracket === "()") return node.nodeType === "note";
  if (bracket === "<>") return node.nodeType === "hub";
  if (bracket === "{}") return node.nodeType === "region";
  return false;
}

// ── Annotation Application ────────────────────────────────────────────────────

export function applyAnnotation(target: Entity, annotation: Annotation): void {
  const { classes, eidos, properties, reset, ...fields } = annotation;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      const k = key as keyof Annotation;
      // deno-lint-ignore no-explicit-any
      target[k] = value as any;
    }
  }

  if (classes?.length) {
    target.classes = [...new Set([...target.classes ?? [], ...classes])];
  }

  if (reset) target.eidos = undefined;
  target.eidos = mergeEidos(target.eidos, eidos);

  if (properties) Object.assign(target.properties ??= {}, properties);
}

// ── Type Guards ───────────────────────────────────────────────────────────────

function isNode(entity: Entity): entity is Node {
  return "nodeType" in entity;
}

function isEdge(entity: Entity): entity is Edge {
  return "direction" in entity;
}
