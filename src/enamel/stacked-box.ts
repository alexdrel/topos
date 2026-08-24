import type { Rect } from "../geo.ts";
import { DEFAULT_STACK, getStackGeometry, type Stack } from "../stacked-box.ts";
import type { Node } from "../topos.ts";

export const STACK_DX = 10;
export const STACK_DY = 10;

export function resolveStack(node: Node): Stack | undefined {
  const property = node.properties?.stack;
  if (property !== undefined) {
    const parsed = parseStack(property);
    if (parsed !== undefined) return parsed ?? undefined;
  }

  if (node.eidos?.layering === "stack") return DEFAULT_STACK;
  if (node.eidos?.layering === "flat") return undefined;
  return node.stack;
}

export function resolveStackGeometry(node: Node) {
  const stack = resolveStack(node);
  if (!stack) return undefined;

  const face = node.stack ? getStackGeometry(node, stack).face : node;
  return { stack, face };
}

export function stackLayerRectPx(face: Rect, stack: Stack, layer: number): Rect {
  const count = stack.layers - 1;
  return {
    ...face,
    x: face.x + (count - layer) * stack.dx * STACK_DX,
    y: face.y + (count - layer) * stack.dy * STACK_DY,
  };
}

export function stackBoundsPx(face: Rect, stack: Stack): Rect {
  const rear = stackLayerRectPx(face, stack, 0);
  const x = Math.min(face.x, rear.x);
  const y = Math.min(face.y, rear.y);
  return {
    x,
    y,
    w: Math.max(face.x + face.w, rear.x + rear.w) - x,
    h: Math.max(face.y + face.h, rear.y + rear.h) - y,
  };
}

function parseStack(value: string): Stack | null | undefined {
  const parts = value.split(",");
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^-?\d+$/.test(part))) return undefined;

  const [layers, dx = 1, dy = 1] = parts.map(Number);
  if (layers === 0) return null;
  if (layers < 1) return undefined;
  return { layers, dx, dy };
}
