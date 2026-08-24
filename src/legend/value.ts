export type ParsedValue = { type: "ratio" | "absolute"; value: number };

/** Parse a legend-style coordinate value into a ratio or an absolute grid offset. */
export function parseUnitRatio(raw: string): ParsedValue | undefined {
  const value = raw.trim();
  if (!value) return undefined;

  if (value.endsWith("%")) {
    const percent = Number(value.slice(0, -1));
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      return { type: "ratio", value: percent / 100 };
    }
    return undefined;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return { type: "absolute", value: numeric };
  }
  return undefined;
}
