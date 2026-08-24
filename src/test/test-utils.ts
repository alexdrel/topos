import { assert, assertEquals, assertObjectMatch } from "@std/assert";
import { renderToText } from "../ink/ast-ink.ts";
import { Edge, MapAST, MapLabel, Node, Terminus, TraceKind } from "../topos.ts";
import { parseDiagram, ParseOptions } from "../refine/refine.ts";
import { captureFailedCase } from "./failure-capture.ts";
import { traceMap } from "../trace/trace-map.ts";

export { flushPendingWrites, testCompleted } from "./failure-capture.ts";

export function testParseDiagram(context: Deno.TestContext, text: string, options: ParseOptions = {}) {
  captureFailedCase(text, context);
  return parseDiagram(text, options);
}

export function testTraceMap(context: Deno.TestContext, text: string, filterOut: TraceKind[] = ["label", "terminus"]) {
  captureFailedCase(text, context);
  const traces = traceMap(text).traces;
  return traces.filter((x) => !filterOut.includes(x.type));
}

export type DeepPartial<T> = T extends object ? T extends Array<infer U> ? Array<DeepPartial<U>>
  : T extends Date ? T
  : {
    [P in keyof T]?: DeepPartial<T[P]>;
  }
  : T;

type NodeMatchPattern = DeepPartial<Node> & {
  $children?: number;
  $edges?: number;
  $links?: number;
  $rawLabels?: number;
};

function assertNodeMatch(node: Node, pat: NodeMatchPattern): void {
  const {
    $children: $childrenCount,
    $edges: $edgeCount,
    $links: $linkCount,
    $rawLabels: $labelCount,
    ...nodePattern
  } = pat;

  // Exclude circular properties before matching to avoid RangeErrors
  delete (nodePattern as Record<string, unknown>).parent;
  delete (nodePattern as Record<string, unknown>).children;
  delete (nodePattern as Record<string, unknown>).links;
  delete (nodePattern as Record<string, unknown>).edges;

  assertObjectMatch(node, nodePattern);
  if ($childrenCount !== undefined) {
    assertEquals(node.children.length, $childrenCount, `CHILDREN COUNT MISMATCH`);
  }
  if ($edgeCount !== undefined) {
    const edgeCount = node.edges.length;
    assertEquals(edgeCount, $edgeCount, `EDGE COUNT (CONTAINMENT) MISMATCH`);
  }
  if ($linkCount !== undefined) {
    const linkCount = node.links.length;
    assertEquals(linkCount, $linkCount, `LINK COUNT (CONNECTIVITY) MISMATCH`);
  }
  if ($labelCount !== undefined) {
    const labelCount = node.rawLabels?.length || 0;
    assertEquals(labelCount, $labelCount, `LABEL SEGMENT COUNT MISMATCH`);
  }
}

export function matchNode(node: Node, pat: NodeMatchPattern): Node {
  assertNodeMatch(node, pat);
  return node;
}

export function matchChild(
  node: Node,
  pat: NodeMatchPattern,
  ndx: number | null | ((child: Node, i: number) => boolean) = null,
  totalChildren: number | null = null,
): Node {
  assert(node.children.length > 0, "no children found in node");
  if (totalChildren !== null) {
    assert(
      node.children.length === totalChildren,
      `expected ${totalChildren} children, got ${node.children.length}`,
    );
  }
  let child: Node | undefined;
  if (ndx === null) {
    assert(node.children.length === 1, `expected 1 child, got ${node.children.length}`);
    child = node.children[0];
  } else if (typeof ndx === "function") {
    const idx = node.children.findIndex(ndx);
    assert(idx !== -1, "No child node matches the predicate");
    child = node.children[idx];
  } else {
    assert(node.children.length > ndx, `expected child index ${ndx}, got ${node.children.length} children`);
    child = node.children[ndx];
  }
  assertNodeMatch(child, pat);
  return child;
}

type TerminusMatch = Node | string | DeepPartial<Terminus>;

export function matchEdge(
  root: Node,
  pat: Omit<DeepPartial<Edge>, "source" | "target"> & { source?: TerminusMatch; target?: TerminusMatch },
  ndx: number | null | ((edge: Edge) => boolean) = null,
  totalEdges: number | null = null,
): Edge {
  assert(root.edges && root.edges.length > 0, "no edges found in root");
  if (totalEdges !== null) {
    assert(
      root.edges.length === totalEdges,
      `expected ${totalEdges} edges, got ${root.edges.length}`,
    );
  }

  let edge: Edge | undefined;
  if (ndx === null) {
    assert(root.edges.length === 1, `expected 1 edge, got ${root.edges.length}`);
    edge = root.edges[0];
  } else if (typeof ndx === "function") {
    const idx = root.edges.findIndex(ndx);
    assert(idx !== -1, "No edge matches the predicate");
    edge = root.edges[idx];
  } else {
    assert(root.edges.length > ndx, `expected edge index ${ndx}, got ${root.edges.length} edges`);
    edge = root.edges[ndx];
  }

  const { source, target, ...rest } = pat;
  assertObjectMatch(edge, rest);

  const assertTermMatch = (term: Terminus, tpat: TerminusMatch) => {
    if (typeof tpat === "string") {
      assertEquals(term.node?.label, tpat, "TERMINUS LABEL MISMATCH");
    } else if (tpat instanceof Object && "nodeType" in tpat) {
      assert(term.node === tpat, "TERMINUS NODE OBJECT MISMATCH");
    } else {
      assertObjectMatch(term, tpat, "TERMINUS OBJECT MISMATCH");
    }
  };

  if (source) assertTermMatch(edge.source, source);
  if (target) assertTermMatch(edge.target, target);

  return edge;
}

export function findLabel(node: Node, text: string): MapLabel {
  const found = (node.rawLabels || []).find((l: MapLabel) => l.text === text);
  if (!found) throw new Error(`Label not found: ${text}`);
  return found;
}

export function matchDiagram(mapAST: MapAST, expected: string, offset: Partial<Node> = { x: 0, y: 0 }): void {
  const result = renderToText(mapAST).trimEnd();
  assertEquals(result, expected.trimEnd());
  assertObjectMatch(mapAST.root, offset, `root offset mismatch`);
}
