import { Dir } from "./geo.ts";
import { Glyph, PenStyle, PenWeight } from "./style.ts";
import type { MarkerValue } from "./eidos.ts";

export const OOB = "@@";
export const TEXT_CONTROL_GLYPHS = ["⏎", "↵", "¶", "␠", "⍽"] as const;

export enum Trait {
  Void = 0,
  Wire = 1, // Structural line / border
  Text = 1 << 1, // Alphanumeric content
  Arrow = 1 << 2, // Terminators
  Brace = 1 << 3, // Paired Delimiters [ ( < {
  Space = 1 << 4, // Whitespace
  Hub = 1 << 5, // Junctions/Centers
  Link = Wire | Arrow | Hub,
}

/** Per-direction weight map.
 *  Keys are Dir bitmasks (e.g. Dir.Horizontal, Dir.S) — composite keys cover multiple arms.
 *  For uniform wires the key equals the mask:  ─ → { [Dir.Horizontal]: 'single' }
 *  For mixed junctions arms split:             ┯ → { [Dir.Horizontal]: 'bold', [Dir.S]: 'single' }
 */
export type DirWeight = Partial<Record<Dir, PenWeight>>;

export interface GlyphSpec extends Omit<Partial<PenStyle>, "weight"> {
  trait: Trait;
  mask?: Dir;
  // corner is set only on actual corner masks (2-arm L-shapes)
  weight?: DirWeight;
  uniWeight?: PenWeight;
  close?: string;
  dirs?: Partial<Record<Dir, Glyph>>;
  /** Marker name for hub glyphs (●○◆◇□■◎). */
  marker?: MarkerValue;
}

export const GLYPHS: Record<string, GlyphSpec> = {};

/** Resolve the weight for a single direction bit from a GlyphSpec. */
export function weightFor(s: GlyphSpec, dir: Dir): PenWeight | undefined {
  if (s.weight) {
    for (const [bitsStr, weight] of Object.entries(s.weight)) {
      if ((+bitsStr) & dir) return weight as PenWeight;
    }
  }
  return undefined;
}

/** Is this mask a two-arm L-shape (corner)? */
export function isCornerMask(mask: number): boolean {
  return mask === Dir.BR || mask === Dir.BL || mask === Dir.TR || mask === Dir.TL;
}

/** Is this mask a 3-way T-junction? */
export function isTJunction(mask: number): boolean {
  const nmask = mask ^ Dir.All;
  return nmask === Dir.E || nmask === Dir.W || nmask === Dir.N || nmask === Dir.S;
}

/** Merge a base weight with an optional per-direction override into a single DirWeight.
 *  If an override is present, it splits the mask into two weight groups. */
function buildWeight(mask: number, baseWeight: PenWeight, [oMask, oWeight]: [Dir, PenWeight?] = [Dir.None]): DirWeight {
  const res: DirWeight = { [mask & ~oMask]: baseWeight };
  const ovr = mask & oMask;
  if (ovr) res[ovr as Dir] = oWeight;
  return res;
}

function def(chars: string, mask: number, trait: Trait, style?: Partial<PenStyle>, options: {
  close?: string;
  override?: [Dir, PenWeight];
  dirs?: Partial<Record<Dir, Glyph>>;
  marker?: MarkerValue;
} = {}) {
  const { close, override, dirs, marker } = options;
  const family = style?.family;
  const corner = (style?.corner && isCornerMask(mask)) ? style.corner : undefined;
  const weight = (style?.weight) ? buildWeight(mask, style.weight, override) : undefined;
  const uniWeight = override === undefined ? style?.weight : undefined;

  for (const c of chars) {
    const entry: GlyphSpec = { trait, mask, family, corner, weight, close, uniWeight, dirs, marker };
    GLYPHS[c] = entry;
  }
}

function defArrows(id: MarkerValue, charsList: [string, string, string, string], style?: Partial<PenStyle>) {
  const dirs: Partial<Record<Dir, Glyph>> = {
    [Dir.W]: charsList[0][0], // Right-pointing arrow -> tail W
    [Dir.E]: charsList[1][0], // Left-pointing arrow -> tail E
    [Dir.N]: charsList[2][0], // Down-pointing arrow -> tail N
    [Dir.S]: charsList[3][0], // Up-pointing arrow -> tail S
  };

  def(charsList[0], Dir.W, Trait.Arrow, style, { marker: id, dirs });
  def(charsList[1], Dir.E, Trait.Arrow, style, { marker: id, dirs });
  def(charsList[2], Dir.N, Trait.Arrow, style, { marker: id, dirs });
  def(charsList[3], Dir.S, Trait.Arrow, style, { marker: id, dirs });
}

// ─── defGrid ───────────────────────────────────────────────────────────────────
function maskForPos(row: number, col: number): number {
  const masks: number[][] = [
    [Dir.BR, Dir.E | Dir.W, Dir.BR | Dir.W, Dir.BL],
    [Dir.N | Dir.S, 0, Dir.N | Dir.S, Dir.N | Dir.S],
    [Dir.TR | Dir.S, Dir.E | Dir.W, Dir.All, Dir.TL | Dir.S],
    [Dir.TR, Dir.E | Dir.W, Dir.TR | Dir.W, Dir.TL],
  ];
  return masks[row]?.[col] ?? 0;
}

function defGrid(block: string, style: PenStyle): void {
  const family = style.family;
  const rows = block.split("\n").filter((r) => r.trim() !== "");
  for (let row = 0; row < rows.length; row++) {
    const glyphs = rows[row];
    for (let col = 0; col < glyphs.length; col++) {
      const c = glyphs[col];
      const mask = maskForPos(row, col);
      if (c === " " || mask === 0) continue;
      const corner = isCornerMask(mask) ? style.corner : undefined;
      const weight = buildWeight(mask, style.weight);

      GLYPHS[c] = { trait: Trait.Wire, mask, family, corner, weight, uniWeight: style.weight };
    }
  }
}

const ASCII_STYLE = { family: "ascii", weight: "single" } as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ASCII
// ───────────────────────────────────────────────────────────────────────────────
// ┌─── Complete set ───────────────────────────────────────────────────────────┐
// │  +--+    +  acts as TL, TR, BL, BR corner AND junction AND cross          │
// │  |  |    -  horizontal wire                                                │
// │  +--+    |  vertical wire                                                  │
// │          =  horizontal, double-weight                                      │
// └────────────────────────────────────────────────────────────────────────────┘
// + acts as Corner, Junction, Cross.
def("+", Dir.All, Trait.Wire | Trait.Text, ASCII_STYLE);
def("-", Dir.E | Dir.W, Trait.Wire | Trait.Text, ASCII_STYLE);
def("=", Dir.E | Dir.W, Trait.Wire | Trait.Text, { ...ASCII_STYLE, weight: "double" });
def("|", Dir.N | Dir.S, Trait.Wire | Trait.Text, ASCII_STYLE);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Unicode Single (thin)
// ───────────────────────────────────────────────────────────────────────────────
const UNI = { family: "unicode", weight: "single", corner: "sharp" } as const;

defGrid(
  `
┌─┬┐
│ ││
├─┼┤
└─┴┘`,
  UNI,
);

// Single-direction stubs (terminals)
def("╷", Dir.S, Trait.Wire, UNI);
def("╵", Dir.N, Trait.Wire, UNI);
def("╶", Dir.E, Trait.Wire, UNI);
def("╴", Dir.W, Trait.Wire, UNI);

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Unicode Bold (heavy)
// ───────────────────────────────────────────────────────────────────────────────
const BOLD = { family: "unicode", weight: "bold", corner: "sharp" } as const;

defGrid(
  `
┏━┳┓
┃ ┃┃
┣━╋┫
┗━┻┛`,
  BOLD,
);

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Unicode Double
// ───────────────────────────────────────────────────────────────────────────────
const DBL = { family: "unicode", weight: "double", corner: "sharp" } as const;

defGrid(
  `
╔═╦╗
║ ║║
╠═╬╣
╚═╩╝`,
  DBL,
);

// ═══════════════════════════════════════════════════════════════════════════════
// 4.5 Mixed-Weight Junctions
// ───────────────────────────────────────────────────────────────────────────────

// Bold-Single
def("┍", Dir.BR, Trait.Wire, BOLD, { override: [Dir.S, "single"] });
def("┎", Dir.BR, Trait.Wire, BOLD, { override: [Dir.E, "single"] });
def("┑", Dir.BL, Trait.Wire, BOLD, { override: [Dir.S, "single"] });
def("┒", Dir.BL, Trait.Wire, BOLD, { override: [Dir.W, "single"] });
def("┕", Dir.TR, Trait.Wire, BOLD, { override: [Dir.N, "single"] });
def("┖", Dir.TR, Trait.Wire, BOLD, { override: [Dir.E, "single"] });
def("┙", Dir.TL, Trait.Wire, BOLD, { override: [Dir.N, "single"] });
def("┚", Dir.TL, Trait.Wire, BOLD, { override: [Dir.W, "single"] });

def("┝", Dir.N | Dir.S | Dir.E, Trait.Wire, BOLD, { override: [Dir.Vertical, "single"] });
def("┠", Dir.N | Dir.S | Dir.E, Trait.Wire, BOLD, { override: [Dir.E, "single"] });
def("┞", Dir.N | Dir.S | Dir.E, Trait.Wire, BOLD, { override: [Dir.S, "single"] });
def("┟", Dir.N | Dir.S | Dir.E, Trait.Wire, BOLD, { override: [Dir.N, "single"] });
def("┡", Dir.N | Dir.S | Dir.E, Trait.Wire, BOLD, { override: [Dir.TR, "single"] });
def("┢", Dir.N | Dir.S | Dir.E, Trait.Wire, BOLD, { override: [Dir.BR, "single"] });

def("┨", Dir.N | Dir.S | Dir.W, Trait.Wire, BOLD, { override: [Dir.W, "single"] });
def("┧", Dir.N | Dir.S | Dir.W, Trait.Wire, BOLD, { override: [Dir.S, "single"] });
def("┯", Dir.Horizontal | Dir.S, Trait.Wire, BOLD, { override: [Dir.S, "single"] });
def("┷", Dir.Horizontal | Dir.N, Trait.Wire, BOLD, { override: [Dir.N, "single"] });

def("┿", Dir.All, Trait.Wire, BOLD, { override: [Dir.Vertical, "single"] });
def("╂", Dir.All, Trait.Wire, BOLD, { override: [Dir.Horizontal, "single"] });

// Double-Single
def("╢", Dir.N | Dir.S | Dir.W, Trait.Wire, DBL, { override: [Dir.W, "single"] });
def("╟", Dir.N | Dir.S | Dir.E, Trait.Wire, DBL, { override: [Dir.E, "single"] });
def("╤", Dir.Horizontal | Dir.S, Trait.Wire, DBL, { override: [Dir.S, "single"] });
def("╥", Dir.Horizontal | Dir.S, Trait.Wire, DBL, { override: [Dir.Horizontal, "single"] });
def("╧", Dir.Horizontal | Dir.N, Trait.Wire, DBL, { override: [Dir.N, "single"] });
def("╨", Dir.Horizontal | Dir.N, Trait.Wire, DBL, { override: [Dir.Horizontal, "single"] });
def("╪", Dir.All, Trait.Wire, DBL, { override: [Dir.Vertical, "single"] });
def("╫", Dir.All, Trait.Wire, DBL, { override: [Dir.Horizontal, "single"] });
def("╡", Dir.N | Dir.S | Dir.W, Trait.Wire, DBL, { override: [Dir.Vertical, "single"] });
def("╞", Dir.N | Dir.S | Dir.E, Trait.Wire, DBL, { override: [Dir.Vertical, "single"] });

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Rounded Corners
// ───────────────────────────────────────────────────────────────────────────────
// ╭─╮   (no junctions in this family — rounded corners only)
// │ │
// ╰─╯
const UNI_R = { family: "unicode", weight: "single", corner: "rounded" } as const;
def("╭", Dir.BR, Trait.Wire, UNI_R);
def("╮", Dir.BL, Trait.Wire, UNI_R);
def("╯", Dir.TL, Trait.Wire, UNI_R);
def("╰", Dir.TR, Trait.Wire, UNI_R);

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Dashed / Dotted
// ───────────────────────────────────────────────────────────────────────────────
// Light dashes (2 or 4 segments)
const DASH = { family: "unicode", weight: "dashed" } as const;
def("┄╌", Dir.E | Dir.W, Trait.Wire, DASH);
def("┆╎", Dir.N | Dir.S, Trait.Wire, DASH);
// Heavy dashes
def("┅╍", Dir.E | Dir.W, Trait.Wire, DASH);
def("┇╏", Dir.N | Dir.S, Trait.Wire, DASH);
// Dotted (3 or 4 segments)
const DOT = { family: "unicode", weight: "dotted" } as const;
def("┈┉", Dir.E | Dir.W, Trait.Wire, DOT);
def("┊┋", Dir.N | Dir.S, Trait.Wire, DOT);

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Terminators (Arrows)
// Direction is the direction they point *from* (i.e. the tail side)
// ───────────────────────────────────────────────────────────────────────────────
// Keep directional Unicode arrowhead families in complementary pairs (L/R and U/D).
defArrows("triangle", ["▶►⯈", "◀◄⯇", "▼", "▲"]);
defArrows("dart", ["▸", "◂", "▾", "▴"]);
defArrows("triangle-hollow", ["▷▻", "◁◅", "▽", "△"]);
defArrows("dart-hollow", ["▹", "◃", "▿", "▵"]);
defArrows("arrow", ["→", "←", "↓", "↑"]);
defArrows("double-arrow", ["»⇒", "«⇐", "⩔⇓︾", "⩓⇑︽"]);
const angleDirs: Partial<Record<Dir, Glyph>> = {
  [Dir.W]: ">",
  [Dir.E]: "<",
  [Dir.N]: "v",
  [Dir.S]: "^",
};

// Hub glyphs — each carries its marker name for eidos resolution
def("●", Dir.All, Trait.Hub, undefined, { marker: "dot" });
def("○", Dir.All, Trait.Hub, undefined, { marker: "circle" });
def("◎", Dir.All, Trait.Hub, undefined, { marker: "circle-dot" });
def("◆", Dir.All, Trait.Hub, undefined, { marker: "diamond" });
def("◇", Dir.All, Trait.Hub, undefined, { marker: "diamond-hollow" });
def("□", Dir.All, Trait.Hub, undefined, { marker: "square-hollow" });
def("■", Dir.All, Trait.Hub, undefined, { marker: "square" });
// ASCII caret, used as a up arrow in ASCII art
def("^", Dir.S, Trait.Arrow | Trait.Text, ASCII_STYLE, { marker: "angle", dirs: angleDirs });
// Latin v,  used as a down arrow in ASCII art
def("vV", Dir.N, Trait.Arrow | Trait.Text, ASCII_STYLE, { marker: "angle", dirs: angleDirs });

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Inline Delimiters
// ───────────────────────────────────────────────────────────────────────────────
def("[", Dir.E, Trait.Brace | Trait.Text, ASCII_STYLE, { close: "]" });
def("]", Dir.W, Trait.Brace | Trait.Text, ASCII_STYLE);
def("(", Dir.E, Trait.Brace | Trait.Text, ASCII_STYLE, { close: ")" });
def(")", Dir.W, Trait.Brace | Trait.Text, ASCII_STYLE);
def("<", Dir.E, Trait.Arrow | Trait.Brace | Trait.Text, ASCII_STYLE, { close: ">", marker: "angle", dirs: angleDirs });
def(">", Dir.W, Trait.Arrow | Trait.Brace | Trait.Text, ASCII_STYLE, { marker: "angle", dirs: angleDirs });
def("{", Dir.E, Trait.Brace | Trait.Text, ASCII_STYLE, { close: "}" });
def("}", Dir.W, Trait.Brace | Trait.Text, ASCII_STYLE);

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Special Handling
// ───────────────────────────────────────────────────────────────────────────────
GLYPHS[" "] = { trait: Trait.Space };
GLYPHS[OOB] = { trait: Trait.Void };
GLYPHS[""] = { trait: Trait.Void };

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export function spec(c: string): GlyphSpec {
  return GLYPHS[c] || { trait: Trait.Text };
}

/** Rotate an arrow glyph to face a new tail direction using its dirs map. */
export function rotateArrow(glyph: string, tailDir: Dir): string {
  const s = spec(glyph);
  if (!(s.trait & Trait.Arrow) || s.mask === tailDir) return glyph;
  return s.dirs?.[tailDir] ?? glyph;
}

/** Return one arrow glyph per marker type for the given tail direction, unicode only. */
export function getArrowOptions(tailDir: Dir): string[] {
  const arrows = new Set<string>();
  for (const gSpec of Object.values(GLYPHS)) {
    if (!gSpec.dirs?.[tailDir]) continue;
    arrows.add(gSpec.dirs[tailDir]!);
  }
  return Array.from(arrows);
}

export function getHubGlyphs(): string[] {
  return Object.keys(GLYPHS).filter((char) => !!(GLYPHS[char].trait & Trait.Hub));
}
