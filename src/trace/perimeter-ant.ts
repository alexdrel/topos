import { boxWalk, contains, Dir, Direction, eqLoc, Loc, moveCursor, opposite, Rect, turnLeft, turnRight } from "../geo.ts";
import { TextGrid } from "./text-grid.ts";
import { isTJunction, Trait } from "../grammar.ts";
import { BlackBox } from "./recorder.ts";
import { TraceBox, Tracer } from "./types.ts";
import { inferPenStyle } from "../style.ts";
import type { Stack } from "../stacked-box.ts";

function isJumpedLabel(loc: Loc, jumpedLabels?: Rect[]): boolean {
  return !!jumpedLabels?.find((label) => contains(label, loc));
}

function isHubToHubAllowed(grid: TextGrid, c1: Loc, c2: Loc, dir: Direction): boolean {
  const perp1 = turnRight(dir);
  const perp2 = turnLeft(dir);

  const hasWire = (c: Loc, pDir: Direction) => {
    const n = moveCursor(c, pDir);
    if (n.x < 0 || n.y < 0 || n.x >= grid.w || n.y >= grid.h) return false;
    const s = grid.spec(n);
    return (s.trait & Trait.Wire) && ((s.mask ?? 0) & opposite(pDir));
  };

  const w1_1 = hasWire(c1, perp1);
  const w1_2 = hasWire(c1, perp2);
  const w2_1 = hasWire(c2, perp1);
  const w2_2 = hasWire(c2, perp2);

  // Allow only if they have exactly one perpendicular wire each, on opposite sides.
  // This prevents stacked boxes (wires on same side) and phantom text boxes (no wires).
  return !!((w1_1 && !w1_2 && !w2_1 && w2_2) || (!w1_1 && w1_2 && w2_1 && !w2_2));
}

export function canConnect(grid: TextGrid, c1: Loc, dir: Direction, isTurn = false, steps = 1, checkAvailable = true, jumpedLabels?: Rect[]): boolean {
  const c2 = moveCursor(c1, dir, steps);
  if (c2.x < 0 || c2.y < 0 || c2.x >= grid.w || c2.y >= grid.h) return false;
  if (checkAvailable && !grid.isAvailable(c2, opposite(dir))) return false;

  const s1 = grid.spec(c1);
  const s2 = grid.spec(c2);

  if (dir === Dir.N && isJumpedLabel(c2, jumpedLabels) && (s1.trait & Trait.Wire) && ((s1.mask ?? 0) & dir) !== 0) {
    return true;
  }

  if (!(s1.trait & Trait.Wire) || !(s2.trait & Trait.Wire)) return false;

  const opp = opposite(dir);
  const strict1 = ((s1.mask ?? 0) & dir) !== 0; // Exiting c1 is valid
  const strict2 = ((s2.mask ?? 0) & opp) !== 0; // Entering c2 is valid

  // 1. Unicode / General: Both characters must strictly agree
  if (strict1 && strict2) {
    if (!isTurn && steps === 1 && ((s1.mask ?? 0) & Dir.All) === Dir.All && ((s2.mask ?? 0) & Dir.All) === Dir.All) {
      if (!isHubToHubAllowed(grid, c1, c2, dir)) return false;
    }
    return true;
  }

  // 2. ASCII Imperfect Corners (e.g., stepping from '=' down to '|')
  // If both are ASCII, we forgive c1 not having an explicit corner exit,
  // AS LONG AS c2 explicitly accepts the entry.
  const isAscii1 = s1.trait & Trait.Text;
  const isAscii2 = s2.trait & Trait.Text;

  if (isAscii1 && isAscii2) {
    // If moving Straight, you cannot "step sideways" off a wire.
    // The current wire MUST support the axis you are walking on.
    if (!isTurn && !strict1) return false;

    // For ASCII corners, as long as one of the wires supports the vector, it connects
    if (strict1 || strict2) {
      if (!isTurn && ((s1.mask ?? 0) & Dir.All) === Dir.All && ((s2.mask ?? 0) & Dir.All) === Dir.All) {
        if (!isHubToHubAllowed(grid, c1, c2, dir)) return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * Checks if an arrow character is perpendicular to the movement axis
 * OR is a hub (which allows pass-through from any direction).
 */
function isPassThroughArrow(grid: TextGrid, loc: Loc, dir: Direction): boolean {
  const s = grid.spec(loc);
  if (s.trait & Trait.Hub) return true;
  if (!(s.trait & Trait.Arrow)) return false;

  const axis = (dir === Dir.E || dir === Dir.W) ? (Dir.E | Dir.W) : (Dir.N | Dir.S);
  // Arrow is perpendicular if its direction mask does NOT contain our movement axis
  return ((s.mask ?? 0) & axis) === 0;
}

/**
 * Scans ahead to see if we can jump over one or more arrowheads or labels
 * and land on a valid wire connection point.
 */
function canConnectJump(grid: TextGrid, start: Loc, dir: Direction, isTurn = false, allowArrows = true, allowLabels = true, jumpedLabels?: Rect[]): number {
  let steps = 1;
  let cur = moveCursor(start, dir);
  let sawText = false;
  let sawSpace = false;

  // Scan through text/spaces (max 40 steps to bridge labels)
  while (steps < 40) {
    if (cur.x < 0 || cur.y < 0 || cur.x >= grid.w || cur.y >= grid.h) break;

    // First check if the current location yields a connection (meaning we've jumped over valid stuff and hit the other wall)
    // We use checkAvailable=true here to ensure the specific entry vector is free.
    if (canConnect(grid, start, dir, isTurn, steps, true, jumpedLabels)) {
      // Prevent jumping over pure whitespace gaps
      if (sawSpace && !sawText) return 0;
      return steps;
    }

    // If it's not a connection, we check if it's something we can jump OVER.
    // To jump OVER a location, the entire axis must be available to avoid "leaking" through other walls.
    if (!grid.isAvailable(cur, dir | opposite(dir))) break;

    if (allowArrows && isPassThroughArrow(grid, cur, dir)) {
      steps++;
      cur = moveCursor(cur, dir);
      continue;
    }

    const spec = grid.spec(cur);
    if (allowLabels) {
      // We jump over spaces and plain text (text that isn't a wire or arrowhead)
      const isSpace = spec.trait & Trait.Space;
      const isPlainText = (spec.trait & Trait.Text) && !(spec.trait & Trait.Link);

      if (isPlainText) sawText = true;
      if (isSpace) sawSpace = true;

      if (isSpace || isPlainText) {
        steps++;
        cur = moveCursor(cur, dir);
        continue;
      }
    }
    // If not a space, non-structural text, or pass-by arrow, we can't jump anymore.
    break;
  }
  return 0;
}

export function canSpawnBoxAnt(grid: TextGrid, loc: Loc): boolean {
  const spec = grid.spec(loc);

  // Must be a wire/structural character and the South/East vector unvisited? (Prevents spawning on already-claimed walls)
  if (!(spec.trait & Trait.Wire) || !grid.isAvailable(loc, Dir.BR)) return false;

  // Is this a Top-Left Corner?
  let canSpawn = spec.mask === Dir.BR;
  if (!canSpawn) {
    // It must be able to go East (Top Wall) and South (Left Wall)
    // Use jump-aware versions to allow spawning even if an arrow is immediately adjacent
    canSpawn = canConnectJump(grid, loc, Dir.E, false, true, true) > 0 &&
      canConnectJump(grid, loc, Dir.S, true, true, true) > 0;
  }
  return canSpawn;
}

interface Move {
  dir: Direction | Dir.None;
  steps: number;
}
interface TurnInfo {
  distSinceLast: number;
  lastRight: boolean;
  count: number[];
}
interface Step {
  cursor: Loc;
  incomingDir: Direction;
  arrivedSteps: number;
  tried: Dir;
  taken: Move;
  isCommitted?: boolean;
  isPerimeter?: boolean;
  turns: TurnInfo;
}

/** Two-phase tracing: first trace the outer perimeter, then explore interior grid lines. */
const enum Phase {
  Perimeter = 1,
  Inner,
}

/** Compute the next TurnInfo after taking a step. */
function advanceTurnInfo(prev: TurnInfo, stride: number, takenDir: Direction, facingDir: Direction): TurnInfo {
  const isTurn = takenDir !== facingDir;
  if (isTurn) {
    const isRight = takenDir === turnRight(facingDir);
    const count = [...prev.count];
    count[isRight ? 1 : 0]++;
    return { distSinceLast: stride, lastRight: isRight, count };
  }
  return { ...prev, distSinceLast: prev.distSinceLast + stride };
}

function pickMove(step: Step, grid: TextGrid, phase: Phase, jumpedLabels: Rect[]): Move | null {
  const facing = opposite(step.incomingDir || Dir.N);
  const left = turnLeft(facing);
  const right = turnRight(facing);

  const isPerimeter = phase === Phase.Perimeter;
  const allowArrows = isPerimeter;
  const newTrace = step.arrivedSteps === 0;

  // Stacked-box junction conditions (used by perimeter right-turn probe)
  const recentLeft = !step.turns.lastRight && step.turns.count[0] > 0 && step.turns.distSinceLast <= 2;
  const isStackJunction = isTJunction(grid.spec(step.cursor).mask ?? 0) && recentLeft;
  const isStackedInnerTopEdge = phase === Phase.Inner && step.turns.count[1] > 0 && !step.turns.lastRight;
  // Perimeter labels belong on the outer ceiling; inner horizontal lines may
  // also carry labels (notably the visible top edge of a stacked box).
  const canJumpLabels = isPerimeter || isStackJunction || isStackedInnerTopEdge;

  // Each probe defines: direction, optional isTurn (default true), optional guard, and priority placement
  type Probe = { dir: Direction; isTurn?: boolean; guard?: () => boolean; vip?: boolean };

  const moves: Move[] = [];
  let probes: Probe[];
  if (isPerimeter) {
    probes = [
      // Perimeter: straight → left, with conditional right-turn for stacked boxes (highest priority)
      { dir: facing, isTurn: newTrace },
      { dir: left },
      { dir: right, vip: true, guard: () => isStackJunction && moves.length > 0 },
    ];
  } else {
    probes = [
      // Inner: left → straight → conditional right
      { dir: left },
      { dir: facing, isTurn: !step.isPerimeter && newTrace },
      { dir: right, guard: () => !step.isPerimeter && newTrace },
    ];
  }

  for (const { dir, isTurn = true, guard, vip } of probes) {
    if (guard && !guard()) continue;
    const allowLabels = canJumpLabels && (dir === Dir.E || dir === Dir.W);
    const steps = canConnectJump(grid, step.cursor, dir, isTurn, allowArrows, allowLabels, jumpedLabels);
    if (steps) {
      if (vip) moves.unshift({ dir, steps });
      else moves.push({ dir, steps });
    }
  }

  return moves.find((m) => !(step.tried & m.dir)) ?? null;
}

function commitTrail(trail: Step[], grid: TextGrid, isPerimeter: boolean, vertices: Set<number>): void {
  for (const step of trail) {
    if (!step.isCommitted) {
      step.isCommitted = true;
      // Mark outer-perimeter steps so future inner exploration treats them as single-line junctions
      step.isPerimeter = isPerimeter;
      if (step.arrivedSteps == 0 || step.taken.dir !== opposite(step.incomingDir)) {
        vertices.add(grid.idx(step.cursor));
      }
    }
  }
}

export interface TraceResult {
  path: Loc[];
  stack?: Stack;
  children?: Loc[][];
}

export function tracePerimeter(origin: Loc, grid: TextGrid, recorder: BlackBox | undefined): Tracer[] {
  const antId = `box_${origin.x}_${origin.y}`;
  const trail: Step[] = [];

  let phase: Phase = Phase.Perimeter;
  let perimeterSteps = 0;
  const perimeter: Loc[] = [];

  const vertices = new Set<number>();
  const jumpedLabels: Rect[] = [];
  let jumpOrigin: Loc | null = null;

  recorder?.record({ type: "spawn", antId, x: origin.x, y: origin.y, kind: "box", dir: Dir.S });

  // Seed first state
  let cur: Step = {
    cursor: origin,
    incomingDir: Dir.None,
    arrivedSteps: 0,
    tried: Dir.None,
    turns: { distSinceLast: 0, lastRight: false, count: [0, 0] },
  } as Step;
  let scanIndex: number | null = null;

  const MAX_STEPS = 5000;
  let stepsCount = 0;

  while ((trail.length > 0 || phase === Phase.Perimeter) && stepsCount < MAX_STEPS) {
    stepsCount++;
    const nextMove = pickMove(cur, grid, phase, jumpedLabels);

    if (nextMove) {
      // ═══════════════════════ ADVANCE ═══════════════════════
      if (jumpOrigin) {
        recorder?.record({ type: "jump", antId, x: jumpOrigin.x, y: jumpOrigin.y });
        jumpOrigin = null;
      }

      cur.taken = nextMove;
      cur.tried = (cur.tried | (nextMove.dir as Dir)) as Dir;
      if (scanIndex !== null) {
        trail[scanIndex].tried = cur.tried;
      }

      const takenDir = nextMove.dir as Direction;
      const nextIncoming = opposite(takenDir);
      const stride = nextMove.steps;

      // Claim exiting current location and stride through intermediate locations
      const next = grid.stride("claim", cur.cursor, takenDir, stride);
      if (phase === Phase.Perimeter) {
        for (let i = 0; i < stride; i++) {
          perimeter.push(moveCursor(cur.cursor, takenDir, i));
        }
      }

      // Detect ceiling-label jump (label embedded in a top wall / horizontal line)
      if ((takenDir === Dir.E || takenDir === Dir.W) && stride > 1) {
        const labelRect: Rect = { x: Math.min(cur.cursor.x, next.x), y: cur.cursor.y, w: Math.abs(next.x - cur.cursor.x) + 1, h: 1 };
        jumpedLabels.push(labelRect);
      }

      // Record the step in the trail
      trail.push({ ...cur });
      recorder?.record({ type: "move", antId, x: next.x, y: next.y, dir: takenDir, char: grid.get(next) });

      // Update turn tracking
      const newTurns = advanceTurnInfo(cur.turns, stride, takenDir, opposite(cur.incomingDir));

      // Prepare state for the next iteration
      cur = {
        cursor: next,
        incomingDir: nextIncoming,
        turns: newTurns,
        arrivedSteps: stride,
        tried: Dir.None,
      } as Step;
      scanIndex = null;

      // ─── Check for loop closure ───
      let closure: Phase | false = false;
      // Perimeter: closed the outer loop upon returning to origin
      if (phase === Phase.Perimeter && eqLoc(next, origin)) {
        closure = Phase.Perimeter;
        phase = Phase.Inner;
        perimeterSteps = trail.length;
      }
      // Phase.Inner: reached an already-committed location of this structure (interior loop closure)
      // We only allow closing if we hit a COMMITTED part of the skeleton.
      // Hitting our own uncommitted path is a "short-circuit" self-loop, which we ignore.
      if (
        phase === Phase.Inner && (
          trail.some((s) => s.isCommitted && eqLoc(s.cursor, next)) ||
          isJumpedLabel(next, jumpedLabels)
        )
      ) {
        closure = Phase.Inner;
      }

      if (closure) {
        vertices.add(grid.idx(cur.cursor));
        commitTrail(trail, grid, closure === Phase.Perimeter, vertices);
      }
      continue;
    }

    // ═══════════════════════ NO VALID MOVE — BACKTRACK ═══════════════════════
    // Phase A: Regular backtrack — unwind the uncommitted suffix
    if (trail.length > 0 && !trail[trail.length - 1].isCommitted) {
      const step = trail.pop()!;
      const takenDir = step.taken.dir;
      const stride = step.taken.steps;

      // Undo grid claims for the non-committed segment
      grid.stride("unclaim", step.cursor, takenDir, stride);
      if (phase === Phase.Perimeter) {
        for (let i = 0; i < stride; i++) {
          perimeter.pop();
        }
      }
      recorder?.record({ type: "backtrack", antId, x: step.cursor.x, y: step.cursor.y, dir: takenDir });

      // Restore state and retry remaining options at this position
      cur = step;
      scanIndex = null;
      jumpOrigin = { ...cur.cursor };
      continue;
    }

    // Phase B: Committed-trail scan — walk the committed skeleton looking for unexplored junctions
    {
      let nextIdx: number = (scanIndex ?? -1) + 1;
      while (nextIdx < trail.length && !trail[nextIdx].isCommitted) {
        nextIdx++;
      }
      if (nextIdx >= trail.length) break;

      const step = trail[nextIdx];
      // Re-enter committed location as an inner-line starting point
      cur = { ...step, isCommitted: false, arrivedSteps: 0 };
      scanIndex = nextIdx;
      jumpOrigin = { ...cur.cursor };
    }
  }

  if (phase === Phase.Perimeter) {
    recorder?.record({ type: "abort", antId, x: origin.x, y: origin.y, reason: stepsCount === MAX_STEPS ? "timeout" : "exhausted_all_paths" });
    return [];
  }

  recorder?.record({ type: "success", antId, x: origin.x, y: origin.y, pathLength: perimeter.length });

  const cells = decomposeGrid(grid, vertices, perimeter);
  // Simplified stack calculation
  const stack = getStackMetadata(trail, trail[perimeterSteps - 1].turns.count[1]);

  const innerHorizontalLocs: Loc[] = [];
  for (const t of trail) {
    const dir = (t.taken?.dir ?? Dir.None) as Direction;
    const steps = t.taken?.steps ?? 0;
    const isInnerHorizontal = !t.isPerimeter && (dir === Dir.E || dir === Dir.W);

    for (let i = 0; i <= steps; i++) {
      const loc = moveCursor(t.cursor, dir, i);
      const spec = grid.peekSpec(loc);
      if ((spec.trait & Trait.Wire) && !(spec.trait & Trait.Hub)) {
        grid.claim(loc, Dir.Text);
      }
      if (isInnerHorizontal) {
        innerHorizontalLocs.push(loc);
      }
    }
  }

  const boxPath = (stack && innerHorizontalLocs.length > 0) ? [...perimeter, ...innerHorizontalLocs] : perimeter;

  return [{
    type: "box",
    path: boxPath,
    style: inferPenStyle(perimeter.map((l) => grid.peek(l))),
    stack,
  }, ...cells];
}

function getStackMetadata(path: Step[], totalCW: number): TraceBox["stack"] {
  const layers = Math.floor(totalCW / 2) + 1;
  if (layers <= 1) return undefined;

  const touchesInnerTrail = (loc: Loc): boolean => path.some((step) => step.isPerimeter === false && eqLoc(step.cursor, loc));

  for (let i = 0; i < path.length; i++) {
    const step = path[i];
    const facing = opposite(step.incomingDir);
    if (step.taken.dir !== turnRight(facing) || step.turns.distSinceLast > 2) continue;

    let nextTurn: Step | undefined;
    for (let j = i + 1; j < path.length; j++) {
      const candidate = path[j];
      if (candidate.taken.dir !== opposite(candidate.incomingDir)) {
        nextTurn = candidate;
        break;
      }
    }
    if (!nextTurn) break;

    const nextFacing = opposite(nextTurn.incomingDir);
    const nextTakenDir = nextTurn.taken.dir as Direction;
    if (nextTakenDir !== turnLeft(nextFacing)) continue;

    const distA = step.turns.distSinceLast;
    const distB = nextTurn.turns.distSinceLast;
    const dx = signedDistance(facing, distA, Dir.E, Dir.W) + signedDistance(nextFacing, distB, Dir.E, Dir.W);
    const dy = signedDistance(facing, distA, Dir.S, Dir.N) + signedDistance(nextFacing, distB, Dir.S, Dir.N);

    const straightAhead = moveCursor(step.cursor, facing);
    if (!touchesInnerTrail(straightAhead)) {
      return { layers, dx: -dx, dy: -dy };
    }
  }

  return undefined;
}

function signedDistance(dir: Direction, distance: number, positive: Direction, negative: Direction): number {
  if (dir === positive) return distance;
  if (dir === negative) return -distance;
  return 0;
}

function decomposeGrid(grid: TextGrid, vertices: Set<number>, perimeterPath: Loc[]): Tracer[] {
  const cells: Tracer[] = [];
  const isBoundaryTaken = (loc: Loc, dir: Dir) => grid.isClaimed(loc, dir);

  let minX = Infinity, maxX = 0, minY = Infinity, maxY = 0;
  for (const v of vertices) {
    const { x, y } = grid.loc(v);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  for (const tl of vertices) {
    const { x: x1, y: y1 } = grid.loc(tl);
    for (const br of vertices) {
      const { x: x2, y: y2 } = grid.loc(br);

      if (x1 >= x2 - 1 || y1 >= y2 - 1) continue;
      if (x1 === minX && y1 === minY && x2 === maxX && y2 === maxY) continue;

      let possible = true;
      for (const smaller of vertices) {
        const { x: x3, y: y3 } = grid.loc(smaller);
        if (x3 < x1 || x3 > x2 || y3 < y1 || y3 > y2) continue;
        const isCorner = (x3 === x1 || x3 === x2) && (y3 === y1 || y3 === y2);
        if (!isCorner) {
          possible = false;
          break;
        }
      }

      for (let x = x1; possible && x < x2; x++) {
        if (!isBoundaryTaken({ x, y: y1 }, Dir.E) || !isBoundaryTaken({ x, y: y2 }, Dir.E)) possible = false;
      }
      for (let y = y1; possible && y < y2; y++) {
        if (!isBoundaryTaken({ x: x1, y }, Dir.S) || !isBoundaryTaken({ x: x2, y }, Dir.S)) possible = false;
      }
      if (!possible) continue;

      const path = Array.from(boxWalk({ x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 }));
      cells.push({
        type: "grid-cell",
        path,
        style: inferPenStyle(path.filter((l) => !perimeterPath.some((p) => eqLoc(p, l))).map((l) => grid.peek(l))),
      });
    }
  }

  return cells;
}
