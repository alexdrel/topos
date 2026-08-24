export const EIDOS_VALUES = {
  color: ["ink", "black", "gray", "red", "orange", "yellow", "green", "blue", "purple", "white"],
  intensity: ["tint", "none", "ghost", "soft", "strong", "heavy", "solid"],
  pattern: ["no-pattern", "hatch", "backhatch", "crosshatch", "stripes"],
  effect: ["no-effect", "xkcd", "sketch", "chalk", "shadow", "glow", "neon"],
  weight: ["single", "bold", "double", "dashed", "dotted"],
  edgeBody: ["standard-body", "block"],
  edgeRoute: ["path", "ray", "taut"],
  attachment: ["no-gap", "gap", "s-gap", "m-gap", "l-gap"],
  layering: ["flat", "stack"],
  corner: ["sharp", "tight", "rounded", "loose", "pill", "rhombus", "bevel", "skew", "parallelogram", "trapez"],
  noteMode: ["prose", "text", "code"],
  animation: ["static", "animate", "animate-reverse"],
  particle: ["no-particle", "spark", "ping", "chevron", "packet"],
  marker: [
    "no-marker",
    "end-cap",
    "arrow",
    "crowfoot",
    "triangle",
    "triangle-hollow",
    "dart",
    "dart-hollow",
    "angle",
    "double-arrow",
    "dot",
    "circle",
    "diamond",
    "square",
    "square-hollow",
    "circle-dot",
    "diamond-hollow",
    "hexagon",
  ],
  // layout
  textHorizontal: ["center", "left", "right", "start", "end", "third", "two-thirds", "twothirds", "1/3", "2/3", "quarter", "three-quarters", "1/4", "3/4"],
  textVertical: ["middle", "top", "bottom", "ceiling"],
  textAlign: ["align-left", "align-center", "align-right"],
} as const;

/**
 * Properties accept free-form values, but every property consumed by Topos
 * must be registered here. Accepted values remain documented by the consumer
 * until they justify a shared value vocabulary.
 */
export const EIDOS_PROPERTIES = {
  // "slow", "fast", or a non-negative numeric speed multiplier.
  animation: ["animation-speed"],

  // Positive counts/scales, percentage phase/balance, or stable random seed.
  particle: ["particle-count", "particle-density", "particle-scale", "particle-phase", "particle-random", "particle-balance"],

  // "layers[,dx,dy]"; zero removes an authored stack.
  stack: ["stack"],

  // URL assigned to the entity and resolved links.
  link: ["href"],

  // CSS font family and weight values.
  typography: ["font", "font-weight"],

  // Exact CSS/SVG paints that bypass Eidos palette mixing.
  paint: ["fill-color", "stroke-color", "label-color"],

  // Map coordinates, percentages, "map", and numeric line leading.
  position: ["left", "center", "right", "top", "middle", "leading"],
} as const;

export type MarkerValue = typeof EIDOS_VALUES["marker"][number];

export type EidosAxis = keyof typeof EIDOS_VALUES;
export type EidosValue = typeof EIDOS_VALUES[EidosAxis][number];

export type EidosAxes = { [K in EidosAxis]?: typeof EIDOS_VALUES[K][number] };

export type EidosPropertyAxis = keyof typeof EIDOS_PROPERTIES;
export type EidosPropertyKey = typeof EIDOS_PROPERTIES[EidosPropertyAxis][number];

export const SCOPE_NAMES = ["fill", "stroke", "label", "head", "tail"] as const;
export type EidosScope = typeof SCOPE_NAMES[number];
export const EIDOS_SCOPES = new Set<EidosScope>(SCOPE_NAMES);

export type EidosMap = EidosAxes & { [K in EidosScope]?: EidosAxes };

export function textEidosValue<A extends "Horizontal" | "Vertical" | "Align">(entity: { eidos?: EidosMap }, axis: A): EidosAxes[`text${A}`] {
  const key = `text${axis}` as const;
  return entity.eidos?.label?.[key] ?? entity.eidos?.[key];
}

export const VALUE_TO_AXIS = new Map<string, EidosAxis>();
export const EIDOS_PROPERTY_TO_AXIS = new Map<EidosPropertyKey, EidosPropertyAxis>();

for (const [axis, values] of Object.entries(EIDOS_VALUES)) {
  for (const value of values) {
    VALUE_TO_AXIS.set(value, axis as EidosAxis);
  }
}

for (const [axis, keys] of Object.entries(EIDOS_PROPERTIES)) {
  for (const key of keys) EIDOS_PROPERTY_TO_AXIS.set(key, axis as EidosPropertyAxis);
}

export function isEidosPropertyKey(value: string): value is EidosPropertyKey {
  return EIDOS_PROPERTY_TO_AXIS.has(value as EidosPropertyKey);
}
