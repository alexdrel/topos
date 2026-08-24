import { boxWalk, Dir, type Loc } from "../geo.ts";
import type { MapAST, MapEdge, MapNode } from "../topos.ts";
import { ProjectionGrid } from "./projection-grid.ts";
import { type ProjectionResult, stackedBoxWalk } from "./ink.ts";

export function projectModelToGrid(ast: MapAST): ProjectionResult {
  const width = ast.root.w || 1;
  const height = ast.root.h || 1;
  const offsetX = -(ast.root.x || 0);
  const offsetY = -(ast.root.y || 0);
  const grid = new ProjectionGrid(width, height, offsetX, offsetY);

  paintNode(ast.root, grid);
  for (const edge of ast.edges) paintEdge(edge, grid);
  for (const node of ast.nodes.filter((node) => node.nodeType === "hub")) {
    grid.setText(node.x, node.y, node.glyph!);
    for (const label of node.rawLabels ?? []) grid.setText(label.x, label.y, label.text);
  }

  const lines = grid.project().lines;
  return { text: lines.join("\n"), lines, spans: [], width, height, offset: { x: offsetX, y: offsetY } };
}

export function renderToText(ast: MapAST): string {
  return projectModelToGrid(ast).text;
}

function paintNode(node: MapNode, grid: ProjectionGrid): void {
  if (node.nodeType === "hub") return;
  if (node.nodeType === "box") {
    const border = node.stack && node.stack.layers > 1 ? stackedBoxWalk(node.stack, node) : boxWalk(node);
    for (const loc of border) grid.addMask(loc.x, loc.y, loc.mask, node.style);
  }
  if (node.rawLabels) {
    for (const label of node.rawLabels) paintText(grid, label, label.text);
  } else if (node.label && node.nodeType !== "box") {
    paintText(grid, node, node.label);
  }
  if (node.nodeType === "inline") {
    const bracket = node.bracket || "[]";
    grid.setText(node.x, node.y, bracket[0]);
    if (node.label && !node.rawLabels?.length) grid.setText(node.x + 1, node.y, node.label);
    grid.setText(node.x + node.w - 1, node.y, bracket[1]);
  }
  for (const child of node.children) paintNode(child, grid);
}

function paintEdge(edge: MapEdge, grid: ProjectionGrid): void {
  for (let i = 0; i < edge.polyline.length - 1; i++) {
    const a = edge.polyline[i];
    const b = edge.polyline[i + 1];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let step = 0; step <= steps; step++) {
      const x = a.x + dx * step;
      const y = a.y + dy * step;
      let mask = (dx ? Dir.Horizontal : Dir.Vertical) as Dir;
      if (step === 0) mask &= ~(dx > 0 ? Dir.W : dx < 0 ? Dir.E : dy > 0 ? Dir.N : Dir.S);
      if (step === steps) mask &= ~(dx > 0 ? Dir.E : dx < 0 ? Dir.W : dy > 0 ? Dir.S : Dir.N);
      if (grid.getMask(x, y) === Dir.None) {
        if (i === 0 && step === 0) mask |= edge.source.dir || 0;
        if (i === edge.polyline.length - 2 && step === steps) mask |= edge.target.dir || 0;
      }
      grid.addMask(x, y, mask, edge.style);
    }
  }
  for (const [index, terminus] of [edge.source, edge.target].entries()) {
    if (terminus.glyph) {
      const point = index === 0 ? edge.polyline[0] : edge.polyline.at(-1)!;
      grid.setText(point.x, point.y, terminus.glyph);
    }
  }
  for (const label of edge.rawLabels ?? []) paintText(grid, label, label.text);
  if (!edge.rawLabels?.length && edge.label && edge.polyline.length) {
    const middle = edge.polyline[Math.floor(edge.polyline.length / 2)];
    grid.setText(middle.x, middle.y, edge.label);
  }
}

function paintText(grid: ProjectionGrid, origin: Loc, text: string): void {
  for (const [row, line] of text.split("\n").entries()) grid.setText(origin.x, origin.y + row, line);
}
