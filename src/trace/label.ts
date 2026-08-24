import { TextGrid } from "./text-grid.ts";
import { Dir, eqLoc, Loc, naturalOrder, simplifyPath } from "../geo.ts";
import { Trait } from "../grammar.ts";
import { TraceBox } from "./types.ts";
import { isBoxHorizontalLine } from "../stacked-box.ts";

export function extractLabelsFromPath(parent: TraceBox, grid: TextGrid): TraceBox[] {
  const path = parent.path!;

  const isHorizontalSegment = (index: number): boolean => {
    if (path.length <= 1) return false;
    const curLoc = path[index];
    const prevLoc = path[index - 1];
    const nextLoc = path[index + 1];
    return (prevLoc !== undefined && prevLoc.y === curLoc.y) ||
      (nextLoc !== undefined && nextLoc.y === curLoc.y);
  };

  const isLabel = (index: number): boolean => {
    if (!isHorizontalSegment(index)) return false;

    const spec = grid.peekSpec(path[index]);

    // Pure text or space -> Label part.
    const isSpace = !!(spec.trait & Trait.Space);
    const isPureText = (spec.trait & Trait.Text) && !(spec.trait & Trait.Wire);

    // Terminal arrowheads are structural, not part of the label.
    if (spec.trait & Trait.Arrow) {
      if (index === 0 || index === path.length - 1) return false;
    }

    if (isPureText || isSpace) return true;

    if ((spec.trait & Trait.Text) && (spec.trait & Trait.Wire)) {
      // Check neighbors in path
      const checkNeighbor = (idx: number) => {
        if (idx < 0 || idx >= path.length) return false;
        const adjSpec = grid.peekSpec(path[idx]);
        const isSpace = !!(adjSpec.trait & Trait.Space);
        const isPureText = (adjSpec.trait & Trait.Text) && !(adjSpec.trait & Trait.Wire);
        const isTerminusArrow = (adjSpec.trait & Trait.Arrow) && (idx === 0 || idx === path.length - 1);
        return (isPureText && !isTerminusArrow) || isSpace;
      };

      // For ambiguous chars (+, -, =), they must be flanked by text/space on BOTH sides within the path
      // OR if it's a two-letter label like "A-B", it'll work because A and B are pure text.
      // If it's a wire connecting to a label like "-API", the left neighbor is a corner (pure wire), so it fails and is correctly ignored.
      if (checkNeighbor(index - 1) && checkNeighbor(index + 1)) return true;
    }

    return false;
  };

  const labelLocs: Loc[] = [];
  for (let i = 0; i < path.length; i++) {
    const cur = path[i];
    if (isLabel(i)) {
      labelLocs.push(cur);
      grid.claim(cur, Dir.Text);
    }
  }

  if (labelLocs.length === 0) return [];

  // Sort all locs into natural reading order (T->B, L->R)
  labelLocs.sort(naturalOrder);

  const segments: TraceBox[] = [];
  let prev: Loc = { x: -1, y: -1 };
  let loc: Loc = { ...prev };
  let text = "";

  const addSegment = () => {
    if (text.trim()) segments.push({ type: "label", ...loc, h: 1, w: text.length, text: text, parent });
    text = "";
  };

  for (const cur of labelLocs) {
    if (!eqLoc(cur, { x: prev.x + 1, y: prev.y })) {
      addSegment();
      loc = cur;
    }
    text += grid.peek(cur);
    prev = cur;
  }
  addSegment();
  return segments;
}

export function isBoxLabelEdge(box: TraceBox, label: Loc & { w: number }): boolean {
  if (box.type !== "box") return false;
  if (label.x < box.x + 1 || label.x + label.w > box.x + box.w - 1) return false;
  return isBoxHorizontalLine(box, label.y, box.stack);
}

// Classify a freshly-produced text trace in context of already-discovered traces.
export function isLabelAssociated(traces: TraceBox[], label: TraceBox, parent: TraceBox): boolean {
  if (label.w <= 0 || label.h !== 1) return false;
  if (parent.type === "box") {
    return isBoxLabelEdge(parent, label);
  } else if (parent.type === "line" && parent.path) {
    const vertices = simplifyPath(parent.path);
    let onPath = false;
    for (let i = 0; i < label.w; i++) {
      const pt = { x: label.x + i, y: label.y };
      if (vertices.some((tp) => tp.x === pt.x && tp.y === pt.y)) return false;
      if (parent.path.some((tp) => tp.x === pt.x && tp.y === pt.y)) onPath = true;
    }
    return onPath;
  } else if (parent.type === "hub") {
    const gx = parent.x;
    const gy = parent.y;
    if (label.y !== gy) return false;
    const toRight = label.x >= gx + 1 && label.x <= gx + 3;
    const toLeft = label.x + label.w >= gx - 2 && label.x + label.w <= gx;
    if (!toRight && !toLeft) return false;

    const labelEnd = label.x + label.w;
    const gapStart = toRight ? gx + 1 : labelEnd;
    const gapEnd = toRight ? label.x : gx;
    for (let x = gapStart; x < gapEnd; x++) {
      if (!isEmpty(traces, { x, y: gy })) return false;
    }
    return true;
  }
  return false;
}

function isEmpty(traces: TraceBox[], loc: Loc): boolean {
  return traces.every((trace) => !trace.path?.some((step) => eqLoc(step, loc)));
}
