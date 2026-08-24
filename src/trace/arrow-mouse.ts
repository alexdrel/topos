// arrow-mouse.ts
import { Dir, Direction, DIRS, Loc, moveCursor, naturalOrder, opposite, turnLeft, turnRight } from "../geo.ts";
import { TextGrid } from "./text-grid.ts";
import { BlackBox } from "./recorder.ts";
import { Trait } from "../grammar.ts";
import { Tracer } from "./types.ts";
import { inferPenStyle } from "../style.ts";

// Specialized connection check for edges/arrows.
// Similar to perimeterAnt.canConnect but allows Trait.Arrow.
//
// Scans ahead to see if we can jump over text/spaces
// and land on a valid wire/arrowhead connection point.
function canConnectJump(grid: TextGrid, start: Loc, dir: Direction, isTurn: boolean = false): number {
  let steps = 1;
  let cur = moveCursor(start, dir);
  let seenText = false;

  const s1 = grid.spec(start);

  // Scan through text/spaces (max 25 steps to bridge labels)
  while (steps < 50) {
    if (!grid.isAvailable(cur, dir | opposite(dir)) || cur.x < 0 || cur.y < 0 || cur.x >= grid.w || cur.y >= grid.h) break;
    // Forgive one missing cell between explicit structural glyphs: placing a
    // Unicode wire through a space in a label is the natural way to avoid
    // overwriting its text. Ambiguous ASCII wires still require label text.
    const forgivesSpace = steps === 2 && !(s1.trait & Trait.Text) && !(grid.spec(cur).trait & Trait.Text);
    if (canConnectMouse(grid, start, dir, isTurn, steps) && (steps === 1 || forgivesSpace || seenText)) return steps;

    // If we haven't found a connection yet and we want to "jump" (move to steps > 1),
    // we must check if the start was not a '+'.
    if (!isTurn && (s1.trait & Trait.Text) && (s1.mask ?? 0) === Dir.All) break;
    // Don't allow jump from <
    if ((s1.trait & (Trait.Arrow | Trait.Brace)) == (Trait.Arrow | Trait.Brace)) break;

    const spec = grid.spec(cur);
    // We jump over spaces and plain text (text that isn't a wire or arrowhead)
    const isSpace = spec.trait & Trait.Space;
    const isPlainText = (spec.trait & Trait.Text) && !(spec.trait & Trait.Hub);

    if (!isSpace && !isPlainText) break;
    seenText ||= !!isPlainText;
    steps++;
    cur = moveCursor(cur, dir);
  }
  return 0;
}

function canConnectMouse(grid: TextGrid, c1: Loc, dir: Direction, isTurn: boolean = false, steps: number = 1): boolean {
  const c2 = moveCursor(c1, dir, steps);
  if (c2.x < 0 || c2.y < 0 || c2.x >= grid.w || c2.y >= grid.h) return false;

  const s1 = grid.spec(c1);
  const s2 = grid.spec(c2);

  if ((s1.trait & Trait.Hub) || (s2.trait & Trait.Hub)) return false;

  // Must be a linkable component
  if (!(s1.trait & Trait.Link) || !(s2.trait & Trait.Link)) return false;

  // Check availability of the final target (and the origin)
  if (!grid.isAvailable(c1, dir) || !grid.isAvailable(c2, opposite(dir))) return false;

  const opp = opposite(dir);
  const strict1 = ((s1.mask ?? 0) & dir) !== 0;
  const strict2 = ((s2.mask ?? 0) & opp) !== 0;

  // Structural agreement (both sides must support the vector)
  if (!strict1 || !strict2) return false;

  // CRITICAL FIX: If moving Straight, you cannot "step sideways" off a wire.
  if (!isTurn && !strict1) return false;

  // PHANTOM BLOCK: Disallow connecting arrowhead directly to another arrowhead.
  if ((s1.trait & Trait.Arrow) && (s2.trait & Trait.Arrow)) return false;

  // PICKY JUMP: If we reached this location via a "jump" (steps > 1) and it's an ASCII character,
  // it must have structural support in its own axis (the "double --" rule).
  // Specifically, for jumping to text-based characters, we require at least one structural WIRE neighbor.
  if (steps > 1 && (s2.trait & Trait.Text)) {
    // Find structural neighbors in the same axis (H or V)
    const side1 = moveCursor(c2, dir);
    const side2 = moveCursor(c2, opp);
    const spec1 = grid.spec(side1);
    const spec2 = grid.spec(side2);

    const isS1Structural = (spec1.trait & Trait.Wire) && ((spec1.mask ?? 0) & opp);
    const isS2Structural = (spec2.trait & Trait.Wire) && ((spec2.mask ?? 0) & dir);

    if (!isS1Structural && !isS2Structural) return false;
  }

  return true;
}

// Returns the next valid spawn direction and the updated mask of directions still to inspect.
export function canSpawnArrowMouse(grid: TextGrid, loc: Loc, possibleDirMask: Dir): { dir: Direction; possibleDirMask: Dir } | null {
  const spec = grid.spec(loc);
  if (spec.trait & Trait.Hub) return null;
  if (!(spec.trait & Trait.Link)) return null;

  const isArrow = !!(spec.trait & Trait.Arrow);
  const mask = spec.mask ?? Dir.None;

  const authoredUnclaimed = DIRS.filter((d) =>
    (possibleDirMask & d) &&
    (mask & d) &&
    grid.isAvailable(loc, d)
  );

  // A spawn direction must be authored by the glyph, still unclaimed, and
  // structurally connected to another link glyph. Keeping these three facts
  // separate matters: an authored arm may be a terminus precisely because it
  // cannot be traversed, while a structurally possible arm may already belong
  // to another mouse.
  const validExits = DIRS.filter((d) =>
    authoredUnclaimed.includes(d) &&
    canConnectJump(grid, loc, d)
  );

  // Standalone unconnected hubs are handled as text runs instead of line/arrow traces
  if (validExits.length === 0) {
    return null;
  }

  const glyphDirection = DIRS.includes(mask as Direction) ? mask as Direction : Dir.None;
  const blockedAuthored = authoredUnclaimed.filter((d) => !validExits.includes(d));

  // Arrows and half-wires have one authored direction and therefore force the
  // seed. Otherwise a sole authored arm is deterministic. A blocked authored
  // arm also marks a terminus: continue through its structural opposite when
  // possible, or through the only structural exit left by the glyph.
  let seedDir: Direction = Dir.None;
  if (glyphDirection !== Dir.None) {
    seedDir = glyphDirection;
  } else if (authoredUnclaimed.length === 1) {
    seedDir = authoredUnclaimed[0];
  } else if (blockedAuthored.length === 1) {
    const oppositeBlocked = opposite(blockedAuthored[0]);
    if (validExits.includes(oppositeBlocked)) {
      seedDir = oppositeBlocked;
    } else if (validExits.length === 1) {
      seedDir = validExits[0];
    }
  }

  // 3. THE ASCII GUARD (Protects against floating `+---+` and `=======`)
  // Pure ASCII wires are ambiguous. They can ONLY spawn a trace if they are anchored
  // to a Box (meaning BoxAnt previously claimed a vector on this exact location).
  const isAsciiWire = (spec.trait & Trait.Text) && !isArrow;
  if (isAsciiWire && !grid.isClaimed(loc, Dir.All)) return null;

  if (seedDir === Dir.None || !validExits.includes(seedDir)) {
    return null;
  }

  return { dir: seedDir, possibleDirMask: (possibleDirMask & ~seedDir) as Dir };
}

interface Step {
  cursor: Loc;
  incomingDir: Direction;
  taken: Direction;
  steps: number;
}

function pickMove(grid: TextGrid, cursor: Loc, incomingDir: Direction): { dir: Direction; steps: number } | null {
  const facing = opposite(incomingDir);
  const right = turnRight(facing);
  const left = turnLeft(facing);

  const straightSteps = canConnectJump(grid, cursor, facing, false);
  if (straightSteps > 0) return { dir: facing, steps: straightSteps };

  const spec = grid.spec(cursor);
  const mask = spec.mask ?? Dir.None;
  const isAsciiPlus = !!(spec.trait & Trait.Text) && mask === Dir.All;

  // When the glyph authors the direction in front of the mouse, that arm is
  // the concrete path even if structure or an earlier claim prevents taking
  // it. Stop at the glyph instead of silently switching to a turn.
  if (!isAsciiPlus && (mask & facing) && grid.isAvailable(cursor, facing)) return null;

  const rightSteps = canConnectJump(grid, cursor, right, true);
  const leftSteps = canConnectJump(grid, cursor, left, true);

  // Two authored turns are an ambiguous T: neither branch is more faithful to
  // what the mouse sees, so this trace ends here. ASCII '+' is deliberately
  // exempt because all four directions are generic rather than shaped arms.
  if (!isAsciiPlus && (mask & right) && (mask & left)) return null;

  if (rightSteps > 0) return { dir: right, steps: rightSteps };
  if (leftSteps > 0) return { dir: left, steps: leftSteps };
  return null;
}

function getTerminus(grid: TextGrid, loc: Loc, internalDir: Direction): [direction: Direction, glyph?: string] {
  const spec = grid.spec(loc);
  const mask = spec.mask ?? Dir.None;

  if (spec.trait & Trait.Wire) {
    const authoredDirections = DIRS.filter((d) => mask & d);

    // A one-direction wire is a half-wire. Its missing endpoint is intentional,
    // represented by Dir.None and undefined text so mutation can preserve it.
    if (authoredDirections.length === 1) return [Dir.None, undefined];

    // '+' carries no shaped terminal arm, so it cannot add one to the trail.
    if ((spec.trait & Trait.Text) && mask === Dir.All) return [Dir.None, ""];

    // The endpoint direction is part of the mouse trail, not a refinement hint.
    // Prefer the trail recoil when the glyph authors it. This is also valid when
    // a box or an earlier trace already claimed that arm: this mouse must report
    // and claim the same concrete geometry it followed.
    const recoilDir = opposite(internalDir);
    if (mask & recoilDir) {
      grid.claim(loc, recoilDir);
      return [recoilDir, ""];
    }

    // At a corner the recoil is not authored. After removing the path arm, one
    // remaining authored arm is still unambiguous and becomes the terminal
    // claim. More than one remaining arm would invent a choice, so it is None.
    const terminalDirections = authoredDirections.filter((d) => d !== internalDir);
    if (terminalDirections.length === 1) {
      grid.claim(loc, terminalDirections[0]);
      return [terminalDirections[0], ""];
    }
    return [Dir.None, ""];
  }

  if ((spec.trait & Trait.Arrow)) {
    const direction = opposite(mask as Direction);
    grid.claim(loc, direction);
    return [direction, grid.peek(loc)];
  }

  // Default to path-based recoil
  const direction = opposite(internalDir);
  grid.claim(loc, direction);
  return [direction, ""];
}

// Valid Edge Criteria
// A trace returned by arrowMouse is considered a valid Edge only if it meets at least one of the following criteria:

// 1. Contains an Arrowhead: The path includes at least one character with the Trait.Arrow trait (e.g., >, ►, ◀, ▼, ▲, or connectors like ■, ●).
// 2. Contains Unicode Geometry: The path includes at least one character that is a structural Unicode wire (e.g., ─, │, ┌, ┼). These are identified via Trait.Wire without the Trait.Text trait.
// 3. Is Anchored at Both Ends: If the path is purely ASCII (e.g., ---, +++), it must be "anchored."
// Anchoring is defined as the start and end locations connecting to structural elements that were already recognized by another agent (specifically BoxAnt).
// In practice, this means the start and end locations have at least one vector direction already claimed in the Grid mask before arrowMouse started tracing.

export function traceArrow(origin: Loc, grid: TextGrid, recorder: BlackBox | undefined, seedDir: Direction): Tracer {
  const antId = `arrow_${origin.x}_${origin.y}_${Dir[seedDir]}`;
  const MAX_STEPS = 1200;

  recorder?.record({ type: "spawn", antId, x: origin.x, y: origin.y, kind: "line", dir: seedDir });

  let cur: Step = {
    cursor: origin,
    incomingDir: opposite(seedDir),
    taken: seedDir,
    steps: canConnectJump(grid, origin, seedDir),
  };
  if (!cur.steps) return null;

  const trail: Step[] = [{ ...cur }];
  const path: Loc[] = [];

  let steps = 0;
  while (steps < MAX_STEPS) {
    steps++;

    // Claim axis-aware stride
    const nextIncoming = opposite(cur.taken);
    const next = grid.stride("claim", cur.cursor, cur.taken, cur.steps);

    recorder?.record({ type: "move", antId, x: next.x, y: next.y, dir: cur.taken, char: grid.get(next) });

    for (let i = 0; i < cur.steps; i++) {
      path.push(moveCursor(cur.cursor, cur.taken, i));
    }

    const nextSpec = grid.spec(next);
    let nextDir: Direction = Dir.None; // Default to no direction if we can't continue
    let nextSteps = 0;
    // Treat ALL arrow or hub characters as terminators.
    const isTerminator = nextSpec.trait & (Trait.Arrow | Trait.Hub);

    if (!isTerminator) {
      const nextMove = pickMove(grid, next, nextIncoming);
      if (nextMove) {
        nextDir = nextMove.dir;
        nextSteps = nextMove.steps;
      }
    }

    cur = {
      cursor: next,
      incomingDir: nextIncoming,
      taken: nextDir,
      steps: nextSteps,
    };
    trail.push({ ...cur });

    if (nextDir === Dir.None) {
      break; // No valid direction to continue, end of the line
    }
  }

  if (trail.length < 2) {
    recorder?.record({ type: "abort", antId, x: origin.x, y: origin.y, reason: "no_valid_path" });
    return null;
  }
  path.push(cur.cursor); // Include the final position

  for (let i = 0; i < path.length; i++) {
    const cur = path[i];
    const isTerminus = i === 0 || i === path.length - 1;
    if (!isTerminus) {
      const isVertical = path[i - 1].x === cur.x && cur.x === path[i + 1].x;
      if (isVertical && !(grid.spec(cur).trait & Trait.Wire)) continue;
    }
    grid.claim(cur, Dir.Text);
  }

  const [startDir, startGlyph] = getTerminus(grid, origin, seedDir);
  const [endDir, endGlyph] = getTerminus(grid, cur.cursor, cur.incomingDir);

  // 2. Enforce Canonical Reading Order (Top-to-Bottom, Left-to-Right)
  // If the start point is visually BELOW or TO THE RIGHT of the end point, it was traced backwards
  const { p0, pN } = { p0: path[0], pN: path[path.length - 1] };
  const reverse = naturalOrder(p0, pN) > 0;

  const finalPath = reverse ? path.reverse() : path;
  const pStart = finalPath[0];
  const pEnd = finalPath[finalPath.length - 1];

  return {
    type: "line",
    style: inferPenStyle(finalPath.map((l) => grid.peek(l))),
    path: finalPath,
    source: { type: "terminus", x: pStart.x, y: pStart.y, w: 1, h: 1, text: reverse ? endGlyph : startGlyph, dir: reverse ? endDir : startDir },
    target: { type: "terminus", x: pEnd.x, y: pEnd.y, w: 1, h: 1, text: reverse ? startGlyph : endGlyph, dir: reverse ? startDir : endDir },
  };
}
