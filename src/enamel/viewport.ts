import { boundingRect, Rect } from "../geo.ts";
import { Edge, Node } from "../topos.ts";
import type { StringParameters } from "../topos.ts";
import { CHAR_HEIGHT, CHAR_WIDTH } from "./geometry.ts";

const DEFAULT_PADDING_PX = 24;

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  intrinsicWidth: number;
  intrinsicHeight: number;
}

export function resolveViewport(root: Node, nodes: Node[], edges: Edge[], properties: StringParameters): Viewport {
  let content = boundingRect([...nodes, ...edges]) ?? root;
  if (root.segmentedText) content = boundingRect([content, { x: content.x, y: root.y, w: content.w, h: 1 }])!;

  const horizontal = resolveAxis(root, content, properties, "x");
  const vertical = resolveAxis(root, content, properties, "y");
  const scale = readNumber(properties.scale) ?? 1;
  const intrinsicWidth = readNumber(properties.width) ?? horizontal.size * scale;
  const intrinsicScale = intrinsicWidth / horizontal.size;

  return {
    x: horizontal.start,
    y: vertical.start,
    width: horizontal.size,
    height: vertical.size,
    intrinsicWidth,
    intrinsicHeight: vertical.size * intrinsicScale,
  };
}

function resolveAxis(root: Rect, content: Rect, properties: StringParameters, axis: "x" | "y"): { start: number; size: number } {
  const AXES = {
    x: { size: "w", padding: "padx", scale: CHAR_WIDTH },
    y: { size: "h", padding: "pady", scale: CHAR_HEIGHT },
  } as const;

  const { size: sizeKey, padding: paddingKey, scale } = AXES[axis];
  const rootStart = root[axis];
  const rootSize = root[sizeKey];
  const contentStart = content[axis];
  const contentSize = content[sizeKey];
  const size = readNumber(properties[sizeKey]);
  const padding = readNumber(properties[paddingKey], true);

  if (size === undefined && padding === undefined) {
    return {
      start: rootStart * scale - DEFAULT_PADDING_PX,
      size: rootSize * scale + 2 * DEFAULT_PADDING_PX,
    };
  }

  if (size === undefined) {
    return {
      start: (contentStart - padding!) * scale,
      size: (contentSize + 2 * padding!) * scale,
    };
  }

  return {
    start: padding === undefined ? rootStart * scale - DEFAULT_PADDING_PX : (contentStart - padding) * scale,
    size: size * scale,
  };
}

function readNumber(raw: string | undefined, allowZero = false): number | undefined {
  const value = Number(raw);
  return Number.isFinite(value) && (value > 0 || (allowZero && value === 0)) ? value : undefined;
}
