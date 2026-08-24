import { Dir, Direction, expandPolyline, getDirection, type Loc, opposite, simplifyPath } from "../../../src/geo.ts";
import { rotateArrow, spec, Trait } from "../../../src/grammar.ts";
import { DEFAULT_PEN } from "../../../src/style.ts";
import type { TraceBox, TraceMap } from "../../../src/trace/types.ts";
import { createTrace, recalculateTraceBounds } from "./internal.ts";
import { reconcileLabels } from "./label.ts";

export const OPEN_TERMINUS_GLYPH = "∅";

function invalidateTerminusDirection(terminus: TraceBox): void {
  terminus.dir = terminus.text ? undefined : Dir.None;
  terminus.recoilDir = undefined;
}

/** Synchronize terminus position, direction, and glyphs with the line path. */
export function reconcileTermini(line: TraceBox): void {
  if (line.type !== "line" || !line.path || line.path.length < 2) return;
  const startDirection = getDirection(line.path[0], line.path[1]) as Direction;
  const endDirection = getDirection(line.path.at(-2)!, line.path.at(-1)!) as Direction;
  if (line.source) {
    const recoil = opposite(startDirection);
    const halfWire = line.source.text === undefined;
    const arrow = !!line.source.text && !!(spec(line.source.text).trait & Trait.Arrow);
    Object.assign(line.source, {
      x: line.path[0].x,
      y: line.path[0].y,
      dir: halfWire ? Dir.None : arrow ? recoil : line.source.dir,
      recoilDir: !halfWire && !arrow && line.source.dir === Dir.None ? recoil : undefined,
    });
    if (arrow) line.source.text = rotateArrow(line.source.text!, startDirection);
  }
  if (line.target) {
    const recoil = endDirection;
    const halfWire = line.target.text === undefined;
    const arrow = !!line.target.text && !!(spec(line.target.text).trait & Trait.Arrow);
    Object.assign(line.target, {
      x: line.path.at(-1)!.x,
      y: line.path.at(-1)!.y,
      dir: halfWire ? Dir.None : arrow ? recoil : line.target.dir,
      recoilDir: !halfWire && !arrow && line.target.dir === Dir.None ? recoil : undefined,
    });
    if (arrow) line.target.text = rotateArrow(line.target.text!, opposite(endDirection));
  }
  recalculateTraceBounds(line);
}

export function createLine(traceMap: TraceMap, vertices: Loc[]): TraceBox {
  const points = simplifyPath(vertices);
  if (points.length < 2) throw new Error("Line requires at least two distinct points");
  const path = expandPolyline(points);
  const start = path[0];
  const end = path.at(-1)!;
  const trace = createTrace("line", { path, style: DEFAULT_PEN });
  trace.source = createTrace("terminus", { x: start.x, y: start.y, w: 1, h: 1, text: "", dir: Dir.None, parent: trace });
  trace.target = createTrace("terminus", { x: end.x, y: end.y, w: 1, h: 1, text: "", dir: Dir.None, parent: trace });
  reconcileTermini(trace);
  traceMap.traces.push(trace, trace.source, trace.target);
  return trace;
}

function moveLineVertex(vertices: Loc[], index: number, newLoc: Loc, bendThreshold?: number): Loc[] {
  if (vertices.length <= 1) return [newLoc];
  const last = vertices.length - 1;
  if (index === 0 || index === last) {
    let points = vertices.map((point) => ({ ...point }));
    const neighborIndex = index === 0 ? 1 : last - 1;
    const endpoint = points[index];
    const neighbor = points[neighborIndex];
    const oppositeEndpoint = points[index === 0 ? last : 0];
    const closesPath = newLoc.x === oppositeEndpoint.x && newLoc.y === oppositeEndpoint.y;
    if (newLoc.x === neighbor.x || newLoc.y === neighbor.y) {
      points[index] = newLoc;
      return points;
    }
    const horizontal = endpoint.y === neighbor.y;
    const offAxisDistance = horizontal ? Math.abs(newLoc.y - endpoint.y) : Math.abs(newLoc.x - endpoint.x);
    if (closesPath || bendThreshold === undefined || offAxisDistance >= bendThreshold) {
      const corner = horizontal ? { x: newLoc.x, y: neighbor.y } : { x: neighbor.x, y: newLoc.y };
      points = index === 0 ? [newLoc, corner, ...points.slice(1)] : [...points.slice(0, -1), corner, newLoc];
    } else {
      points[index] = horizontal ? { x: newLoc.x, y: endpoint.y } : { x: endpoint.x, y: newLoc.y };
    }
    return points;
  }

  const result = vertices.map((point) => ({ ...point }));
  const vertex = vertices[index];
  const dx = newLoc.x - vertex.x;
  const dy = newLoc.y - vertex.y;
  result[index] = newLoc;
  if (vertices[index - 1].y === vertex.y) result[index - 1].y += dy;
  else result[index - 1].x += dx;
  if (vertex.y === vertices[index + 1].y) result[index + 1].y += dy;
  else result[index + 1].x += dx;
  return result;
}

function collapseLoops(path: Loc[]): Loc[] {
  const result: Loc[] = [];
  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const repeatedAt = result.findIndex(({ x, y }) => x === point.x && y === point.y);
    if (repeatedAt === -1) result.push(point);
    else if (repeatedAt === 0 && i === path.length - 1) result.push(point);
    else result.length = repeatedAt + 1;
  }
  return result;
}

export function moveLinePoint(
  _traceMap: TraceMap,
  trace: TraceBox,
  pointIndex: number,
  loc: Loc,
  bendThreshold?: number,
): void {
  if (trace.type !== "line") throw new Error("Only line traces have points");
  const vertices = simplifyPath(trace.path!);
  if (pointIndex < 0 || pointIndex >= vertices.length) throw new Error("Line point out of range");
  const path = collapseLoops(expandPolyline(simplifyPath(moveLineVertex(vertices, pointIndex, loc, bendThreshold))));
  if (path.length <= 1) return;
  trace.path = path;
  if (pointIndex === 0 && trace.source) invalidateTerminusDirection(trace.source);
  if (pointIndex === vertices.length - 1 && trace.target) invalidateTerminusDirection(trace.target);
  reconcileTermini(trace);
}

/**
 * Move a terminus to an exact location. A numeric threshold is reserved for
 * interactive dragging: smaller off-axis movement stays on the current axis.
 */
export function setTerminusLocation(traceMap: TraceMap, terminus: TraceBox, loc: Loc, bendThreshold?: number): void {
  if (terminus.type !== "terminus") throw new Error("Only terminus traces can be moved as endpoints");
  const line = terminus.parent;
  if (line?.type !== "line") return;

  const isSource = line.source === terminus;
  if (!isSource && line.target !== terminus) throw new Error("Terminus does not belong to its parent line");

  const points = simplifyPath(line.path!);
  if (points.length > 1) {
    moveLinePoint(traceMap, line, isSource ? 0 : points.length - 1, loc, bendThreshold);
    return;
  }
  const other = points[0] ?? { x: line.x, y: line.y };
  line.path = expandPolyline(isSource ? [loc, other] : [other, loc]);
  reconcileTermini(line);
}

export function setTerminusGlyph(_traceMap: TraceMap, terminus: TraceBox, glyph: string): void {
  if (terminus.type !== "terminus") throw new Error("Only terminus traces can edit glyph");
  if (!terminus.parent) return;
  if (glyph === OPEN_TERMINUS_GLYPH) {
    terminus.text = undefined;
    invalidateTerminusDirection(terminus);
    return;
  }
  if (glyph && !(spec(glyph).trait & Trait.Arrow)) throw new Error("Terminus glyphs must be arrow");
  terminus.text = glyph;
  invalidateTerminusDirection(terminus);
  reconcileTermini(terminus.parent);
}

export function reverseLineTrace(traceMap: TraceMap, trace: TraceBox): void {
  if (trace.type !== "line") return;
  [trace.source, trace.target] = [trace.target, trace.source];
  if (trace.source) invalidateTerminusDirection(trace.source);
  if (trace.target) invalidateTerminusDirection(trace.target);
  reconcileTermini(trace);
  reconcileLabels(traceMap);
}
