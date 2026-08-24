import type { Node } from "../topos.ts";
import { EIDOS_VALUES } from "../eidos.ts";
import type { Rect } from "../geo.ts";
import { addAttrs, appendChild, type XmlEl } from "../jsonml/jsonml.ts";
import { type CoreAttrs, svgEl } from "../jsonml/svg.ts";
import { clsx, clsxSet } from "../clsx.ts";
import { calculateTextAlignment, renderFormattedLines } from "./alignment.ts";
import { animation, type MotionPath, rectMotionPath } from "./animation.ts";
import { addEidosClasses, compendiumAsset, entityStyle, injectLocalAssets, type Registry, resolveFilter } from "./svg.ts";
import { CHAR_HEIGHT, CHAR_WIDTH, nodeToRectPx, rectToPx } from "./geometry.ts";
import { renderEdge } from "./edge.ts";
import type { StackLayer } from "../stacked-box.ts";
import { resolveStackGeometry, stackLayerRectPx } from "./stacked-box.ts";

const DOUBLE_PADDING = 3;
type NodeLayer = StackLayer & { className?: string };
type Corner = typeof EIDOS_VALUES["corner"][number];
type Vertex = [number, number];
interface RenderedShape {
  element: XmlEl;
  motion?: MotionPath;
}

const ROUND_RADIUS_MAP: Partial<Record<Corner, number>> = {
  sharp: 0,
  tight: 4,
  rounded: 8,
  loose: 16,
  pill: 24,
};

export function renderNode(node: Node, parentGroup: XmlEl, registry: Registry) {
  const gClassSet = clsxSet("tp", "tp-node", `tp-${node.nodeType}`, node.classes);
  if (node.isGridCell) gClassSet.add("tp-grid-cell");
  addEidosClasses(gClassSet, node.eidos, registry);
  const layers = node.nodeType !== "root" && node.nodeType !== "note" ? resolveNodeLayers(node) : [];
  const nodeGroup = svgEl("g", {
    class: clsx(gClassSet),
    id: (node.id && node.id !== node.label) ? node.id : undefined,
  });
  appendChild(parentGroup, nodeGroup);

  // 2. Physical Shape (skipped for diagram root)
  const motion = layers.length > 0 ? renderNodeShape(node, nodeGroup, layers, registry) : undefined;
  const anime = animation(node, registry, motion);
  addAttrs(nodeGroup, { style: entityStyle(node, anime.style) });
  resolveFilter(nodeGroup, node.nodeType === "note" ? undefined : node.eidos?.effect, registry, anime.filterArgs);
  nodeGroup.push(...anime.particles);

  // 3. Text
  if (node.nodeType === "note") renderNote(node, nodeGroup, registry);
  else renderNodeLabel(node, nodeGroup, registry);

  // 4. Children Recursion
  for (const child of node.children) {
    renderNode(child, nodeGroup, registry);
  }

  // 5. Edges
  for (const edge of node.edges) {
    renderEdge(edge, nodeGroup, registry);
  }
}

function resolveNodeLayers(node: Node): NodeLayer[] {
  const rect = nodeToRectPx(node);
  const stackGeometry = resolveStackGeometry(node);
  const layers: NodeLayer[] = [];

  if (stackGeometry) {
    const lcount = stackGeometry.stack.layers;
    const facePx = rectToPx(stackGeometry.face);
    for (let i = 0; i < lcount; i++) {
      layers.push({
        ...stackLayerRectPx(facePx, stackGeometry.stack, i),
        index: i,
        isFace: i === lcount - 1,
        className: i === lcount - 1 ? "tp-opaque" : "tp-hollow",
      });
    }
  } else if (node.eidos?.weight === "double") {
    layers.push({ ...rect, className: "tp-transparent", isFace: false });
    layers.push({
      x: rect.x + DOUBLE_PADDING,
      y: rect.y + DOUBLE_PADDING,
      w: Math.max(0, rect.w - DOUBLE_PADDING * 2),
      h: Math.max(0, rect.h - DOUBLE_PADDING * 2),
      isFace: true,
    });
  } else {
    layers.push({ ...rect, isFace: true });
  }
  return layers;
}

function renderNodeShape(node: Node, container: XmlEl, layers: NodeLayer[], registry: Registry): MotionPath | undefined {
  const shapeEffect = node.eidos?.fill?.effect ?? node.eidos?.stroke?.effect;
  const pattern = node.eidos?.fill?.pattern ?? node.eidos?.pattern;
  const localPatternStyle = injectLocalAssets(container, pattern, registry);
  let faceMotion: MotionPath | undefined;
  for (const layer of layers) {
    const finalAttrs: CoreAttrs = {
      class: clsx("tp tpc-shape", layer.className),
    };

    // Apply pattern fill only to the "active" layer (top of stack or inner of double)
    if (layer.isFace && localPatternStyle) {
      finalAttrs.style = (finalAttrs.style ?? "") + localPatternStyle;
    }

    const shape = renderShapeGeometry(node, layer, finalAttrs, registry);
    if (layer.isFace) faceMotion = shape.motion;
    resolveFilter(shape.element, shapeEffect, registry);
    appendChild(container, shape.element);
  }
  return faceMotion;
}

function renderShapeGeometry(node: Node, rect: Rect, attrs: CoreAttrs, registry: Registry): RenderedShape {
  const { x, y, w, h } = rect;
  const symbolId = nodeSymbolId(node);
  const hasSymbol = symbolId && compendiumAsset(symbolId);
  if (hasSymbol) {
    registry.symbols.add(symbolId);
    return { element: svgEl("use", { ...attrs, x, y, width: w, height: h, href: `#${symbolId}` }) };
  }

  const corner = node.eidos?.corner;
  if (corner === "rhombus") return renderRhombus(rect, attrs);
  if (corner === "bevel") return renderBevel(rect, attrs);
  if (corner === "skew" || corner === "parallelogram") return renderSkew(rect, attrs);
  if (corner === "trapez") return renderTrapez(rect, attrs);

  const radius = Math.min(ROUND_RADIUS_MAP[corner ?? "sharp"] ?? 0, w / 2, h / 2);
  return renderRect(rect, radius, attrs);
}

function renderRect({ x, y, w, h }: Rect, radius: number, attrs: CoreAttrs): RenderedShape {
  const element = svgEl("rect", { ...attrs, x, y, width: w, height: h, rx: radius || undefined, ry: radius || undefined });
  if (!radius) return { element, motion: { path: rectMotionPath({ x, y, w, h }), pathLength: 2 * (w + h) } };
  return {
    element,
    motion: {
      path: `M ${x + radius},${y} H ${x + w - radius} A ${radius},${radius} 0 0 1 ${x + w},${y + radius} V ${y + h - radius} A ${radius},${radius} 0 0 1 ${
        x + w - radius
      },${y + h} H ${x + radius} A ${radius},${radius} 0 0 1 ${x},${y + h - radius} V ${y + radius} A ${radius},${radius} 0 0 1 ${x + radius},${y} Z`,
      pathLength: 2 * (w + h - 4 * radius) + 2 * Math.PI * radius,
    },
  };
}

function renderRhombus({ x, y, w, h }: Rect, attrs: CoreAttrs): RenderedShape {
  const diamondWidth = h * 9 * CHAR_WIDTH / (5 * CHAR_HEIGHT);
  const inset = Math.min(w / 2, diamondWidth / 2);
  return renderPolygon([[x, y + h / 2], [x + inset, y], [x + w - inset, y], [x + w, y + h / 2], [x + w - inset, y + h], [x + inset, y + h]], attrs);
}

function renderBevel({ x, y, w, h }: Rect, attrs: CoreAttrs): RenderedShape {
  const inset = Math.min(h / 4 + 1, w / 2, h / 2);
  return renderPolygon([
    [x + inset, y],
    [x + w - inset, y],
    [x + w, y + inset],
    [x + w, y + h - inset],
    [x + w - inset, y + h],
    [x + inset, y + h],
    [x, y + h - inset],
    [x, y + inset],
  ], attrs);
}

function renderSkew({ x, y, w, h }: Rect, attrs: CoreAttrs): RenderedShape {
  const inset = Math.min(h / 4 + 1, Math.max(0, w - 1));
  return renderPolygon([[x + inset, y], [x + w, y], [x + w - inset, y + h], [x, y + h]], attrs);
}

function renderTrapez({ x, y, w, h }: Rect, attrs: CoreAttrs): RenderedShape {
  const inset = Math.min(h / 4 + 1, Math.max(0, w / 2 - 1));
  return renderPolygon([[x + inset, y], [x + w - inset, y], [x + w, y + h], [x, y + h]], attrs);
}

function renderPolygon(vertices: Vertex[], attrs: CoreAttrs): RenderedShape {
  const points = vertices.map(([x, y]) => `${x},${y}`);
  let pathLength = 0;
  for (const [index, [x, y]] of vertices.entries()) {
    const [nextX, nextY] = vertices[(index + 1) % vertices.length];
    pathLength += Math.hypot(nextX - x, nextY - y);
  }
  return {
    element: svgEl("polygon", { ...attrs, points: points.join(" ") }),
    motion: { path: `M ${points.join(" L ")} Z`, pathLength },
  };
}

function nodeSymbolId(node: Node): string | undefined {
  return node.nodeType === "hub" ? `tpc-hub-${node.eidos?.marker ?? "dot"}` : (node.semanticType ? `tpc-sym-${node.semanticType}` : undefined);
}

function renderNodeLabel(node: Node, container: XmlEl, registry: Registry) {
  const lines = node.segmentedText;
  if (!lines?.length) return;
  const stackGeometry = resolveStackGeometry(node);
  const gridRect = stackGeometry?.face ?? node;
  const pxRect = node.nodeType === "hub" || node.isGridCell ? nodeToRectPx(node) : rectToPx(gridRect);
  const { text: textAttrs, tspan: tspanAttrs } = calculateTextAlignment(node, pxRect, gridRect);

  const textEl = svgEl("text", { class: "tp tpc-label", ...textAttrs });
  resolveFilter(textEl, node.eidos?.label?.effect, registry);
  textEl.push(...renderFormattedLines(lines, tspanAttrs));
  appendChild(container, textEl);
}

function renderNote(node: Node, container: XmlEl, registry: Registry) {
  const lines = node.segmentedText;
  if (!lines?.length) return;
  const parent = node.parent!;
  const { text: textAttrs, tspan: tspanAttrs } = calculateTextAlignment(node, rectToPx(parent), parent);

  const textEl = svgEl("text", { class: "tp tpc-label", ...textAttrs });
  resolveFilter(textEl, node.eidos?.label?.effect ?? node.eidos?.effect, registry);
  textEl.push(...renderFormattedLines(lines, tspanAttrs, (node.eidos?.noteMode ?? "prose") !== "prose"));
  appendChild(container, textEl);
}
