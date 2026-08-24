import { Dir, Direction, DIRS } from "../geo.ts";
import { GLYPHS, isCornerMask, spec, TEXT_CONTROL_GLYPHS, Trait, weightFor } from "../grammar.ts";
import { PenStyle, PenWeight } from "../style.ts";

export interface Cell extends Omit<Partial<PenStyle>, "weight"> {
  mask: Dir;
  weight?: Partial<Record<Direction, PenWeight>>;
  char?: string;
  role?: ProjectionRole;
}

export const PROJECTION_ROLES = ["box", "line", "mixed", "text", "inline", "glyph", "control"] as const;
export type ProjectionRole = typeof PROJECTION_ROLES[number];
type GeometryRole = "box" | "line";

export interface ProjectionSpan {
  start: number;
  end: number;
  role: ProjectionRole;
}

export interface GridProjection {
  lines: string[];
  spans: ProjectionSpan[];
}

const TEXT_CONTROLS = new Set<string>(TEXT_CONTROL_GLYPHS);

const MASK_MAP: string[] = Object.entries(GLYPHS)
  .filter(([_glyph, glyphSpec]) => (glyphSpec.trait & Trait.Wire) && glyphSpec.mask)
  .reduce((list, [glyph, glyphSpec]) => {
    list[glyphSpec.mask!] += glyph;
    return list;
  }, Array<string>(16).fill(""));

/**
 * A 2D buffer that accumulates geometry (masks), styles, and text characters.
 * Final resolution of characters happens during the rendering pass using the grammar.
 */
export class ProjectionGrid {
  private cells: Cell[];

  constructor(public w: number, public h: number, public offsetX: number, public offsetY: number) {
    const size = w * h;
    this.cells = Array.from({ length: size }, () => ({ mask: 0 }));
  }

  private idx(x: number, y: number): number {
    const px = x + this.offsetX;
    const py = y + this.offsetY;
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return -1;
    return py * this.w + px;
  }

  getMask(x: number, y: number): Dir {
    const i = this.idx(x, y);
    if (i === -1) return 0;
    return this.cells[i].mask;
  }

  /** ORs a bitmask into the grid, preserving existing connections. */
  addMask(x: number, y: number, mask: Dir, style?: Partial<PenStyle> & { trait?: Trait }, role?: GeometryRole): void {
    const i = this.idx(x, y);
    if (i === -1) return;

    const cell = this.cells[i];
    cell.mask |= mask;
    if (role) {
      cell.role = cell.role && cell.role !== role ? "mixed" : role;
    }

    if (style) {
      if (style.family) cell.family = style.family;
      if (style.corner) cell.corner = style.corner;
      if (style.weight) {
        if (!cell.weight) cell.weight = {};
        for (const dir of DIRS) {
          if (mask & dir) cell.weight[dir] = style.weight;
        }
      }
    }
  }

  glyphFor(cell: Cell): string {
    const { mask, weight = {}, family, corner, char } = cell;
    if (char) return char;
    if (mask === 0) return " ";

    const candidates = MASK_MAP[mask] || "";
    let bestGlyph: string | undefined;
    let maxScore = -1;

    for (const glyph of candidates) {
      const s = spec(glyph);

      // Strict family matching for ASCII or prioritized matching for others
      if (family === "ascii" && s.family !== "ascii") continue;

      let score = 0;
      // 1. Family (Primary preference)
      if (s.family === "unicode") score += 100;

      // 2. Weight (Secondary, per present direction)
      for (const dir of DIRS) {
        if ((mask & dir) && (weightFor(s, dir) === (weight[dir] ?? "single"))) score += 10;
      }

      // 3. Corner (Tertiary)
      if (isCornerMask(mask) && (s.corner === (corner ?? "sharp"))) score += 10;

      if (score > maxScore) {
        [maxScore, bestGlyph] = [score, glyph];
      }
    }

    return bestGlyph ?? "+";
  }

  setText(x: number, y: number, text: string, role?: ProjectionRole): void {
    for (let j = 0; j < text.length; j++) {
      const i = this.idx(x + j, y);
      if (i !== -1) {
        this.cells[i].char = text[j];
        if (role) this.cells[i].role = role === "text" && (text[j] === "#" || TEXT_CONTROLS.has(text[j])) ? "control" : role;
      }
    }
  }

  project(): GridProjection {
    const lines: string[] = [];
    for (let y = 0; y < this.h; y++) {
      let line = "";
      for (let x = 0; x < this.w; x++) {
        const cell = this.cells[y * this.w + x];
        line += this.glyphFor(cell);
      }
      lines.push(line.trimEnd());
    }
    while (lines.at(-1) === "") lines.pop();

    const spans: ProjectionSpan[] = [];
    let lineStart = 0;
    for (let y = 0; y < lines.length; y++) {
      const line = lines[y];
      let spanStart = 0;
      while (spanStart < line.length) {
        const role = this.cells[y * this.w + spanStart].role;
        let spanEnd = spanStart + 1;
        while (spanEnd < line.length && this.cells[y * this.w + spanEnd].role === role) spanEnd++;
        if (role) spans.push({ start: lineStart + spanStart, end: lineStart + spanEnd, role });
        spanStart = spanEnd;
      }
      lineStart += line.length + (y < lines.length - 1 ? 1 : 0);
    }

    return { lines, spans };
  }
}
