import { Rect } from "./geo.ts";

export type Stack = {
  layers: number;
  dx: number;
  dy: number;
};

export const DEFAULT_STACK: Stack = { layers: 3, dx: 1, dy: 1 };

export interface StackLayer extends Rect {
  index?: number;
  isFace: boolean;
}

/**
 * Calculates the shared geometry for a stacked box.
 * In Topos, a stacked box's 'totalBounds' represents the total grid area
 * covered by all layers combined (parsed from the ant's trail).
 *
 * @param totalBounds The total bounding rectangle of the stack.
 * @param stack Stack metadata (layers, dx, dy).
 * @returns The 'face' rectangle and a pre-calculated array of all layer rectangles.
 */
export function getStackGeometry(totalBounds: Rect, stack: Stack) {
  const { layers: layersCount, dx, dy } = stack;
  const count = layersCount - 1;
  const totalOx = count * Math.abs(dx);
  const totalOy = count * Math.abs(dy);

  // Common size for every individual layer in the stack
  const w = Math.max(1, totalBounds.w - totalOx);
  const h = Math.max(1, totalBounds.h - totalOy);

  // dx/dy point from the face toward the rear layers.
  // Align the face so the complete stack stays within totalBounds.
  const face: Rect = {
    x: totalBounds.x + Math.max(0, -dx * count),
    y: totalBounds.y + Math.max(0, -dy * count),
    w,
    h,
  };

  const layers: StackLayer[] = [];
  for (let i = 0; i < layersCount; i++) {
    layers.push({
      x: face.x + (count - i) * dx,
      y: face.y + (count - i) * dy,
      w,
      h,
      index: i,
      isFace: i === count,
    });
  }

  return { face, layers };
}

export function getStackBounds(face: Rect, stack: Stack): Rect {
  const count = stack.layers - 1;
  const offsetX = count * stack.dx;
  const offsetY = count * stack.dy;
  return {
    x: face.x + Math.min(0, offsetX),
    y: face.y + Math.min(0, offsetY),
    w: face.w + Math.abs(offsetX),
    h: face.h + Math.abs(offsetY),
  };
}

/**
 * Checks if a target Y coordinate is a visible top/bottom horizontal line of a box or stacked box.
 * Accepts a Rect plus optional Stack.
 */
export function isBoxHorizontalLine(box: Rect, targetY: number, stack?: Stack): boolean {
  if (targetY === box.y || targetY === box.y + box.h - 1) return true;

  if (stack) {
    const layers = stack.layers;
    const dy = stack.dy;
    const base = dy < 0 ? box.y : box.y + box.h - 1;
    for (let i = 1; i < layers; i++) {
      if (targetY === base - i * dy) return true;
    }
  }

  return false;
}
