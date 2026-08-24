import { boundingRect, boxWalk, contains, Dir, Direction, getDirection, Loc, opposite, Rect } from "../geo.ts";
import type { MapNode } from "../topos.ts";
import { ProjectionGrid, type ProjectionSpan } from "./projection-grid.ts";
import { getStackGeometry } from "../stacked-box.ts";
import { TraceBox, TraceMap } from "../trace/types.ts";
import { DEFAULT_PEN } from "../style.ts";

function stackJunctionMask(x: number, y: number, prev: Rect, cur: Rect, dx: number, dy: number): Dir {
  let mask = Dir.None;
  const junctionX = dx > 0 ? prev.x + prev.w - 1 : prev.x;
  const junctionY = dy > 0 ? prev.y + prev.h - 1 : prev.y;

  if (dy > 0 && y === cur.y && x === junctionX) mask |= Dir.N;
  if (dy < 0 && y === cur.y + cur.h - 1 && x === junctionX) mask |= Dir.S;
  if (dx > 0 && x === cur.x && y === junctionY) mask |= Dir.W;
  if (dx < 0 && x === cur.x + cur.w - 1 && y === junctionY) mask |= Dir.E;

  return mask;
}

/** Returns an array of final composite masks for every cell in a stacked box. */
export function stackedBoxWalk(stack: MapNode["stack"], rect: Rect): (Loc & { mask: Dir })[] {
  const { dx, dy } = stack!;
  const geo = getStackGeometry(rect, stack!);
  const result: (Loc & { mask: Dir })[] = [];

  for (let i = 0; i < geo.layers.length; i++) {
    const layer = geo.layers[i];
    const nextLayer = geo.layers[i + 1];

    for (const loc of boxWalk(layer)) {
      const { x, y } = loc;

      if (!layer.isFace && contains(nextLayer, loc)) {
        continue;
      }

      let mask: Dir = loc.mask;

      if (i > 0) {
        const prevLayer = geo.layers[i - 1];
        mask |= stackJunctionMask(x, y, prevLayer, layer, -dx, -dy);
      }

      result.push({ x, y, mask });
    }
  }

  return result;
}

export interface ProjectionResult {
  text: string;
  lines: string[];
  spans: ProjectionSpan[];
  width: number;
  height: number;
  offset: Loc;
}

export { PROJECTION_ROLES, type ProjectionSpan } from "./projection-grid.ts";

function paintBoxTrace(trace: TraceBox, grid: ProjectionGrid): void {
  const style = trace.style ?? DEFAULT_PEN;
  if (trace.stack && trace.stack.layers > 1) {
    for (const loc of stackedBoxWalk(trace.stack, trace)) {
      grid.addMask(loc.x, loc.y, loc.mask, style, "box");
    }
  } else {
    for (const loc of boxWalk(trace)) {
      grid.addMask(loc.x, loc.y, loc.mask, style, "box");
    }
  }
}

function paintLineTrace(trace: TraceBox, grid: ProjectionGrid): void {
  const path = trace.path || [];
  for (let i = 0; i < path.length; i++) {
    const loc = path[i];
    if (i === 0 && trace.source?.text) {
      grid.setText(loc.x, loc.y, trace.source.text, "glyph");
      continue;
    }
    if (i === path.length - 1 && trace.target?.text) {
      grid.setText(loc.x, loc.y, trace.target.text, "glyph");
      continue;
    }

    let mask = Dir.None;
    if (i > 0) mask |= getDirection(loc, path[i - 1]);
    if (i < path.length - 1) mask |= getDirection(loc, path[i + 1]);

    if (i === 0) {
      if (path.length >= 2) {
        const dir = trace.source?.recoilDir !== undefined && grid.getMask(loc.x, loc.y) !== Dir.None
          ? Dir.None
          : trace.source?.recoilDir ?? trace.source?.dir ?? opposite(getDirection(path[0], path[1]) as Direction);
        mask |= dir;
      }
    }
    if (i === path.length - 1) {
      if (path.length >= 2) {
        const dir = trace.target?.recoilDir !== undefined && grid.getMask(loc.x, loc.y) !== Dir.None
          ? Dir.None
          : trace.target?.recoilDir ?? trace.target?.dir ?? opposite(getDirection(path.at(-1)!, path.at(-2)!) as Direction);
        mask |= dir;
      }
    }

    if (mask !== Dir.None) grid.addMask(loc.x, loc.y, mask, trace.style, "line");
  }
}

function paintTextTrace(trace: TraceBox, grid: ProjectionGrid): void {
  const lines = (trace.text ?? "").split("\n");
  const role = trace.type === "inline" ? "inline" : trace.type === "text" || trace.type === "label" ? "text" : "glyph";
  for (let row = 0; row < lines.length; row++) {
    grid.setText(trace.x, trace.y + row, lines[row], role);
  }
}

export function projectTracesToGrid(traceMap: TraceMap): ProjectionResult {
  const rect = boundingRect([traceMap.grid, ...traceMap.traces])!;
  const w = rect.w || 1;
  const h = rect.h || 1;
  const offsetX = -rect.x;
  const offsetY = -rect.y;

  const grid = new ProjectionGrid(w, h, offsetX, offsetY);

  const gridCells = traceMap.traces.filter((t) => t.type === "grid-cell");
  const boxes = traceMap.traces.filter((t) => t.type === "box");
  const lines = traceMap.traces.filter((t) => t.type === "line");
  const texts = traceMap.traces.filter((t) => t.type === "text" || t.type === "label" || t.type === "hub" || t.type === "inline" || t.type === "terminus");

  for (const trace of gridCells) paintBoxTrace(trace, grid);
  for (const trace of boxes) paintBoxTrace(trace, grid);
  for (const trace of lines) paintLineTrace(trace, grid);
  for (const trace of texts) paintTextTrace(trace, grid);

  const { lines: rows, spans } = grid.project();
  return {
    text: rows.join("\n"),
    lines: rows,
    spans,
    width: w,
    height: h,
    offset: { x: offsetX, y: offsetY },
  };
}
