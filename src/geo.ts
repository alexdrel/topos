export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  w: number; // width in chars
  h: number; // height in chars
}

export const eqLoc = (a: Loc, b: Point) => a.x === b.x && a.y === b.y;
export const naturalOrder = (a: Point, b: Point) => (a.y - b.y) || (a.x - b.x);
export const compareByArea = (a: Rect, b: Rect) => (a.w * a.h) - (b.w * b.h);

export const midpoint = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * Returns true if `inner` point/rect is fully contained within `outer` rect.
 * For points, `inclusive` controls whether the right/bottom boundary is included (defaults to false for grid consistency).
 */
export function contains(outer: Rect, inner: Point | Rect, inclusive = false): boolean {
  if ("w" in inner && "h" in inner) {
    return inner.x >= outer.x && inner.y >= outer.y &&
      inner.x + inner.w <= outer.x + outer.w &&
      inner.y + inner.h <= outer.y + outer.h;
  }

  if (inclusive) {
    return inner.x >= outer.x && inner.x <= outer.x + outer.w &&
      inner.y >= outer.y && inner.y <= outer.y + outer.h;
  }

  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x < outer.x + outer.w &&
    inner.y < outer.y + outer.h;
}

/** Proximity to a rectangle's perimeter; negative inside and positive outside. */
export function borderProximity(rect: Rect, point: Point): number {
  const right = rect.x + rect.w - 1;
  const bottom = rect.y + rect.h - 1;
  const dx = point.x < rect.x ? rect.x - point.x : point.x > right ? point.x - right : 0;
  const dy = point.y < rect.y ? rect.y - point.y : point.y > bottom ? point.y - bottom : 0;
  if (dx || dy) return Math.hypot(dx, dy);

  const distance = Math.min(point.x - rect.x, right - point.x, point.y - rect.y, bottom - point.y);
  return distance ? -distance : 0;
}

/** Returns true if point pt lies on the horizontal or vertical line segment between p1 and p2 */
export function isPointOnSegment(p1: Point, p2: Point, pt: Point): boolean {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  if (p1.x === p2.x && pt.x === p1.x && pt.y >= minY && pt.y <= maxY) return true;
  if (p1.y === p2.y && pt.y === p1.y && pt.x >= minX && pt.x <= maxX) return true;
  return false;
}

/** Returns true if point pt lies anywhere strictly on the polyline path */
export function isPointOnPolyline(polyline: Point[], pt: Point): boolean {
  if (polyline.length === 0) return false;
  if (polyline.length === 1) return polyline[0].x === pt.x && polyline[0].y === pt.y;
  for (let i = 0; i < polyline.length - 1; i++) {
    if (isPointOnSegment(polyline[i], polyline[i + 1], pt)) return true;
  }
  return false;
}

/** Returns true if `pt` lies exactly on the boundary of `rect`. */
export function borders(rect: Rect, pt: Point): boolean {
  const { x, y, w, h } = rect;
  const inCol = pt.x >= x && pt.x < x + w;
  const inRow = pt.y >= y && pt.y < y + h;
  return (inCol && (pt.y === y || pt.y === y + h - 1)) ||
    (inRow && (pt.x === x || pt.x === x + w - 1));
}

export type Loc = Point;

export enum Dir {
  None = 0,
  N = 1,
  E = 2,
  S = 4,
  W = 8,
  Text = 16,
  TL = N | W, // Top-Left
  TR = N | E, // Top-Right
  BL = S | W, // Bottom-Left
  BR = S | E, // Bottom-Right
  Horizontal = E | W,
  Vertical = N | S,
  All = N | E | S | W,
}

export type Direction = Dir.N | Dir.E | Dir.S | Dir.W | Dir.None;
export const DIRS: Direction[] = [Dir.N, Dir.E, Dir.S, Dir.W];

export const VECTOR = {
  [Dir.None]: { x: 0, y: 0, opposite: Dir.None, cw: Dir.None, ccw: Dir.None },
  [Dir.N]: { x: 0, y: -1, opposite: Dir.S, cw: Dir.E, ccw: Dir.W },
  [Dir.E]: { x: 1, y: 0, opposite: Dir.W, cw: Dir.S, ccw: Dir.N },
  [Dir.S]: { x: 0, y: 1, opposite: Dir.N, cw: Dir.W, ccw: Dir.E },
  [Dir.W]: { x: -1, y: 0, opposite: Dir.E, cw: Dir.N, ccw: Dir.S },
};

// Map directions to their vector offsets
export const opposite = (dir: Direction): Direction => VECTOR[dir].opposite as Direction;

export const turnRight = (dir: Direction): Direction => VECTOR[dir].cw as Direction;
export const turnLeft = (dir: Direction): Direction => VECTOR[dir].ccw as Direction;
export const moveCursor = (c: Loc, dir: Direction, steps: number = 1): Loc => ({
  x: c.x + VECTOR[dir].x * steps,
  y: c.y + VECTOR[dir].y * steps,
});

/** Returns a generator that walks the boundary of a rectangle, yielding each location and its character mask. */
export function* boxWalk(rect: Rect): Generator<Loc & { mask: number }> {
  const { x: sx, y: sy, w, h } = rect;
  const x2 = sx + w - 1;
  const y2 = sy + h - 1;

  for (let y = sy; y <= y2; y++) {
    for (let x = sx; x <= x2; x++) {
      if (x > sx && x < x2 && y > sy && y < y2) continue;

      let mask: Dir = Dir.None;
      if (x === sx || x === x2) mask |= Dir.Vertical;
      if (y === sy || y === y2) mask |= Dir.Horizontal;

      if (x === sx && y === sy) mask = Dir.BR;
      else if (x === x2 && y === sy) mask = Dir.BL;
      else if (x === sx && y === y2) mask = Dir.TR;
      else if (x === x2 && y === y2) mask = Dir.TL;

      yield { x: x, y: y, mask };
    }
  }
}

export function simplifyPath(path: Loc[]): Loc[] {
  if (path.length <= 1) return path;

  const result: Loc[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const curr = path[i];
    const prev = result.at(-1)!;

    if (eqLoc(curr, prev)) continue;

    if (result.length >= 2) {
      const prevPrev = result.at(-2)!;
      const dx1 = prev.x - prevPrev.x;
      const dy1 = prev.y - prevPrev.y;
      const dx2 = curr.x - prev.x;
      const dy2 = curr.y - prev.y;

      if (Math.sign(dx1) === Math.sign(dx2) && Math.sign(dy1) === Math.sign(dy2)) {
        result[result.length - 1] = curr;
        continue;
      }
    }
    result.push(curr);
  }
  return result;
}

export function expandPolyline(points: Loc[]): Loc[] {
  const path: Loc[] = [];
  const add = (loc: Loc) => {
    const prev = path.at(-1);
    if (!prev || prev.x !== loc.x || prev.y !== loc.y) path.push(loc);
  };

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const sx = Math.sign(b.x - a.x);
    const sy = Math.sign(b.y - a.y);
    let cur = { ...a };
    add(cur);
    while (cur.x !== b.x) {
      cur = { x: cur.x + sx, y: cur.y };
      add(cur);
    }
    while (cur.y !== b.y) {
      cur = { x: cur.x, y: cur.y + sy };
      add(cur);
    }
  }
  return path.length ? path : points.map((p) => ({ ...p }));
}

/** Bounding rect of a set of rects. Returns null if empty. */
export function boundingRect(rects: Iterable<Rect>): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let empty = true;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
    empty = false;
  }
  return empty ? null : { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Construct a bounding Rect from two corner points (inclusive of both) */
export function rectFromPoints(p1: Point, p2: Point): Rect {
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  return { x, y, w: Math.max(p1.x, p2.x) - x + 1, h: Math.max(p1.y, p2.y) - y + 1 };
}

/** Inset a rect by margin on all sides (shrink). */
export function insetRect(r: Rect, margin: number): Rect {
  return {
    x: r.x + margin,
    y: r.y + margin,
    w: Math.max(0, r.w - 2 * margin),
    h: Math.max(0, r.h - 2 * margin),
  };
}

/**
 * Finds the intersection of the segment (inside -> outside) with the boundary of rect.
 * Assumes 'inside' is already inside the rect and 'outside' is outside.
 */
export function intersectRectBoundary(rect: Rect, inside: Point, outside: Point): Point {
  const { x: x1, y: y1 } = inside;
  const { x: x2, y: y2 } = outside;
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Simple cases for axis-aligned segments
  if (dx === 0) return { x: x1, y: y2 < y1 ? rect.y : rect.y + rect.h };
  if (dy === 0) return { x: x2 < x1 ? rect.x : rect.x + rect.w, y: y1 };

  // Parametric intersection calculation
  const tX = [(rect.x - x1) / dx, (rect.x + rect.w - x1) / dx];
  const tY = [(rect.y - y1) / dy, (rect.y + rect.h - y1) / dy];

  let bestT = Number.POSITIVE_INFINITY;
  let bestPt = outside;

  for (const t of [...tX, ...tY]) {
    if (t < 0 || t > 1) continue;
    if (t < bestT) {
      bestT = t;
      bestPt = { x: x1 + dx * t, y: y1 + dy * t };
    }
  }
  return bestPt;
}

export function getDirection(from: Loc, to: Loc): Dir {
  if (to.x > from.x) return Dir.E;
  if (to.x < from.x) return Dir.W;
  if (to.y > from.y) return Dir.S;
  if (to.y < from.y) return Dir.N;
  return Dir.None;
}

export interface ResizeOffsets {
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
}

export interface Bounds {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export function bounds(rect: Rect): Bounds {
  return { top: rect.y, left: rect.x, bottom: rect.y + rect.h - 1, right: rect.x + rect.w - 1 };
}

export function rectFromBounds({ top, left, bottom, right }: Bounds): Rect {
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export function resizeOffsets(from: Rect, to: Rect): ResizeOffsets {
  const current = bounds(from);
  const target = bounds(to);
  return {
    top: target.top - current.top,
    left: target.left - current.left,
    bottom: target.bottom - current.bottom,
    right: target.right - current.right,
  };
}

export function resizeRect(rect: Rect, offsets: ResizeOffsets): Rect {
  const top = offsets.top ?? 0;
  const left = offsets.left ?? 0;
  const bottom = offsets.bottom ?? 0;
  const right = offsets.right ?? 0;
  return {
    x: rect.x + left,
    y: rect.y + top,
    w: rect.w + right - left,
    h: rect.h + bottom - top,
  };
}
