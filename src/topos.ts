/**
 * Topos File Coordinator
 * Owns the .topos file format and orchestrates the full parse → annotate pipeline.
 */

import { parseDiagramLines } from "./refine/refine.ts";
import type { ParseOptions } from "./refine/refine.ts";

import { parseLegendLines } from "./legend/parse.ts";
import { annotateMap, annotateTitle } from "./legend/annotate.ts";
import { parseHeaderTail } from "./sigil.ts";

export { type HeaderTail, parseHeaderTail } from "./sigil.ts";

// ─── Exported Parser Types (Consolidated) ────────────────────────────────────

export * from "./trace/types.ts";
export * from "./refine/types.ts";
export { activeEidosValues } from "./legend/eidos.ts";
export { EIDOS_PROPERTIES, EIDOS_PROPERTY_TO_AXIS, EIDOS_VALUES, isEidosPropertyKey, SCOPE_NAMES } from "./eidos.ts";
export type { EidosPropertyAxis, EidosPropertyKey, EidosValue } from "./eidos.ts";

import type { MapEdge, MapNode, MapTerminus } from "./refine/types.ts";
import type { EidosMap, EidosPropertyKey } from "./eidos.ts";

export interface FormattedSegment {
  text: string;
  href?: string;
  linkRef?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  paragraph?: boolean;
}

export type FormattedLine = FormattedSegment[];
export type Palette = Record<string, string>;
export type StringParameters = Record<string, string | undefined>;

// ─── Annotation Mixin ────────────────────────────────────────────────────────

export interface Annotation {
  text?: string;
  id?: string;
  semanticType?: string;
  classes?: string[];
  eidos?: EidosMap;
  properties?: Partial<Record<EidosPropertyKey, string>>;
  reset?: boolean;
}

// ─── Annotated Node ──────────────────────────────────────────────────────────
export type Annotated = Annotation & { segmentedText?: FormattedLine[] };

/** Annotated node — parser geometry + legend enrichment. */
export interface Node extends MapNode, Annotated {
  parent?: Node;
  children: Node[];
  edges: Edge[];
  links: Edge[];
}

/** Annotated edge — parser geometry + legend enrichment. */
export interface Edge extends MapEdge, Annotated {
  source: Terminus;
  target: Terminus;
}

export interface Terminus extends MapTerminus {
  node?: Node;
}

// ─── Annotated Diagram ──────────────────────────────────────────────────────

/** Fully annotated diagram — what Enamel consumes. */
export interface Topos {
  root: Node;
  nodes: Node[];
  edges: Edge[];
  parameters: StringParameters;
  palette: Palette;
}

// ─── Pipeline Coordinator ─────────────────────────────────────────────────────
export interface ToposSection {
  /** Exact header line. Empty for an implicit map. */
  header: string;
  /** Exact content lines up to the next recognized section. */
  content: string[];
}

/** Read-only view of the two ordered sections in a Topos source. */
export interface ToposSections {
  map: ToposSection;
  legend?: ToposSection;
  title?: string;
  parameters: StringParameters;
}

export function splitToposFile(text: string): ToposSections {
  return splitToposLines(text.split("\n"));
}

export function splitToposLines(lines: string[]): ToposSections {
  const hasMapHeader = /^:map(?:\s|$)/.test(lines[0] ?? "");
  const mapHeader = hasMapHeader ? lines[0] : "";
  const contentStart = hasMapHeader ? 1 : 0;
  const legendIndex = lines.findIndex((line, index) => index >= contentStart && /^:legend(?:\s|$)/.test(line));
  const map = { header: mapHeader, content: lines.slice(contentStart, legendIndex < 0 ? undefined : legendIndex) };
  const legend = legendIndex < 0 ? undefined : { header: lines[legendIndex], content: lines.slice(legendIndex + 1) };

  const mapTail = parseToposSectionHeader(map.header);
  const legendTail = legend ? parseToposSectionHeader(legend.header) : undefined;
  return {
    map,
    legend,
    title: legendTail?.title ?? mapTail.title,
    parameters: { ...mapTail.parameters, ...legendTail?.parameters },
  };
}

export function parseToposSectionHeader(header: string) {
  const tail = header.trimEnd().replace(/^:(?:map|legend)\s*/, "");
  return parseHeaderTail(tail);
}

/** Full pipeline: parse a multi-section .topos file directly into an annotated Diagram. */
export function parseTopos(text: string, options?: ParseOptions): Topos {
  const { map, legend, title, parameters } = splitToposLines(text.split(/\r?\n/));
  return parseToposParts(map.content, legend?.content ?? [], options, { title, parameters });
}

export function parseToposParts(
  mapLines: string[],
  legendLines: string[],
  options?: ParseOptions,
  header: { title?: string; parameters?: StringParameters } = {},
): Topos {
  const parsed = parseDiagramLines(mapLines, options);
  const { rules, palette } = parseLegendLines(legendLines);
  const annotated = annotateMap(parsed, rules);
  annotated.parameters = { ...header.parameters };
  annotated.palette = palette;
  if (header.title !== undefined) annotateTitle(annotated, header.title);
  return annotated;
}
