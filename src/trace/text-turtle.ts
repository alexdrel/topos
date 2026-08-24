import { Dir, Loc } from "../geo.ts";
import { TextGrid } from "./text-grid.ts";
import { spec, Trait } from "../grammar.ts";
import { BlackBox } from "./recorder.ts";
import { TraceBox, Tracer } from "./types.ts";
import { parseFence } from "../sigil.ts";

const MAX_SPACE_RUN = 3;

export function canSpawnTextTurtle(grid: TextGrid, loc: Loc): boolean {
  const spec = grid.spec(loc);
  return !(spec.trait & Trait.Space) && !grid.isClaimed(loc, Dir.Text);
}

/**
 * Claims a single hub glyph cell and returns a hub trace, or null if the
 * location is not an unclaimed hub (replacing the canSpawnHubSpider guard).
 */
export function traceHub(loc: Loc, grid: TextGrid, recorder: BlackBox | undefined): Tracer {
  const s = grid.peekSpec(loc);
  if (!(s.trait & Trait.Hub) || grid.isClaimed(loc, Dir.Text)) return null;
  const id = `hub_${loc.x}_${loc.y}`;
  grid.claim(loc, Dir.Text);
  recorder?.record({ type: "spawn", antId: id, x: loc.x, y: loc.y, kind: "hub", dir: Dir.None });
  recorder?.record({ type: "success", antId: id, x: loc.x, y: loc.y, pathLength: 1 });
  return { type: "hub", path: [{ ...loc }] };
}

/**
 * Traces a single horizontal line of text.
 * Classification into labels, hub-labels, and multiline merging happens in classifyTextTrace().
 */
export function traceText(origin: Loc, grid: TextGrid, recorder: BlackBox | undefined): Tracer {
  if (grid.isClaimed(origin, Dir.Text) || (grid.spec(origin).trait & Trait.Space)) return null;

  const id = `text_${origin.x}_${origin.y}`;
  const path: Loc[] = [];
  const cur: Loc = { ...origin };
  // Record the spawn so trace replay begins with the text turtle in place.
  recorder?.record({ type: "spawn", antId: id, x: cur.x, y: cur.y, kind: "text", dir: Dir.E });

  const origChar = grid.peek(origin);
  const specStart = spec(origChar);
  const isInline = !!(specStart.trait & Trait.Brace);
  const bracket = isInline ? origChar + specStart.close : "";

  let depth = 0;
  let spaceRun = 0;
  for (; cur.x < grid.w; cur.x++) {
    // Structural agents run first, so any unclaimed glyph belongs to text.
    // A turtle stops only at content already claimed by an earlier agent.
    const spec = grid.spec(cur);
    const isClaimed = grid.isClaimed(cur, Dir.Text);

    if (isClaimed) break;

    // Claim and record the move
    grid.claim(cur, Dir.Text);
    path.push({ ...cur });
    recorder?.record({ type: "move", antId: id, x: cur.x, y: cur.y, dir: Dir.E, char: grid.peek(cur) });

    // Track runs of spaces for the terminator
    if (spec.trait & Trait.Space) {
      spaceRun++;
      if (spaceRun >= (isInline ? 20 : MAX_SPACE_RUN)) break;
    } else {
      spaceRun = 0; // Reset on valid char
    }

    if (isInline) {
      const braceIndex = bracket.indexOf(grid.peek(cur));
      if (braceIndex !== -1) {
        depth += (braceIndex === 0) ? 1 : -1;
        if (depth === 0) break;
      }
    }
  }

  // --- INTEGRATED BACKTRACKING ---
  // If we stopped while in a space run (due to 3 spaces or a wall),
  // backtrack exactly that many spaces visually and unclaim them.
  while (spaceRun > 0 && path.length > 0) {
    const last = path.pop()!;
    grid.unclaim(last, Dir.Text);
    recorder?.record({ type: "backtrack", antId: id, x: last.x, y: last.y });
    spaceRun--;
  }

  // If we found absolutely nothing, abort
  if (path.length === 0) {
    recorder?.record({ type: "abort", antId: id, x: origin.x, y: origin.y, reason: "no_text" });
    return null;
  }

  // Success! Return the captured locs
  recorder?.record({ type: "success", antId: id, x: origin.x, y: origin.y, pathLength: path.length });
  if (isInline && depth === 0) return { type: "inline", bracket, path };
  return { type: "text", path };
}

export function canMergeTextTraces(parent: TraceBox, txt: TraceBox): boolean {
  if (parent.type !== "text") return false;

  const opener = parseFence(parent.text!);
  const fence = txt.type !== "text" ? undefined : parseFence(txt.text!);
  if (opener) {
    if (parent.h === 1) {
      // Open fence (h=1): only its matching closing fence merges in — nothing else
      return !!fence && fence.char === opener.char && fence.length >= opener.length && txt.x === parent.x;
    }
    // Closed fence (h>1): cascade sweeps interior text and inline within y/x range
    const isMergeable = txt.type === "text" || txt.type === "inline" || txt.type === "hub" || txt.type === "label";
    const isContent = !fence || txt.h > 1;
    return isMergeable && isContent &&
      txt.y > parent.y && txt.y < parent.y + parent.h &&
      txt.x >= parent.x && txt.x <= parent.x + parent.w + 2;
  }

  // Fence opener lines do not merge into non-fence parents (they start a new block)
  if (txt.type !== "text" || fence) return false;

  // Header lines cannot be merged as a child into another text trace
  if (txt.header !== undefined) return false;

  // Do not merge separate text runs on the exact same single line
  if (parent.y === txt.y && parent.h === 1 && txt.h === 1) return false;

  // Direct vertical continuation (parent directly above txt) with left margin alignment (+/- 2)
  if (parent.y + parent.h === txt.y && Math.abs(parent.x - txt.x) <= 2) {
    return true;
  }

  // Segment inside existing vertical line range of parent, overlapping horizontally
  if (txt.y >= parent.y && txt.y + txt.h <= parent.y + parent.h) {
    if (txt.x <= parent.x + parent.w + 2 && txt.x + txt.w >= parent.x - 2) return true;
  }

  return false;
}

export function mergeTextIntoParent(parent: TraceBox, txt: TraceBox): void {
  const minX = Math.min(parent.x, txt.x);
  const maxX = Math.max(parent.x + parent.w, txt.x + txt.w);
  const minY = Math.min(parent.y, txt.y);

  let lines = parent.text ? parent.text.split("\n") : [];

  if (minY < parent.y) {
    const padCount = parent.y - minY;
    lines = [...Array(padCount).fill(""), ...lines];
    parent.y = minY;
  }

  const parentShift = parent.x - minX;
  if (parentShift > 0) {
    lines = lines.map((l) => " ".repeat(parentShift) + l);
    parent.x = minX;
  }
  parent.w = maxX - minX;

  const txtLines = txt.text ? txt.text.split("\n") : [""];
  for (let i = 0; i < txtLines.length; i++) {
    const lineIdx = (txt.y - parent.y) + i;
    const txtLine = txtLines[i];
    const txtShift = txt.x - parent.x;

    while (lines.length <= lineIdx) {
      lines.push("");
    }

    let curLine = lines[lineIdx];
    if (curLine.length < txtShift) {
      curLine = curLine.padEnd(txtShift, " ");
    }

    const before = curLine.slice(0, txtShift);
    const after = curLine.slice(txtShift + txtLine.length);
    lines[lineIdx] = before + txtLine + after;
  }

  parent.text = lines.join("\n");
  parent.h = lines.length;

  if (txt.path) {
    parent.path = [...(parent.path ?? []), ...txt.path];
  }
}

export function cascadingMergeTextTraces(parent: TraceBox, txt: TraceBox, traces: TraceBox[]): void {
  mergeTextIntoParent(parent, txt);

  let mergedAny = false;
  do {
    mergedAny = false;
    for (let i = traces.length - 1; i >= 0; i--) {
      const tOther = traces[i];
      if (tOther === parent) continue;
      if (canMergeTextTraces(parent, tOther)) {
        mergeTextIntoParent(parent, tOther);
        traces.splice(i, 1);
        mergedAny = true;
      }
    }
  } while (mergedAny);
}

export function reclassifyTextTrace(text: string, x = 0): Partial<TraceBox> {
  let lines = text.split("\n").map((line) => line.trimEnd());
  text = lines.join("\n");
  if (lines.length === 1) {
    const trimmed = text.trimStart();
    x += text.length - trimmed.length;
    text = trimmed;
    lines = [text];
  }
  const fields: Partial<TraceBox> = {
    type: "text",
    bracket: undefined,
    text,
    x,
    w: Math.max(...lines.map((line) => line.length)),
    h: lines.length,
  };
  if (lines.length !== 1) return fields;

  const open = text[0];
  const openSpec = spec(open);
  const close = openSpec.close;
  if (close && (openSpec.trait & Trait.Brace) && text.endsWith(close)) {
    fields.type = "inline";
    fields.bracket = open + close;
  }
  return fields;
}
