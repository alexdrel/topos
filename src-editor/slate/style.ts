import { TraceBox } from "../../src/trace/types.ts";
import { PenCorner, PenFamily, PenStyle, PenWeight } from "../../src/style.ts";

export type SelectionStyles = {
  [K in keyof PenStyle]: Set<PenStyle[K]>;
};

/** Detect style distributions for selection in a single pass */
export function detectSelectionStyles(selection: TraceBox[]): SelectionStyles {
  const family = new Set<PenFamily>();
  const corner = new Set<PenCorner>();
  const weight = new Set<PenWeight>();

  for (const t of selection) {
    if (t.style) {
      family.add(t.style.family);
      corner.add(t.style.corner);
      weight.add(t.style.weight);
    }
  }
  return { family, corner, weight };
}

/** Get active/mixed state of a specific value in a set as a scalar */
export function getValState<T>(set: Set<T>, val: T): "active" | "mixed" | null {
  if (set.size === 1 && set.has(val)) return "active";
  if (set.size > 1 && set.has(val)) return "mixed";
  return null;
}
