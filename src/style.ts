import { spec, Trait } from "./grammar.ts";
import { Dir } from "./geo.ts";

export type Glyph = string;

// ─── Pen Style ────────────────────────────────────────────────────────────────

/** Pen family: ASCII art (+--+) vs Unicode box-drawing (┌──┐) */
export type PenFamily = "ascii" | "unicode";

/** Pen weight / dash pattern:
 *  single  ─  standard thin line
 *  bold    ━  heavy line (┏━┓)
 *  double  ═  double line (╔═╗)
 *  dashed  ┄  dashed line
 *  dotted  ┈  dotted line
 */
export type PenWeight = "single" | "bold" | "double" | "dashed" | "dotted";

/** Corner shape: sharp (┌) or rounded (╭) */
export type PenCorner = "sharp" | "rounded";

/**
 * Composable pen style — used by both nodes (border) and edges (line).
 * Extensible base: Annotate layer can add color, fill, opacity etc.
 * `undefined` means no visible border/stroke (notes, root, hubs).
 */
export interface PenStyle {
  family: PenFamily;
  weight: PenWeight;
  corner: PenCorner;
}

export const DEFAULT_PEN: PenStyle = { family: "unicode", weight: "single", corner: "sharp" };
export const ASCII_PEN: PenStyle = { family: "ascii", weight: "single", corner: "sharp" };

export function inferPenStyle(chars: Iterable<string>): PenStyle {
  const style: Partial<PenStyle> = {};
  const better = <T>(cur: T | undefined, next: T | undefined, base: T): boolean => {
    return next !== undefined && (!cur || next !== base);
  };

  const wires = [...chars].map(spec).filter((s) => s.family && s.trait & Trait.Wire);
  for (const s of wires) {
    if (better(style.family, s.family, "ascii")) style.family = s.family;
    if (better(style.corner, s.corner, "sharp")) style.corner = s.corner;
  }

  const straight = wires.filter((s) => s.mask === Dir.Horizontal || s.mask === Dir.Vertical);
  for (const s of straight.length ? straight : wires) {
    if (better(style.weight, s.uniWeight, "single")) style.weight = s.uniWeight;
  }

  return { ...DEFAULT_PEN, ...style };
}

export function normalizePenStyle(style: PenStyle): PenStyle {
  if (style.family === "ascii") {
    return {
      ...style,
      corner: "sharp",
      weight: style.weight === "double" ? "double" : "single",
    };
  }
  return style;
}
