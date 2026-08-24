import { Edge, MapAST, Node } from "../topos.ts";
import { Dir } from "../geo.ts";
import { applyAnnotation, matches } from "./annotate.ts";
import type { Compound, LegendRule } from "./parse.ts";
import type { EidosMap } from "../eidos.ts";

export type SynthOp = "~>" | "<~" | "~~" | "<~>";
export const SYNTH_OPS = new Set<string>(["~>", "<~", "~~", "<~>"]);

export function synthesizeEdges(topos: MapAST, rules: LegendRule[]): void {
  for (const rule of rules) {
    for (const sel of rule.selectors) {
      if (!("op" in sel) || !("left" in sel)) continue;
      const compound = sel as Compound;
      if (!SYNTH_OPS.has(compound.op)) continue;

      const op = compound.op as SynthOp;
      const { left, right } = compound;

      for (const src of topos.nodes) {
        if (!matches(src, left)) continue;
        for (const tgt of topos.nodes) {
          if (src === tgt) continue;
          if (!matches(tgt, right)) continue;

          const parent = commonParent(src, tgt);
          const edge = createAbstractEdge(op, src, tgt, parent);
          applyAnnotation(edge, rule.annotation);
          topos.edges.push(edge);
          src.links.push(edge);
          tgt.links.push(edge);
          parent.edges.push(edge);
        }
      }
    }
  }
}

function createAbstractEdge(op: SynthOp, srcMatch: Node, tgtMatch: Node, parent: Node): Edge {
  const direction: Edge["direction"] = op === "~~" ? "none" : op === "<~>" ? "bi" : "uni";
  const [source, target] = op === "<~" ? [tgtMatch, srcMatch] : [srcMatch, tgtMatch];
  const eidos: EidosMap = {};
  eidos.edgeRoute = "ray";
  if (direction === "uni" || direction === "bi") eidos.head = { marker: "arrow" };
  if (direction === "bi") eidos.tail = { marker: "arrow" };

  return {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    polyline: [],
    nodes: [source, target],
    parent,
    source: { node: source, dir: Dir.None, glyph: "" },
    target: { node: target, dir: Dir.None, glyph: "" },
    direction,
    eidos,
  };
}

function commonParent(a: Node, b: Node): Node {
  const ancestors = new Set<Node>();
  let curr: Node | undefined = a;
  while (curr) {
    ancestors.add(curr);
    curr = curr.parent;
  }
  curr = b;
  while (curr) {
    if (ancestors.has(curr)) return curr;
    curr = curr.parent;
  }
  return a;
}
