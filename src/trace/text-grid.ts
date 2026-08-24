import { OOB, spec, Trait } from "../grammar.ts";
import { Dir, Direction, Loc, moveCursor, opposite, Rect } from "../geo.ts";

export class TextGrid implements Rect {
  private readonly claimMask: Uint8Array;
  private static readonly FULL_MARK = 0x80;

  constructor(
    readonly lines: string[],
    readonly x: number, // Global Offset X
    readonly y: number, // Global Offset Y
    readonly w: number, // Width of this View
    readonly h: number, // Height of this View
  ) {
    // Local mask for this specific view (w * h)
    this.claimMask = new Uint8Array(w * h);
  }

  static fromLines(lines: string[]): TextGrid {
    return new TextGrid(lines, 0, 0, Math.max(0, ...lines.map((line) => line.length)), lines.length);
  }

  // raw char, respects claims
  get(loc: Loc): string {
    const c = this.peek(loc);
    return (c === OOB || (this.claimMask[loc.y * this.w + loc.x] & TextGrid.FULL_MARK)) ? OOB : c;
  }

  // raw char, ignores claims
  peek(loc: Loc): string {
    if (loc.x < 0 || loc.y < 0 || loc.x >= this.w || loc.y >= this.h) return OOB;
    const line = this.lines[this.y + loc.y];
    return (line && line[this.x + loc.x]) || " ";
  }

  // char spec, respects claims
  spec(loc: Loc) {
    return spec(this.get(loc));
  }

  // char spec, ignores claims
  peekSpec(loc: Loc) {
    return spec(this.peek(loc));
  }

  // Indexing function to convert (x, y) to linear index
  idx(loc: Loc): number {
    return loc.y * this.w + loc.x;
  }
  // Reverse index to get loc from idx (used for vertex tracking)
  loc(idx: number): Loc {
    return { x: idx % this.w, y: Math.floor(idx / this.w) };
  }

  /** Claim a directional vector of location */
  claim(loc: Loc, dir: Dir): void {
    if (loc.x >= 0 && loc.y >= 0 && loc.x < this.w && loc.y < this.h) {
      this.claimMask[this.idx(loc)] |= dir;
    }
  }

  /** Explicitly release a vector (used during Ant backtracking) */
  unclaim(loc: Loc, dir: Dir): void {
    if (loc.x >= 0 && loc.y >= 0 && loc.x < this.w && loc.y < this.h) {
      this.claimMask[this.idx(loc)] &= ~dir;
    }
  }

  /** Check if a vector is free */
  isAvailable(loc: Loc, dir: Dir): boolean {
    if (loc.x < 0 || loc.y < 0 || loc.x >= this.w || loc.y >= this.h) return false;
    return (this.claimMask[this.idx(loc)] & dir) === 0;
  }

  /** Check if a specific direction is claimed */
  isClaimed(loc: Loc, mask: Dir): boolean {
    if (loc.x < 0 || loc.y < 0 || loc.x >= this.w || loc.y >= this.h) return true;
    return (this.claimMask[this.idx(loc)] & mask) !== 0;
  }

  stride(mode: "claim" | "unclaim", loc: Loc, dir: Direction, steps: number): Loc {
    const nextIncoming = opposite(dir);
    for (let i = 0; i < steps; i++) {
      const c = moveCursor(loc, dir, i);
      this[mode](c, dir | (i > 0 ? nextIncoming : 0));
    }
    const next = moveCursor(loc, dir, steps);
    this[mode](next, nextIncoming);
    return next;
  }

  /**
   * Iterates over every location in the grid, top-to-bottom, left-to-right.
   * Yields a {x, y} object.
   */
  *walk(): Generator<Loc> {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        yield { x, y };
      }
    }
  }

  /** Yields only locations that are not space, void, or completely taken. */
  *scan(): Generator<Loc> {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const spec = this.spec({ x, y });
        if (spec.trait === Trait.Space || spec.trait === Trait.Void) {
          continue;
        }
        yield { x, y };
      }
    }
  }
}
