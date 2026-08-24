import { borders, boundingRect, compareByArea, contains, naturalOrder, simplifyPath } from "../geo.ts";
import { TextGrid } from "../trace/text-grid.ts";
import { isBordered, TraceBox } from "../trace/types.ts";
import { MapAST, MapEdge, MapLabel, MapNode, NodeType } from "./types.ts";
import { extractLabel, labelFromText, promoteLabels } from "./label.ts";
import { resolveEdges } from "./edge.ts";
import { resolveRegions } from "./region.ts";
import { traceMapLines, TraceMapOptions } from "../trace/trace-map.ts";

/**
 * Higher-level refinement that orchestrates the discovery and tree building of diagram entities.
 */
export function buildNodeTree(traces: TraceBox[], grid: TextGrid): MapAST {
  const root: MapNode = { x: 0, y: 0, w: grid.w, h: grid.h, nodeType: "root", children: [], edges: [], links: [] };

  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];

  // 1. Initial nodes and edge creation
  for (const t of traces) {
    if (isBordered(t) || t.type === "hub" || t.type === "text" || t.type === "inline") {
      nodes.push(traceToNode(t));
    } else if (t.type === "line") {
      edges.push(traceToEdge(t));
    }
  }

  // 2. Resolve (global): Connectivity resolution and link population
  resolveEdges(edges, nodes);

  // 3. Tree Assembly: Nest nodes into parents using spatial containment
  const containers = nodes.filter((n) => n.nodeType === "box" || n.nodeType === "inline").sort(compareByArea);
  for (const node of nodes) {
    const parent = containers.find((n) => n !== node && contains(n, node)) ?? root;
    parent.children.push(node);
    node.parent = parent;

    if (node.nodeType === "hub" && parent.nodeType === "box") {
      node.isPort = borders(parent, node);
    }
  }

  // 4. Edge Attachment: Distribute edges to their containing parents
  for (const edge of edges) {
    const parent = containers.find((n) => contains(n, edge)) ?? root;
    edge.parent = parent;
    parent.edges.push(edge);
  }

  // 5. Resolve region layout
  resolveRegions({ root, nodes, edges });
  const rootBounds = boundingRect([root, ...root.children]);
  if (rootBounds) Object.assign(root, rootBounds);

  // 6. Promote labels
  promoteLabels(root, nodes);

  // 7. sort children
  sortChildren(root);
  nodes.sort(naturalOrder);

  // 8. Path Simplification: Reduce to turn points only for the final AST.
  // We delay this until now because resolveEdges needs the full grid of points
  // to detect "Split Stems" and other connectivity patterns.
  for (const edge of edges) {
    edge.polyline = simplifyPath(edge.polyline);
  }

  return { root, nodes, edges };
}

function sortChildren(node: MapNode): void {
  node.children.sort(naturalOrder);
  for (const child of node.children) sortChildren(child);
}

function traceToNode(trace: TraceBox): MapNode {
  const { type, text, bracket } = trace;
  const isBox = isBordered(trace);
  const isHub = type === "hub";
  const node: MapNode = {
    x: trace.x,
    y: trace.y,
    w: trace.w,
    h: trace.h,
    nodeType: isBox ? "box" : type === "text" ? "note" : type as NodeType,
    style: trace.style,
    stack: trace.stack,
    children: [],
    edges: [],
    links: [],
  };

  if (type === "grid-cell") {
    node.isGridCell = true;
  }

  if (isBox || isHub) {
    node.rawLabels = trace.rawLabels as MapLabel[];
    node.label = extractLabel(node.rawLabels);
    if (isHub) node.glyph = trace.text;
  } else {
    let txt = text!;
    if (type === "inline") {
      txt = txt.slice(1, -1);
      node.bracket = bracket;
    } else if (type == "text") {
      node.header = trace.header;
    }
    node.text = txt;
    node.rawLabels = [trace as MapLabel];
    node.label = labelFromText(txt);
  }

  return node;
}

function traceToEdge(trace: TraceBox): MapEdge {
  const path = trace.path!;
  const edge: MapEdge = {
    x: trace.x,
    y: trace.y,
    w: trace.w,
    h: trace.h,
    polyline: [...path],
    style: trace.style,
    direction: "none", // to be determined later in resolveEdges
    source: { dir: trace.source?.dir!, glyph: trace.source?.text ?? "" },
    target: { dir: trace.target?.dir!, glyph: trace.target?.text ?? "" },
    nodes: [],
  };

  edge.rawLabels = trace.rawLabels as MapLabel[];
  edge.label = extractLabel(edge.rawLabels);

  return edge;
}

export function removeNode(node: MapNode, parent: MapNode, allNodes: MapNode[]): void {
  const idx = parent.children.indexOf(node);
  if (idx !== -1) parent.children.splice(idx, 1);
  const aidx = allNodes.indexOf(node);
  if (aidx !== -1) allNodes.splice(aidx, 1);
}

export interface ParseOptions extends TraceMapOptions {}

/**
 * Orchestrates parsing from text to the final resolved Diagram AST.
 */
export function parseDiagram(text: string, options: ParseOptions = {}) {
  return parseDiagramLines(text.split(/\r?\n/), options);
}

export function parseDiagramLines(lines: string[], options: ParseOptions = {}) {
  const { grid, traces, events } = traceMapLines(lines, options);

  const diagram = buildNodeTree(traces, grid);

  return { ...diagram, grid, traces, debug: { events } };
}
