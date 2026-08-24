import { FormattedLine, Node } from "../topos.ts";
import { EidosAxes, textEidosValue } from "../eidos.ts";
import { parseUnitRatio } from "../legend/value.ts";
import { Rect } from "../geo.ts";
import { Child } from "../jsonml/jsonml.ts";
import { svgEl, TextAttrs, TspanAttrs } from "../jsonml/svg.ts";
import { CHAR_HEIGHT, CHAR_WIDTH } from "./geometry.ts";
import { EIDOS_PROPERTIES } from "../eidos.ts";

const SNAP_EPSILON = 1.0;
const SNAP_EPSILON_BOX_RATIO = 0.1;
const V_SNAP_EPSILON = 0.75;
export const INSET_PX = 10;

const DEFAULT_LEADING_PX = 16.8;
// Distance from the hanging baseline to the top of the first line of text.
const FIRST_LINE_ASCENT = 14;

type HAlign = "start" | "middle" | "end";
type VAlign = "hanging" | "middle" | "text-after-edge";

type Slot<A extends string> = { ratio: number; align: A; offset?: number };
type HSlot = Slot<HAlign>;
type VSlot = Slot<VAlign>;
type PositionProperty = typeof EIDOS_PROPERTIES.position[number];

// LabelAlignment is the return value from calculateTextAlignment.
// text  — spread directly onto the <text> SVG element.
// tspan — spread onto each <tspan> (undefined = tspans fully inherit from <text>).
export type LabelAlignment = {
  text: TextAttrs;
  tspan?: TspanAttrs;
};

// ─── Horizontal Slots ────────────────────────────────────────────────────────

const H_SLOTS = {
  center: { ratio: 0.5, align: "middle", names: ["center", "centre", "middle"] },
  left: { ratio: 0, align: "start", offset: INSET_PX, names: ["left", "start"] },
  right: { ratio: 1, align: "end", offset: -INSET_PX, names: ["right", "end"] },
  third: { ratio: 1 / 3, align: "middle", names: ["third", "1/3"] },
  twothirds: { ratio: 2 / 3, align: "middle", names: ["two-thirds", "twothirds", "2/3"] },
  quarter: { ratio: 0.25, align: "middle", names: ["quarter", "1/4"] },
  threequarters: { ratio: 0.75, align: "middle", names: ["three-quarters", "3/4"] },
} as const;

// Only l/c/r eligible for auto-snapping — fractions are explicit-only via eidos.
const H_SNAP_SLOTS: readonly HSlot[] = [H_SLOTS.center, H_SLOTS.left, H_SLOTS.right];

// Hub rawLabels sit OUTSIDE the hub — anchors are flipped relative to normal slots.
const H_SLOTS_HUB = {
  left: { ratio: 0, align: "end", offset: -INSET_PX, names: ["left", "start"] },
  right: { ratio: 1, align: "start", offset: INSET_PX, names: ["right", "end"] },
} as const;

const LINE_ANCHOR_MAP = {
  "align-left": "start",
  "align-center": "middle",
  "align-right": "end",
} as const;

// ─── Vertical Slots ──────────────────────────────────────────────────────────

const V_SLOTS = {
  ceiling: { ratio: 0, align: "hanging", offset: 3, names: ["ceiling"] },
  top: { ratio: 0, align: "hanging", offset: 9, names: ["top"] },
  middle: { ratio: 0.5, align: "middle", names: ["center", "centre", "middle"] },
  bottom: { ratio: 1, align: "text-after-edge", offset: -6, names: ["bottom"] },
} as const;

// Only top/middle/bottom eligible for auto-snapping — ceiling is handled separately.
const V_SNAP_SLOTS: readonly VSlot[] = [V_SLOTS.middle, V_SLOTS.top, V_SLOTS.bottom];

// ─── Property Helpers ────────────────────────────────────────────────────────

function prop(node: Node, name: PositionProperty): string | undefined {
  return node.properties?.[name];
}

/** Parse an explicit coordinate property value into a Slot configuration. */
function parseExplicitCoordinate<A extends HAlign | VAlign>(value: string | undefined, align: A, scale: number): Slot<A> | A | undefined {
  if (value === "map") return align;
  const parsed = value ? parseUnitRatio(value) : undefined;
  return parsed && (parsed.type === "ratio" ? { ratio: parsed.value, align } : { ratio: 0, align, offset: parsed.value * scale });
}

function textRect(node: Node): Rect | undefined {
  return node.nodeType === "note" ? node : node.rawLabels?.[0];
}

/** Maps HAlign to a left-edge factor: start=0, middle=0.5, end=1. */
function hAlignFactor(align: HAlign): number {
  return align === "start" ? 0 : align === "middle" ? 0.5 : 1;
}

export function lineAlignmentAttrs(textAlign: EidosAxes["textAlign"], fallback: HAlign, blockAnchor: HAlign, x: number, blockWidth: number): TspanAttrs {
  const lineAnchor = textAlign ? LINE_ANCHOR_MAP[textAlign] : fallback;
  return {
    x: x + (hAlignFactor(lineAnchor) - hAlignFactor(blockAnchor)) * blockWidth,
    "text-anchor": lineAnchor,
  };
}

/** Maps VAlign to a top-edge factor: hanging=0, middle=0.5, text-after-edge=1. */
function vAlignFactor(align: VAlign): number {
  return align === "hanging" ? 0 : align === "middle" ? 0.5 : 1;
}

/** Pixel height of a multi-line text block. */
function blockHeightPx(lineCount: number, leading: number): number {
  return (lineCount - 1) * leading + FIRST_LINE_ASCENT;
}

/**
 * Clamp a resolved HSlot so the label block doesn't overflow the px content area.
 * Only applied when horizontal position was auto-detected (not explicitly set).
 */
function clampHorizontal(h: HSlot, pxRect: Rect, blockWidthPx: number): HSlot {
  if (blockWidthPx > pxRect.w - 2 * INSET_PX) return h;

  const tempX = pxRect.x + h.ratio * pxRect.w + (h.offset ?? 0);
  const left = tempX - hAlignFactor(h.align) * blockWidthPx;
  const right = left + blockWidthPx;

  if (right > pxRect.x + pxRect.w - INSET_PX) return H_SLOTS.right;
  if (left < pxRect.x + INSET_PX) return H_SLOTS.left;
  return h;
}

function preservesAuthoredPosition(node: Node, vertical = false): boolean {
  if (borderedChildrenObstructAxis(node, vertical)) return true;
  if (node.nodeType !== "note") return false;
  const noteMode = node.eidos?.noteMode;
  const literal = noteMode === "code" || noteMode === "text";
  return !!(literal || node.links.length || node.parent?.nodeType === "root" ||
    vertical && (node.parent?.children.filter((child) => child.nodeType === "note").length ?? 0) > 1);
}

function borderedChildrenObstructAxis(node: Node, vertical: boolean): boolean {
  if (node.nodeType !== "box") return false;
  const label = textRect(node);
  if (!label) return false;
  if (vertical && (label.y === node.y || label.y === node.y + node.h - 1)) return false;
  if (!vertical) {
    const { mapCenter, mapWidth } = resolveMapMetricsH(node, node, true);
    const edge = snapHorizontal(node.w - 2, mapWidth, mapCenter)?.align;
    if (edge === "start" || edge === "end") return false;
  }

  return node.children.some((child) => {
    if (child.nodeType !== "box") return false;
    const [labelStart, labelEnd] = vertical ? [label.x, label.x + label.w] : [label.y, label.y + label.h];
    const [childStart, childEnd] = vertical ? [child.x, child.x + child.w] : [child.y, child.y + child.h];
    return labelStart < childEnd && childStart < labelEnd;
  });
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

// Calculate text alignment for a node's label.
// pxRect:  pixel-space rect to position text within
//          (for notes: the parent's px rect; for boxes: the face px rect).
// mapRect: grid-space rect of the label container face
//          (for notes: the parent node; for stacked boxes: the face, not total bounds).
export function calculateTextAlignment(node: Node, pxRect: Rect, mapRect: Rect): LabelAlignment {
  const container = (node.nodeType === "note") ? (node.parent ?? node) : node;
  const { width: blockWidthChars, lineCount } = measureText(node.segmentedText!);
  const horizontal = resolveHorizontal(node, container, mapRect, pxRect, blockWidthChars * CHAR_WIDTH);
  const vertical = resolveVertical(node, container, mapRect, pxRect, lineCount);
  return { text: { ...horizontal.text, ...vertical.text }, tspan: { ...horizontal.tspan, ...vertical.tspan } };
}

function resolveHorizontal(node: Node, container: Node, mapRect: Rect, pxRect: Rect, blockWidthPx: number): LabelAlignment {
  // 1. Explicit named slot (from eidos axis)
  const named = node.nodeType !== "hub"
    ? resolveExplicitNamed(textEidosValue(node, "Horizontal"), H_SLOTS)
    : resolveExplicitNamed(textEidosValue(node, "Horizontal"), H_SLOTS_HUB);
  // 2. Explicit coordinate offsets (center or left)
  const rect = textRect(node);
  const mapLeft = rect ? rect.x - mapRect.x : undefined;
  const mapCenter = rect ? rect.x - mapRect.x + rect.w / 2 : undefined;
  const mapRight = rect ? rect.x - mapRect.x + rect.w : undefined;
  const centerValue = parseExplicitCoordinate(prop(node, "center"), "middle", CHAR_WIDTH);
  const leftValue = parseExplicitCoordinate(prop(node, "left"), "start", CHAR_WIDTH);
  const rightValue = parseExplicitCoordinate(prop(node, "right"), "end", CHAR_WIDTH);

  const candidate = named ?? centerValue ?? leftValue ?? rightValue;
  let slot = typeof candidate === "object" ? candidate as HSlot : undefined;
  const mapMode = typeof candidate === "string" ? candidate : undefined;
  if (!slot && (mapMode || preservesAuthoredPosition(node))) {
    const align = mapMode ?? "start";
    const map = align === "middle" ? mapCenter : align === "end" ? mapRight : mapLeft;
    slot = { ratio: 0, align, offset: map! * CHAR_WIDTH };
  }

  if (!slot) {
    // Steps 3-5 are auto-detected and clamped to prevent overflow.
    if (node.nodeType === "inline") slot = H_SLOTS.center;
    else if (node.nodeType === "region") slot = H_SLOTS.left;
    else if (node.nodeType === "hub" && node.rawLabels?.[0]) {
      const primaryLabel = node.rawLabels[0];
      slot = primaryLabel.x + primaryLabel.w / 2 < node.x + node.w / 2 ? H_SLOTS_HUB.left : H_SLOTS_HUB.right;
    } else {
      const hasBorder = container.nodeType === "box";
      const { mapCenter, mapWidth } = resolveMapMetricsH(node, mapRect, hasBorder);
      const snapped = snapHorizontal(hasBorder ? mapRect.w - 2 : mapRect.w, mapWidth, mapCenter);
      slot = snapped ?? { ratio: labelCenterRatio(hasBorder ? mapCenter + 1 : mapCenter, mapWidth, mapRect.w), align: "middle" };
    }
    slot = clampHorizontal(slot, pxRect, blockWidthPx);
  }

  const x = pxRect.x + slot.ratio * pxRect.w + (slot.offset ?? 0);
  const tspan = lineAlignmentAttrs(textEidosValue(node, "Align"), node.nodeType === "note" ? "start" : "middle", slot.align, x, blockWidthPx);
  return { text: { x, "text-anchor": slot.align }, tspan };
}

function resolveVertical(node: Node, container: Node, mapRect: Rect, pxRect: Rect, lineCount: number): LabelAlignment {
  // 1. Explicit named slot (from eidos axis)
  const named = resolveExplicitNamed(textEidosValue(node, "Vertical"), V_SLOTS);
  // 2. Explicit coordinate offsets (middle or top)
  const rect = textRect(node);
  const mapTop = (rect ? rect.y - mapRect.y : undefined) ?? 0;
  const mapMiddle = (rect ? rect.y - mapRect.y + rect.h / 2 : undefined) ?? 0;

  const topValue = parseExplicitCoordinate(prop(node, "top"), "hanging", CHAR_HEIGHT);
  const middleValue = parseExplicitCoordinate(prop(node, "middle"), "middle", CHAR_HEIGHT);
  const leadingValue = prop(node, "leading");
  const preserved = preservesAuthoredPosition(node);
  const leading = leadingValue ? Number(leadingValue) * CHAR_HEIGHT : preserved ? CHAR_HEIGHT : DEFAULT_LEADING_PX;
  const tspan_dy = leadingValue || preserved ? `${leading}px` : "1.2em";
  const blockHeight = blockHeightPx(lineCount, leading);
  const mapLine = rect ? rect.y - mapRect.y : 0;
  const candidate = named ?? topValue ?? middleValue;
  let slot = typeof candidate === "object" ? candidate as VSlot : undefined;
  const mapMode = typeof candidate === "string" ? candidate : undefined;
  if (!slot && (mapMode || preservesAuthoredPosition(node, true))) {
    const align = mapMode ?? (node.nodeType === "box" ? "hanging" : "middle");
    const map = align === "middle" ? mapMiddle : mapTop;
    slot = { ratio: 0, align, offset: map * CHAR_HEIGHT };
  }

  if (!slot) {
    if (node.nodeType === "inline") slot = V_SLOTS.middle;
    else if (node.nodeType === "region") slot = V_SLOTS.top;
    else slot = resolveVerticalFromMapLine(container, mapRect.h, mapLine, rect?.h ?? 1, blockHeight);
  }

  const y = pxRect.y + slot.ratio * pxRect.h + (slot.offset ?? 0) - vAlignFactor(slot.align) * blockHeight;
  return { text: { y, "dominant-baseline": "hanging" }, tspan: { dy: tspan_dy } };
}

function resolveVerticalFromMapLine(container: Node, mapH: number, mapLine: number, textMapH: number, bh: number): VSlot {
  const hasBorder = container.nodeType === "box";

  // Label on top border row → ceiling (inside box, offset 9)
  if (hasBorder && mapLine === 0) return V_SLOTS.ceiling;

  // Label on bottom border row → bottom (inside box, offset -6)
  if (hasBorder && mapLine === mapH - 1) return V_SLOTS.bottom;

  const top = hasBorder ? Math.min(mapH - 1, 1) : 0;
  const bottom = hasBorder ? Math.max(top, mapH - 2) : Math.max(0, mapH - 1);
  const contentHeight = bottom + 1 - top;

  function slotDistance(slot: VSlot): number {
    // Compare the corresponding text and content point for this slot:
    // top edge, middle, or bottom edge.
    const textPoint = mapLine + textMapH * slot.ratio;
    const contentPoint = top + contentHeight * slot.ratio;
    return Math.abs(textPoint - contentPoint);
  }

  const middleDistance = slotDistance(V_SLOTS.middle);
  if (Math.floor(middleDistance) === 0) return V_SLOTS.middle;

  let nearest: VSlot | undefined;
  let nearestDistance = Infinity;
  for (const slot of V_SNAP_SLOTS) {
    const distance = slotDistance(slot);
    if (distance <= V_SNAP_EPSILON && distance < nearestDistance) {
      nearest = slot;
      nearestDistance = distance;
    }
  }
  if (nearest) return nearest;

  const textBottom = mapLine * CHAR_HEIGHT + (V_SLOTS.top.offset ?? 0) + bh;
  const boxBottom = mapH * CHAR_HEIGHT + (V_SLOTS.bottom.offset ?? 0);
  if (textBottom > boxBottom) return V_SLOTS.bottom;

  // Free ratio: map label center (mapLine + 0.5) onto [0,1] within the content band.
  return {
    ratio: labelCenterRatio(mapLine + 0.5, 1, mapH),
    align: "middle",
  };
}

// ─── Map Metrics ─────────────────────────────────────────────────────────────

function resolveMapMetricsH(node: Node, mapRect: Rect, hasBorder: boolean): { mapCenter: number; mapWidth: number } {
  const mapTrace = textRect(node);

  if (!mapTrace) return { mapCenter: mapRect.w / 2, mapWidth: 0 };

  // Measure position relative to inner content area (box left border excluded).
  const innerLeft = hasBorder ? mapRect.x + 1 : mapRect.x;
  return {
    mapCenter: mapTrace.x - innerLeft + mapTrace.w / 2,
    mapWidth: mapTrace.w,
  };
}

function snapHorizontal(containerWidth: number, labelWidth: number, actualCenter: number): HSlot | undefined {
  const epsilon = SNAP_EPSILON + containerWidth * SNAP_EPSILON_BOX_RATIO;
  const labelLeft = actualCenter - labelWidth / 2;

  function slotDistance(slot: HSlot): number {
    // Compare the corresponding label and container point for this slot:
    // left edge, center, or right edge.
    const labelPoint = labelLeft + labelWidth * slot.ratio;
    const containerPoint = containerWidth * slot.ratio;
    return Math.abs(labelPoint - containerPoint);
  }

  const centerDistance = slotDistance(H_SLOTS.center);
  if (Math.floor(centerDistance) === 0) return H_SLOTS.center;

  let nearest: HSlot | undefined;
  let nearestDistance = Infinity;
  for (const slot of H_SNAP_SLOTS) {
    const distance = slotDistance(slot);
    if (distance <= epsilon && distance < nearestDistance) {
      nearest = slot;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function resolveExplicitNamed<A extends { readonly names: readonly string[] }>(value: string | undefined, slots: Record<string, A>) {
  return Object.values(slots).find(({ names }) => names.includes(value ?? ""));
}

function projectToUnit(value: number, min: number, max: number): number {
  return max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Map a label's center position to a [0,1] ratio within a container of width `size`,
 * clamped so the label (half-width = labelHalf) stays inside.
 * Equivalent to projectToUnit(center, labelHalf, max(labelHalf, size - labelHalf)).
 */
function labelCenterRatio(center: number, labelWidth: number, size: number): number {
  const labelHalf = labelWidth / 2;
  return projectToUnit(center, labelHalf, Math.max(labelHalf, size - labelHalf));
}

/** Measure the proportional character width and line count of a label string or formatted segments. */
export function measureText(text: FormattedLine[] | string): { width: number; lineCount: number } {
  if (typeof text === "string") {
    text = [[{ text }]];
  }
  let width = 0;
  for (const line of text) {
    let w = 0;
    for (const seg of line) {
      for (const char of seg.text) {
        let charW = 0.7;
        if (!seg.code) {
          charW = 0.486;
          if (/[A-Z0-9@#$]/.test(char)) {
            charW = 0.66;
          } else if (/[iljtrf!.,;:()\s]/.test(char)) {
            charW = 0.347;
          }
        }
        w += charW * (seg.bold ? 1.1 : 1);
      }
      w += seg.paragraph ? 1 : 0;
    }
    if (w > width) width = w;
  }
  return { width, lineCount: text.length };
}

export function renderFormattedLineSegments(line: FormattedLine, preserveSpaces = false): Child[] {
  return line.map((seg) => {
    const text = preserveSpaces ? seg.text.replaceAll(" ", "\u00a0") : seg.text;
    const inlineCode = seg.code && !preserveSpaces;
    const attrs: TspanAttrs = {};
    if (seg.bold) attrs["font-weight"] = "bold";
    if (seg.italic) attrs["font-style"] = "italic";
    if (seg.strike) attrs["text-decoration"] = "line-through";
    if (inlineCode) attrs["class"] = "tp-mono";
    if (seg.paragraph) attrs["dx"] = 10;
    if (seg.href) {
      attrs["class"] = [attrs["class"], "tpc-link-text"].filter(Boolean).join(" ");
      return svgEl("a", { href: seg.href, class: "tpc-link" }, svgEl("tspan", attrs, text));
    }
    return Object.keys(attrs).length > 0 ? svgEl("tspan", attrs, text) : text;
  });
}

export function renderFormattedLines(lines: FormattedLine[], tspanAttrs?: TspanAttrs, preserveSpaces = false): Child[] {
  if (lines.length === 1) return renderFormattedLineSegments(lines[0], preserveSpaces);
  return lines.map((line, i) => svgEl("tspan", { ...tspanAttrs, dy: i ? tspanAttrs?.dy ?? "1.2em" : 0 }, ...renderFormattedLineSegments(line, preserveSpaces)));
}
