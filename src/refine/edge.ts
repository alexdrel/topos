import { borders, compareByArea, contains, Dir, Direction, eqLoc, moveCursor, Point } from "../geo.ts";
import { spec, Trait } from "../grammar.ts";
import { MapEdge, MapNode, MapTerminus } from "./types.ts";

export function resolveEdges(edges: MapEdge[], nodes: MapNode[]): void {
  for (const edge of edges) resolveEdge(edge, nodes, edges);
  for (const edge of edges) resolveSplitStems(edge);
  for (const edge of edges) {
    addLink(edge, edge.source.node);
    addLink(edge, edge.target.node);
  }
}

function resolveEdge(edge: MapEdge, nodes: MapNode[], edges: MapEdge[]): void {
  const { polyline, source, target } = edge;
  if (!polyline.length) return;

  const resolve = (pt: Point, term: MapTerminus) => {
    const trait = spec(term.glyph).trait;
    const dst = findNodeAt(pt, term.dir, nodes);

    if (dst) Object.assign(term, dst);
    else if (term.dir === Dir.None) {
      term.stem = findStem(pt, edge, edges);
    }

    return !!(trait & Trait.Arrow);
  };

  const headS = resolve(polyline[0], source);
  const tailS = resolve(polyline.at(-1)!, target);

  if (headS && tailS) {
    edge.direction = "bi";
  } else if (headS || tailS) {
    edge.direction = "uni";
    if (headS) {
      [edge.source, edge.target] = [edge.target, edge.source];
      edge.polyline.reverse();
    }
  } else {
    edge.direction = "none";
  }
}

function findStem(pt: Point, me: MapEdge, edges: MapEdge[]): MapEdge | undefined {
  return edges.find((e) =>
    e !== me && e.polyline.some((p, idx) => {
      if (!eqLoc(p, pt)) return false;

      // A concrete terminus direction continues the edge beyond its stored
      // polyline endpoint. Such a point is therefore part of the stem interior,
      // just like any point between the first and last polyline locations.
      const last = e.polyline.length - 1;
      return (idx > 0 && idx < last) ||
        (idx === 0 && e.source.dir !== Dir.None) ||
        (idx === last && e.target.dir !== Dir.None);
    })
  );
}

function findNodeAt(pt: Point, dir: Direction, nodes: MapNode[]): { node: MapNode; offset: number } | undefined {
  const maxOffset = dir === Dir.None ? 0 : 4;
  for (let i = 0; i <= maxOffset; i++) {
    const node = nodes.filter((n) => borders(n, moveCursor(pt, dir, i))).sort(compareByArea)[0];
    if (node) {
      // we were inside the found box and not on border
      if (i > 0 && contains(node, pt, false)) break;
      return { node, offset: i };
    }
  }
  return undefined;
}

function resolveSplitStems(edge: MapEdge): void {
  if (edge.source.stem) edge.source.node = edge.source.stem.source.node;
  if (edge.target.stem) edge.target.node = edge.target.stem.target.node;
}

function addLink(edge: MapEdge, node?: MapNode): void {
  if (!node) return;
  if (!node.links.includes(edge)) node.links.push(edge);
  edge.nodes.push(node);
}
