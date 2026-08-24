import { Edge } from "../topos.ts";
import { EIDOS_VALUES, textEidosValue } from "../eidos.ts";
import { contains, Dir, intersectRectBoundary, Loc, midpoint, Point, Rect, simplifyPath } from "../geo.ts";
import { appendChild, XmlEl } from "../jsonml/jsonml.ts";
import { svgEl } from "../jsonml/svg.ts";
import { parseUnitRatio } from "../legend/value.ts";
import { clsx, clsxSet } from "../clsx.ts";
import { CHAR_HEIGHT, CHAR_WIDTH, nodeRenderedBoundsPx, toPx } from "./geometry.ts";
import { INSET_PX, lineAlignmentAttrs, measureText, renderFormattedLines } from "./alignment.ts";
import { animation } from "./animation.ts";
import { addEidosClasses, entityStyle, injectLocalAssets, Registry, resolveFilter, resolveMarker } from "./svg.ts";

type Corner = typeof EIDOS_VALUES["corner"][number];
type CornerMode = "round" | "bevel";
type EdgeRoute = typeof EIDOS_VALUES["edgeRoute"][number];
type Attachment = typeof EIDOS_VALUES["attachment"][number];

const ROUND_RADIUS_MAP: Partial<Record<Corner, number>> = {
  sharp: 0,
  tight: 4,
  rounded: 12,
  loose: 24,
};

const BEVEL_RADIUS_MAP: Partial<Record<Corner, number>> = {
  bevel: 4,
  rhombus: 12,
};
const MIN_BLOCK_ARROW_LENGTH = 60;
const NODE_EDGE_CLEARANCE_PX = 2;
const ATTACHMENT_OFFSET: Record<Attachment, number> = { "no-gap": 0, gap: 2, "s-gap": 2, "m-gap": 3, "l-gap": 4 };

function resolveCorner(corner?: Corner): { radius: number; mode: CornerMode } {
  if (corner && BEVEL_RADIUS_MAP[corner] !== undefined) return { radius: BEVEL_RADIUS_MAP[corner], mode: "bevel" };
  return { radius: corner ? ROUND_RADIUS_MAP[corner] ?? 0 : 0, mode: "round" };
}

const toCenterPx = (point: Loc) => toPx({ x: point.x + 0.5, y: point.y + 0.5 });

export function renderEdge(edge: Edge, parentGroup: XmlEl, registry: Registry) {
  const gClassSet = clsxSet("tp", "tp-edge", edge.classes);
  addEidosClasses(gClassSet, edge.eidos, registry);
  const { points, labelPoints, preservesAuthoredGeometry, isBlockArrow } = resolveEdgeGeometry(edge);

  if (points.length < 2) return;
  const length = pathLength(points);
  const { radius, mode } = resolveCorner(edge.eidos?.corner);
  const path = toPathStr(points, radius, mode);
  const anime = animation(edge, registry, {
    path,
    pathLength: length,
    bidirectional: edge.direction === "bi",
  });
  const edgeGroup = svgEl("g", {
    class: clsx(gClassSet),
    id: (edge.id && edge.id !== edge.label) ? edge.id : undefined,
    style: entityStyle(edge, anime.style),
  });
  resolveFilter(edgeGroup, edge.eidos?.effect, registry, anime.filterArgs);
  appendChild(parentGroup, edgeGroup);

  const shapeClass = "tp tpc-shape";
  const shapeEffect = edge.eidos?.fill?.effect ?? edge.eidos?.stroke?.effect;

  if (isBlockArrow) {
    renderBlockArrow(edge, points, edgeGroup, registry, shapeEffect);
  } else {
    const pathEl = svgEl("path", { d: path, class: shapeClass, ...resolveMarkers(edge, registry) });
    resolveFilter(pathEl, shapeEffect, registry);
    appendChild(edgeGroup, pathEl);
  }

  edgeGroup.push(...anime.particles);
  renderEdgeLabel(edge, labelPoints, preservesAuthoredGeometry, isBlockArrow, edgeGroup, registry);
}

function renderEdgeLabel(edge: Edge, points: Point[], preservesAuthoredGeometry: boolean, isBlockArrow: boolean, edgeGroup: XmlEl, registry: Registry) {
  if (!edge.segmentedText) return;

  const rawLabel = edge.rawLabels?.[0];
  const authored = rawLabel && preservesAuthoredGeometry ? toPx(midpoint(rawLabel)) : undefined;
  const position = resolveEdgeLabelPosition(edge, points, authored ?? calculateMidpoint(points), isBlockArrow);
  const lines = edge.segmentedText.length ? edge.segmentedText : [[{ text: edge.label?.trim() ?? "" }]];
  const lineAttrs = lineAlignmentAttrs(textEidosValue(edge, "Align"), "middle", position.anchor, position.x, measureText(lines).width * CHAR_WIDTH);

  const label = svgEl("text", {
    x: position.x,
    y: position.y,
    class: "tp tpc-label",
    "text-anchor": position.anchor,
    "dominant-baseline": position.baseline ?? (isBlockArrow ? "middle" : undefined),
  });
  label.push(...renderFormattedLines(lines, lineAttrs));
  resolveFilter(label, edge.eidos?.label?.effect, registry);
  appendChild(edgeGroup, label);
}

function resolveEdgeLabelPosition(
  edge: Edge,
  points: Point[],
  fallback: Point,
  isBlockArrow: boolean,
): Point & { anchor: "start" | "middle" | "end"; baseline?: "hanging" | "middle" } {
  const defaultY = fallback.y + (isBlockArrow ? 1 : -4);
  if (edge.polyline.length < 2) return { x: fallback.x, y: defaultY, anchor: "middle" };

  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  const xAxis = textEidosValue(edge, "Horizontal");
  const yAxis = textEidosValue(edge, "Vertical");
  const explicitLeft = edgeCoordinate(edge.properties?.left, left, right - left, CHAR_WIDTH);
  const explicitCenter = edgeCoordinate(edge.properties?.center, left, right - left, CHAR_WIDTH);
  const explicitTop = edgeCoordinate(edge.properties?.top, top, bottom - top, CHAR_HEIGHT);
  const explicitMiddle = edgeCoordinate(edge.properties?.middle, top, bottom - top, CHAR_HEIGHT);
  const explicitX = explicitCenter ?? explicitLeft;
  const explicitY = explicitMiddle ?? explicitTop;
  const pathY = explicitY ?? (yAxis === "top" ? top : yAxis === "bottom" ? bottom : fallback.y);
  let y = explicitY ?? (yAxis === "top" ? top - 4 : yAxis === "bottom" ? bottom - 4 : defaultY);

  if (explicitX !== undefined || xAxis === "left" || xAxis === "right") {
    const span = pathSpanAtY(points, pathY) ?? { left: fallback.x, right: fallback.x };
    const horizontal = span.left < span.right;
    const lateral = !horizontal && explicitY === undefined && yAxis !== "top" && yAxis !== "bottom";
    if (lateral) y = pathY;
    const baseline = explicitMiddle !== undefined || lateral ? "middle" : explicitTop !== undefined ? "hanging" : undefined;
    if (explicitX !== undefined) return { x: explicitX, y, anchor: explicitCenter !== undefined ? "middle" : "start", baseline };
    if (xAxis === "left") {
      return { x: span.left + (horizontal ? INSET_PX : -INSET_PX), y, anchor: horizontal ? "start" : "end", baseline };
    }
    return { x: span.right + (horizontal ? -INSET_PX : INSET_PX), y, anchor: horizontal ? "end" : "start", baseline };
  }
  return { x: fallback.x, y, anchor: "middle" };
}

function edgeCoordinate(value: string | undefined, start: number, size: number, scale: number): number | undefined {
  const coordinate = value ? parseUnitRatio(value) : undefined;
  return coordinate && start + (coordinate.type === "ratio" ? coordinate.value * size : coordinate.value * scale);
}

function pathSpanAtY(points: Point[], y: number): { left: number; right: number } | undefined {
  let span: { left: number; right: number } | undefined;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (y < Math.min(from.y, to.y) || y > Math.max(from.y, to.y)) continue;
    const left = from.y === to.y ? Math.min(from.x, to.x) : from.x + (y - from.y) / (to.y - from.y) * (to.x - from.x);
    const right = from.y === to.y ? Math.max(from.x, to.x) : left;
    span = span ? { left: Math.min(span.left, left), right: Math.max(span.right, right) } : { left, right };
  }
  return span;
}

function resolveMarkers(edge: Edge, registry: Registry): { "marker-start"?: string; "marker-end"?: string } {
  const marker = (m?: string) => (m && m !== "no-marker") ? resolveMarker(m, registry) : undefined;
  return {
    "marker-start": marker(edge.eidos?.tail?.marker ?? edge.eidos?.marker),
    "marker-end": marker(edge.eidos?.head?.marker ?? edge.eidos?.marker),
  };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

function resolveEdgeGeometry(edge: Edge): { points: Point[]; labelPoints: Point[]; preservesAuthoredGeometry: boolean; isBlockArrow: boolean } {
  const route: EdgeRoute = edge.polyline.length < 2 ? "ray" : edge.eidos?.edgeRoute ?? "path";

  let points: Point[];
  let preservesAuthoredGeometry = false;
  switch (route) {
    case "ray": {
      points = [edge.source, edge.target].map((terminus, index) =>
        terminus.node ? toPx(midpoint(terminus.node)) : toCenterPx((index === 0 ? edge.polyline[0] : edge.polyline.at(-1)) ?? { x: 0, y: 0 })
      );
      break;
    }
    case "taut":
      points = [toCenterPx(edge.polyline[0]), toCenterPx(edge.polyline.at(-1)!)];
      break;
    case "path":
      points = edge.polyline.map(toCenterPx);
      preservesAuthoredGeometry = true;
  }

  const directions: [Dir, Dir] = [edge.source.dir, edge.target.dir];
  let trimmed = trimEdgeSpan(points, edge, directions, route, false);
  const isBlockArrow = edge.eidos?.edgeBody === "block" && pathLength(trimmed) >= MIN_BLOCK_ARROW_LENGTH;
  const labelPoints = simplifyPath(trimmed);
  if (isBlockArrow) trimmed = trimEdgeSpan(points, edge, directions, route, true);

  if (route === "taut" && trimmed.length > 2) trimmed = [trimmed[0], trimmed.at(-1)!];
  return { points: simplifyPath(trimmed), labelPoints, preservesAuthoredGeometry, isBlockArrow };
}

function calculateMidpoint(points: Point[]): Point {
  if (points.length < 2) return points[0] || { x: 0, y: 0 };
  let totalDist = 0;
  const segments: Array<{ length: number; start: Point; end: Point }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.sqrt((points[i + 1].x - points[i].x) ** 2 + (points[i + 1].y - points[i].y) ** 2);
    segments.push({ length: d, start: points[i], end: points[i + 1] });
    totalDist += d;
  }
  const midDist = totalDist / 2;
  let currentDist = 0;
  for (const seg of segments) {
    if (currentDist + seg.length >= midDist) {
      const t = seg.length === 0 ? 0 : (midDist - currentDist) / seg.length;
      return {
        x: seg.start.x + (seg.end.x - seg.start.x) * t,
        y: seg.start.y + (seg.end.y - seg.start.y) * t,
      };
    }
    currentDist += seg.length;
  }
  return points[points.length - 1];
}

function pathLength(points: Point[]): number {
  return points.reduce(
    (length, point, i) => i === 0 ? 0 : length + Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y),
    0,
  );
}

function trimEdgeSpan(points: Point[], edge: Edge, directions: [Dir, Dir], route: EdgeRoute, isBlockArrow: boolean): Point[] {
  let trimmed = [...points];
  const preservesAuthoredPath = route === "path";
  const preservesOffsets = preservesAuthoredPath && edge.eidos?.edgeBody !== "block";

  const getInternalAnchor = (rect: Rect, pt: Point, dir: Dir): Point => {
    const mid = midpoint(rect);
    if (dir === Dir.N || dir === Dir.S) return { x: pt.x, y: mid.y };
    if (dir === Dir.E || dir === Dir.W) return { x: mid.x, y: pt.y };
    // Preserve a Dir.None terminus that was authored on the resolved node.
    // A stem-resolved terminus is elsewhere on the map, so begin at the node
    // center and let the boundary trim find its rendered attachment point.
    return contains(rect, pt, true) ? pt : mid;
  };

  [edge.source, edge.target].forEach((term, i) => {
    if (preservesAuthoredPath && term.stem) return;
    if (!term.node) return;
    const isStart = i === 0;
    const bounds = nodeRenderedBoundsPx(term.node);
    const attachment = (isStart ? edge.eidos?.tail?.attachment : edge.eidos?.head?.attachment) ?? edge.eidos?.attachment;
    const offset = attachment ? ATTACHMENT_OFFSET[attachment] : term.offset ?? 0;
    const gap = preservesOffsets ? Math.max(0, offset - 1) : 0;
    const clearance = term.node.nodeType === "note" || term.node.nodeType === "hub"
      ? 0
      : isBlockArrow && isStart && edge.direction !== "bi"
      ? 0
      : NODE_EDGE_CLEARANCE_PX;
    const rect = {
      x: bounds.x - gap * CHAR_WIDTH - clearance,
      y: bounds.y - gap * CHAR_HEIGHT - clearance,
      w: bounds.w + gap * CHAR_WIDTH * 2 + clearance * 2,
      h: bounds.h + gap * CHAR_HEIGHT * 2 + clearance * 2,
    };
    const pt = isStart ? trimmed[0] : trimmed.at(-1)!;
    const anchor = term.node.nodeType === "hub" ? midpoint(rect) : getInternalAnchor(rect, pt, directions[i]);

    if (isStart) {
      if (!contains(rect, trimmed[0], true)) trimmed.unshift(anchor);
      else trimmed[0] = anchor;
    } else {
      if (!contains(rect, trimmed.at(-1)!, true)) trimmed.push(anchor);
      else trimmed[trimmed.length - 1] = anchor;
    }
    trimmed = trimToRectBoundary(trimmed, rect, isStart);
  });

  return trimmed;
}

function trimToRectBoundary(points: Point[], rect: Rect, isStart: boolean): Point[] {
  if (points.length < 2) return points;
  if (isStart) {
    for (let i = 0; i < points.length - 1; i++) {
      if (contains(rect, points[i], true) && !contains(rect, points[i + 1], true)) {
        return [intersectRectBoundary(rect, points[i], points[i + 1]), ...points.slice(i + 1)];
      }
      if (!contains(rect, points[i], true)) return points;
    }
  } else {
    for (let i = points.length - 1; i > 0; i--) {
      if (contains(rect, points[i], true) && !contains(rect, points[i - 1], true)) {
        return [...points.slice(0, i), intersectRectBoundary(rect, points[i], points[i - 1])];
      }
      if (!contains(rect, points[i], true)) return points;
    }
  }
  return points;
}

export function toPathStr(points: Point[], radius = 0, corner: CornerMode = "round"): string {
  const rnd = (n: number) => Math.round(n * 50) / 50;
  if (points.length < 2) return "";
  if (radius === 0 || points.length === 2) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${rnd(p.x)},${rnd(p.y)}`).join(" ");
  }

  let d = `M ${rnd(points[0].x)},${rnd(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const pNext = points[i + 1];

    const d1 = [pCurr.x - pPrev.x, pCurr.y - pPrev.y];
    const d2 = [pNext.x - pCurr.x, pNext.y - pCurr.y];
    const l1 = Math.sqrt(d1[0] ** 2 + d1[1] ** 2);
    const l2 = Math.sqrt(d2[0] ** 2 + d2[1] ** 2);
    const r = Math.min(radius, l1 / 2, l2 / 2);

    const startX = pCurr.x - (d1[0] / l1) * r;
    const startY = pCurr.y - (d1[1] / l1) * r;
    const endX = pCurr.x + (d2[0] / l2) * r;
    const endY = pCurr.y + (d2[1] / l2) * r;

    d += corner === "bevel"
      ? ` L ${rnd(startX)},${rnd(startY)} L ${rnd(endX)},${rnd(endY)}`
      : ` L ${rnd(startX)},${rnd(startY)} Q ${rnd(pCurr.x)},${rnd(pCurr.y)} ${rnd(endX)},${rnd(endY)}`;
  }
  d += ` L ${rnd(points.at(-1)!.x)},${rnd(points.at(-1)!.y)}`;
  return d;
}

function renderBlockArrow(edge: Edge, points: Point[], container: XmlEl, registry: Registry, effect: string | undefined) {
  const polygonPoints = buildBlockArrowPolygon(points, edge.direction === "bi");
  if (polygonPoints.length === 0) return;

  const polygonData = polygonPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const localStyle = injectLocalAssets(container, edge.eidos?.fill?.pattern ?? edge.eidos?.pattern, registry);

  const polygon = svgEl("polygon", { class: "tp tpc-shape", points: polygonData, style: localStyle });
  resolveFilter(polygon, effect, registry);
  appendChild(container, polygon);
}

export function buildBlockArrowPolygon(points: Point[], isBidirectional: boolean): Point[] {
  const bodyHalfWidth = 9;
  const headLength = 22;
  const headHalfWidth = 16;

  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i], end = points[i + 1];
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) continue;
    const tangentX = dx / length, tangentY = dy / length;
    segments.push({ start, end, tangentX, tangentY, normalX: -tangentY, normalY: tangentX });
  }

  if (segments.length === 0) return [];

  const rightSide: Point[] = [];
  const leftSide: Point[] = [];

  // Start Head / Flat Start
  const first = segments[0];
  if (isBidirectional) {
    rightSide.push(first.start); // Tip
    rightSide.push({
      x: first.start.x + first.tangentX * headLength + first.normalX * headHalfWidth,
      y: first.start.y + first.tangentY * headLength + first.normalY * headHalfWidth,
    }); // Shoulder
    rightSide.push({
      x: first.start.x + first.tangentX * headLength + first.normalX * bodyHalfWidth,
      y: first.start.y + first.tangentY * headLength + first.normalY * bodyHalfWidth,
    }); // Neck
    leftSide.push({
      x: first.start.x + first.tangentX * headLength - first.normalX * headHalfWidth,
      y: first.start.y + first.tangentY * headLength - first.normalY * headHalfWidth,
    }); // Shoulder
    leftSide.push({
      x: first.start.x + first.tangentX * headLength - first.normalX * bodyHalfWidth,
      y: first.start.y + first.tangentY * headLength - first.normalY * bodyHalfWidth,
    }); // Neck
  } else {
    rightSide.push({ x: first.start.x + first.normalX * bodyHalfWidth, y: first.start.y + first.normalY * bodyHalfWidth });
    leftSide.push({ x: first.start.x - first.normalX * bodyHalfWidth, y: first.start.y - first.normalY * bodyHalfWidth });
  }

  function getMiter(normalX1: number, normalY1: number, normalX2: number, normalY2: number, halfWidth: number): Point {
    const normalSumX = normalX1 + normalX2, normalSumY = normalY1 + normalY2;
    const normalSumLength = Math.hypot(normalSumX, normalSumY);
    if (normalSumLength < 0.0001) return { x: normalX1 * halfWidth, y: normalY1 * halfWidth };
    const mx = normalSumX / normalSumLength, my = normalSumY / normalSumLength;
    const cosPhi = normalX1 * mx + normalY1 * my;
    const dist = halfWidth / Math.max(0.1, cosPhi);
    return { x: mx * dist, y: my * dist };
  }

  // Corners
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i], next = segments[i + 1];
    const miter = getMiter(current.normalX, current.normalY, next.normalX, next.normalY, bodyHalfWidth);
    rightSide.push({ x: current.end.x + miter.x, y: current.end.y + miter.y });
    leftSide.push({ x: current.end.x - miter.x, y: current.end.y - miter.y });
  }

  // End Head
  const last = segments.at(-1)!;
  rightSide.push({
    x: last.end.x - last.tangentX * headLength + last.normalX * bodyHalfWidth,
    y: last.end.y - last.tangentY * headLength + last.normalY * bodyHalfWidth,
  }); // Neck
  rightSide.push({
    x: last.end.x - last.tangentX * headLength + last.normalX * headHalfWidth,
    y: last.end.y - last.tangentY * headLength + last.normalY * headHalfWidth,
  }); // Shoulder
  rightSide.push(last.end); // Tip
  leftSide.push({
    x: last.end.x - last.tangentX * headLength - last.normalX * bodyHalfWidth,
    y: last.end.y - last.tangentY * headLength - last.normalY * bodyHalfWidth,
  }); // Neck
  leftSide.push({
    x: last.end.x - last.tangentX * headLength - last.normalX * headHalfWidth,
    y: last.end.y - last.tangentY * headLength - last.normalY * headHalfWidth,
  }); // Shoulder

  return [...rightSide, ...leftSide.reverse()];
}
