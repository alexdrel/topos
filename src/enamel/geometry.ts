import { Point, Rect } from "../geo.ts";
import { Node } from "../topos.ts";
import { resolveStackGeometry, stackBoundsPx, stackLayerRectPx } from "./stacked-box.ts";

export const CHAR_WIDTH = 14.4;
export const CHAR_HEIGHT = 24;

/** Converts grid coordinates to SVG pixel space. */
export function toPx(pt: Point): Point {
  return {
    x: pt.x * CHAR_WIDTH,
    y: pt.y * CHAR_HEIGHT,
  };
}

export function rectToPx(rect: Rect): Rect {
  return {
    ...toPx(rect),
    w: rect.w * CHAR_WIDTH,
    h: rect.h * CHAR_HEIGHT,
  };
}

/** Converts a topos node (grid) to SVG pixel rect. Hubs are forced to be squares. */
export function nodeToRectPx(node: Node, layer?: number): Rect {
  if (layer !== undefined) {
    const stackGeometry = resolveStackGeometry(node);
    if (stackGeometry) {
      return stackLayerRectPx(rectToPx(stackGeometry.face), stackGeometry.stack, layer);
    }
  }

  let { x, y, w, h } = rectToPx(node);

  const parent = node.parent;
  if (node.nodeType === "hub") {
    const size = Math.min(w, h);
    x += (w - size) / 2;
    y += (h - size) / 2;
    w = h = size;

    if (parent && node.isPort) {
      const p = rectToPx(parent);
      if (node.x === parent.x) x = p.x - size / 2;
      if (node.x === parent.x + parent.w - 1) x = p.x + p.w - size / 2;
      if (node.y === parent.y) y = p.y - size / 2;
      if (node.y === parent.y + parent.h - 1) y = p.y + p.h - size / 2;
    }
    return { x, y, w, h };
  }

  if (parent && node.isGridCell) {
    const p = rectToPx(parent);
    const relX = (node.x - parent.x) / (parent.w - 1);
    const relY = (node.y - parent.y) / (parent.h - 1);
    const relX_end = (node.x + node.w - 1 - parent.x) / (parent.w - 1);
    const relY_end = (node.y + node.h - 1 - parent.y) / (parent.h - 1);
    return {
      x: p.x + relX * p.w,
      y: p.y + relY * p.h,
      w: (relX_end - relX) * p.w,
      h: (relY_end - relY) * p.h,
    };
  }

  return { x, y, w, h };
}

/** Pixel-space perimeter enclosing every rendered layer of a node. */
export function nodeRenderedBoundsPx(node: Node): Rect {
  const stackGeometry = resolveStackGeometry(node);
  if (!stackGeometry) return nodeToRectPx(node);

  const face = rectToPx(stackGeometry.face);
  return stackBoundsPx(face, stackGeometry.stack);
}
