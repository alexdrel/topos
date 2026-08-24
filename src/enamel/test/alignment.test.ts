import { assertEquals, assertAlmostEquals, assertNotEquals } from "@std/assert";
import { parseTopos } from "../../topos.ts";
import { buildSvgTree } from "../svg.ts";
import { CHAR_HEIGHT, CHAR_WIDTH, nodeToRectPx, rectToPx } from "../geometry.ts";
import { matchChildEl } from "../../jsonml/assert.ts";
import { attrs, children, tag } from "../../jsonml/jsonml.ts";
import { calculateTextAlignment, measureText, INSET_PX } from "../alignment.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getLabel(svgTree: ReturnType<typeof buildSvgTree>, nodeClass: string, ndx = 0) {
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: nodeClass }, ndx);
  return matchChildEl(nodeGrp, "text", { class: "tpc-label" });
}

function getNoteInBox(svgTree: ReturnType<typeof buildSvgTree>, boxNdx = 0, noteNdx = 0) {
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const box = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" }, boxNdx);
  const note = matchChildEl(box, "g", { class: "tp-node tp-note" }, noteNdx);
  return matchChildEl(note, "text", { class: "tpc-label" });
}

// Assert that all tspans inside a note <text> element:
//   1. have an explicit numeric x attribute (prevents the staggering bug where
//      undefined x causes SVG to continue the cursor from the previous line end)
//   2. all share the same x value (lines are stacked, not sliding right)
function assertTspansAligned(noteEl: ReturnType<typeof matchChildEl>) {
  const tspans = children(noteEl).filter(c => tag(c) === "tspan");
  if (tspans.length === 0) return;
  const firstX = attrs(tspans[0]).x;
  assertEquals(typeof firstX, "number", "first tspan must have a numeric x");
  for (const tspan of tspans) {
    assertEquals(typeof attrs(tspan).x, "number", "every tspan must have a numeric x");
    assertEquals(attrs(tspan).x, firstX, "all tspans must share the same x");
  }
}

// ─── Box Label Alignment ────────────────────────────────────────────────────────

Deno.test("alignment: box label centered when near center", () => {
  const input = `\
┌────────────┐
│   Label    │
└────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "middle");
});

Deno.test("alignment: box label prefers center when exact authored centering is impossible", () => {
  const input = `\
┌───────────────────┐
│ Deep Space Network│
└───────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "middle");
});

Deno.test("alignment: box ceiling label nearer the left edge stays left-aligned", () => {
  const input = `\
┏━Ground Segment━━━━┓
┃                   ┃
┗━━━━━━━━━━━━━━━━━━━┛
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "start");
});

Deno.test("alignment: box label left-aligned when at left edge", () => {
  const input = `\
┌──────────────────┐
│ Label            │
└──────────────────┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "start");
  assertEquals(attrs(label).x, rectToPx(parsed.root.children[0]).x + INSET_PX);
  assertEquals(attrs(label).dx, undefined);
});

Deno.test("alignment: box label right-aligned when at right edge", () => {
  const input = `\
┌──────────────────┐
│            Label │
└──────────────────┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "end");
  const pxBox = rectToPx(parsed.root.children[0]);
  assertEquals(attrs(label).x, pxBox.x + pxBox.w - INSET_PX);
  assertEquals(attrs(label).dx, undefined);
});

Deno.test("alignment: box ceiling label has hanging baseline", () => {
  const input = `\
┌─Title─────────────┐
│                   │
│                   │
└───────────────────┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, rectToPx(parsed.root.children[0]).y + 3);
  assertEquals(attrs(label).dy, undefined);
});

// ─── Box Multi-line Label ───────────────────────────────────────────────────────

Deno.test("alignment: multi-line box label keeps centered tspans", () => {
  const input = `\
┌───────────────────────────────────┐
│                                   │
│       # Very Long Component       │
│       Descriptive Name            │
│                                   │
└───────────────────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "middle");

  // The independent line-alignment default is centered for labels.
  const tspans = children(label).filter(c => tag(c) === "tspan");
  if (tspans.length > 0) {
    for (const tspan of tspans) {
      assertEquals(attrs(tspan)["text-anchor"], "middle");
    }
  }
});

// ─── Note Alignment (auto-detect from map position) ─────────────────────────────

Deno.test("alignment: note left-aligned when placed at left of parent", () => {
  const input = `\
┌─Box───────────────────┐
│ Note text             │
└───────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  assertEquals(attrs(note)["text-anchor"], "start");
});

Deno.test("alignment: note centered when placed at center of parent", () => {
  const input = `\
┌─Box───────────────────┐
│       Note text       │
└───────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  assertEquals(attrs(note)["text-anchor"], "middle");
});

Deno.test("alignment: long root note flush with the left edge stays left-aligned", () => {
  const input = `\
Fenced text selects code mode automatically:

| Form                | Meaning
| ------------------- | --------------------------------
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getLabel(svgTree, "tp-node tp-note");
  assertEquals(attrs(note)["text-anchor"], "start");
});

Deno.test("alignment: linked notes preserve their authored positions", () => {
  const input = `\
       +--------+
       |        |
    A -+        +-> B

    +-- A
    |
    +---> B`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const notes = ast.nodes.filter((node) => node.nodeType === "note");

  for (const [index, node] of notes.entries()) {
    const label = getLabel(svgTree, "tp-node tp-note", index);
    assertEquals(attrs(label)["text-anchor"], "start");
    assertAlmostEquals(Number(attrs(label).x), node.x * CHAR_WIDTH);
    assertAlmostEquals(Number(attrs(label).y) + 7, (node.y + 0.5) * CHAR_HEIGHT);
    assertEquals(attrs(label)["dominant-baseline"], "hanging");
  }
});

Deno.test("alignment: linked multiline notes preserve their first authored row", () => {
  const input = `\
Alpha line
Beta  line ---> B`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const node = ast.nodes.find((candidate) => candidate.label === "Alpha line\nBeta  line")!;
  const label = getLabel(svgTree, "tp-node tp-note");

  assertEquals(attrs(label)["text-anchor"], "start");
  assertAlmostEquals(Number(attrs(label).x), node.x * CHAR_WIDTH);
  assertAlmostEquals(Number(attrs(label).y) + 7, (node.y + 0.5) * CHAR_HEIGHT);
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertTspansAligned(label);
  const tspans = children(label).filter((child) => tag(child) === "tspan");
  assertEquals(attrs(tspans[0]).dy, 0);
  assertEquals(attrs(tspans[1]).dy, `${CHAR_HEIGHT}px`);
});

// ─── Multi-line Note ────────────────────────────────────────────────────────────

Deno.test("alignment: multi-line note has left-aligned tspans by default", () => {
  const input = `\
┌─Box───────────────────┐
│  Opportunity          │
│  Perseverance         │
│  Curiosity            │
│  Spirit               │
└───────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);

  // Each tspan must be anchored with an explicit x and consistent alignment.
  // Without explicit x, SVG continues the cursor from the line before (staggering bug).
  assertTspansAligned(note);
  const tspans = children(note).filter(c => tag(c) === "tspan");
  if (tspans.length > 0) {
    for (const tspan of tspans) {
      assertEquals(attrs(tspan)["text-anchor"], "start");
    }
  }
});

Deno.test("alignment: multi-line note centered via legend (e.g. compendium #sub: center) centers block as a whole with left-aligned tspans", () => {
  const input = `\
   #sub This file catalogs core Enamel visual schemas using inline map
   sigils and regions. Extracted from compendium.svg visual layout.

:legend
#sub: center
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const noteNode = matchChildEl(diagGrp, "g", { id: "sub" });
  const note = matchChildEl(noteNode, "text", { class: "tpc-label" });

  // Note block element (<text>) is centered as a whole
  assertEquals(attrs(note)["text-anchor"], "middle");

  // Every line (<tspan>) inside the note block is left-aligned ("start")
  assertTspansAligned(note);
  const tspans = children(note).filter(c => tag(c) === "tspan");
  assertEquals(tspans.length, 2);
  for (const tspan of tspans) {
    assertEquals(attrs(tspan)["text-anchor"], "start");
  }
});

Deno.test("alignment: multi-line note with align-center centers each tspan individually", () => {
  const input = `\
   #sub This file catalogs core Enamel visual schemas using inline map
   sigils and regions. Extracted from compendium.svg visual layout.

:legend
#sub: center label=red,align-center
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const noteNode = matchChildEl(diagGrp, "g", { id: "sub" });
  const note = matchChildEl(noteNode, "text", { class: "tpc-label" });

  // Note block element is centered
  assertEquals(attrs(note)["text-anchor"], "middle");

  // Each line (<tspan>) is explicitly centered.
  assertTspansAligned(note);
  const tspans = children(note).filter(c => tag(c) === "tspan");
  assertEquals(tspans.length, 2);
  for (const tspan of tspans) {
    assertEquals(attrs(tspan)["text-anchor"], "middle");
  }
});

Deno.test("alignment: literal text modes preserve their authored row inside a box", () => {
  for (const mode of ["text", "code"]) {
    const input = `\
┌─Box───────────────────┐
│   assert1             │
│   assert2             │
└───────────────────────┘

:legend
Box > (*)  : ${mode}
`;
    const parsed = parseTopos(input);
    const box = parsed.root.children[0];
    const note = box.children[0];
    const result = calculateTextAlignment(note, rectToPx(box), box);

    assertEquals(result.text.x, note.x * CHAR_WIDTH);
    assertEquals(Number(result.text.y) + 7, (note.y + 0.5) * CHAR_HEIGHT);
    assertEquals(result.text["text-anchor"], "start");
    assertEquals(result.text["dominant-baseline"], "hanging");
    assertEquals(result.tspan?.x, note.x * CHAR_WIDTH);
    assertEquals(result.tspan?.["text-anchor"], "start");
    assertEquals(result.tspan?.dy, `${CHAR_HEIGHT}px`);
  }
});

Deno.test("alignment: explicit vertical placement overrides authored preservation", () => {
  const input = `\
┌─Box───────────────────┐
│   Text                │
│                       │
└───────────────────────┘

:legend
Box > (*) : text top=3
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const note = box.children[0];
  const pxBox = rectToPx(box);
  const result = calculateTextAlignment(note, pxBox, box);

  assertEquals(result.text.y, pxBox.y + 3 * CHAR_HEIGHT);
  assertEquals(result.text["dominant-baseline"], "hanging");
});

// ─── Inline Node ────────────────────────────────────────────────────────────────

Deno.test("alignment: inline node is always centered", () => {
  const input = `\
┌───────────────────────┐
│   [ Opportunity  ]    │
│   [   Spirit     ]    │
└───────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const box = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" });
  const inline1 = matchChildEl(box, "g", { class: "tp-node tp-inline" }, 0);
  const label1 = matchChildEl(inline1, "text", { class: "tpc-label" });
  assertEquals(attrs(label1)["text-anchor"], "middle");

  const inline2 = matchChildEl(box, "g", { class: "tp-node tp-inline" }, 1);
  const label2 = matchChildEl(inline2, "text", { class: "tpc-label" });
  assertEquals(attrs(label2)["text-anchor"], "middle");
});

// ─── Hub Label ──────────────────────────────────────────────────────────────────

Deno.test("alignment: hub label left and right of hub", () => {
  const input = `\
  Left ●

  ● Right
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const hub1 = matchChildEl(diagGrp, "g", { class: "tp-node tp-hub" }, 0);
  const label1 = matchChildEl(hub1, "text", { class: "tpc-label" });
  assertEquals(attrs(label1)["text-anchor"], "end");
  assertEquals(attrs(label1).dx, undefined);

  const hub2 = matchChildEl(diagGrp, "g", { class: "tp-node tp-hub" }, 1);
  const label2 = matchChildEl(hub2, "text", { class: "tpc-label" });
  assertEquals(attrs(label2)["text-anchor"], "start");
  assertEquals(attrs(label2).dx, undefined);
});

// ─── Region Label ───────────────────────────────────────────────────────────────

Deno.test("alignment: region label defaults to left and top", () => {
  const input = `\
## Region Title

  ┌───┐
  │ A │
  └───┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-region");
  assertEquals(attrs(label)["text-anchor"], "start");
  assertEquals(attrs(label).x, rectToPx(parsed.root.children[0]).x + INSET_PX);
  assertEquals(attrs(label).dx, undefined);
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, rectToPx(parsed.root.children[0]).y + 9);
  assertEquals(attrs(label).dy, undefined);
});

// ─── Explicit Eidos Overrides ───────────────────────────────────────────────────

Deno.test("alignment: scoped label placement overrides root placement", () => {
  const input = `\
┌───────┐
│  A    │
│       │
└───────┘

:legend
[A]: left label=right
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "end");
  const pxBox = rectToPx(parsed.root.children[0]);
  assertEquals(attrs(label).x, pxBox.x + pxBox.w - INSET_PX);
  assertEquals(attrs(label).dx, undefined);
});

Deno.test("alignment: explicit label=left on hub overrides auto-detect", () => {
  const input = `\
  Top ●

:legend
Top: label=left
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const hubGrp = matchChildEl(diagGrp, "g", { class: "tp-node tp-hub" }, 0);
  const label = matchChildEl(hubGrp, "text", { class: "tpc-label" });
  assertEquals(attrs(label)["text-anchor"], "end");
  assertEquals(attrs(label).dx, undefined);
});

// ─── Symmetrical Vertical Snapping Tests ────────────────────────────────────────

Deno.test("alignment: box label snaps to top line when near top", () => {
  const input = `\
┌───────────┐
│ Label     │
│           │
│           │
└───────────┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, rectToPx(parsed.root.children[0]).y + 9);
  assertEquals(attrs(label).dy, undefined);
});

Deno.test("alignment: box label snaps to middle when near middle", () => {
  const input = `\
┌───────────┐
│           │
│ Label     │
│           │
└───────────┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  const pxBox = rectToPx(parsed.root.children[0]);
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, pxBox.y + pxBox.h / 2 - 7);
  assertEquals(attrs(label).dy, undefined);
});

Deno.test("alignment: box label prefers middle when exact authored centering is impossible", () => {
  const input = `\
┌───────┐
│       │
│ Label │
└───────┘
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const label = getLabel(buildSvgTree(parsed), "tp-node tp-box");
  const pxBox = rectToPx(box);
  assertEquals(attrs(label).y, pxBox.y + pxBox.h / 2 - 7);
});

Deno.test("alignment: box label snaps to bottom when near bottom", () => {
  const input = `\
┌───────────┐
│           │
│           │
│  Lab      │
└───────────┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  const pxBox = rectToPx(parsed.root.children[0]);
  assertEquals(attrs(label)["text-anchor"], "middle");
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, pxBox.y + pxBox.h - 20);
  assertEquals(attrs(label).dy, undefined);
});

Deno.test("alignment: box label on bottom border edge renders inside the box at bottom", () => {
  const input = `\
┌────────────┐
│            │
│            │
│            │
└─────AAA────┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  const pxBox = rectToPx(parsed.root.children[0]);
  assertEquals(attrs(label)["text-anchor"], "middle");
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, pxBox.y + pxBox.h - 20);
  assertEquals(attrs(label).dy, undefined);
});

Deno.test("alignment: perimeter labels survive obstructing child boxes", () => {
  const ceilingInput = `\
┌─Title─────────────┐
│                   │
│   ┌───────────┐   │
│   │ Child     │   │
│   └───────────┘   │
└───────────────────┘`;
  const ceilingParsed = parseTopos(ceilingInput);
  const ceilingBox = ceilingParsed.root.children[0];
  const ceilingLabel = getLabel(buildSvgTree(ceilingParsed), "tp-node tp-box");
  assertEquals(attrs(ceilingLabel).y, rectToPx(ceilingBox).y + 3);

  const bottomInput = `\
┌───────────────────┐
│   ┌───────────┐   │
│   │ Child     │   │
│   └───────────┘   │
│                   │
└──────Title────────┘`;
  const bottomParsed = parseTopos(bottomInput);
  const bottomBox = bottomParsed.root.children[0];
  const bottomLabel = getLabel(buildSvgTree(bottomParsed), "tp-node tp-box");
  const pxBottomBox = rectToPx(bottomBox);
  assertEquals(attrs(bottomLabel).y, pxBottomBox.y + pxBottomBox.h - 20);
});

Deno.test("alignment: left and right perimeter labels survive grid cells", () => {
  const leftInput = `\
┏━Title━━━━┳━━━━━━━━━┓
┃ A        ┃ B       ┃
┗━━━━━━━━━━┻━━━━━━━━━┛`;
  const leftParsed = parseTopos(leftInput);
  const leftLabel = getLabel(buildSvgTree(leftParsed), "tp-node tp-box");
  assertEquals(attrs(leftLabel)["text-anchor"], "start");

  const rightInput = `\
┏━━━━━━━━━━┳━━━Title━┓
┃ A        ┃ B       ┃
┗━━━━━━━━━━┻━━━━━━━━━┛`;
  const rightParsed = parseTopos(rightInput);
  const rightLabel = getLabel(buildSvgTree(rightParsed), "tp-node tp-box");
  assertEquals(attrs(rightLabel)["text-anchor"], "end");
});

Deno.test("alignment: edge notes survive a child box on the same row", () => {
  const input = `\
┌───────────────────────────────────────────────┐
│                    ┌─────┐                    │
│AAAAAA              │     │              ZZZZZZ│
│                    └─────┘                    │
└───────────────────────────────────────────────┘`;
  const svgTree = buildSvgTree(parseTopos(input));
  assertEquals(attrs(getNoteInBox(svgTree, 0, 0))["text-anchor"], "start");
  assertEquals(attrs(getNoteInBox(svgTree, 0, 1))["text-anchor"], "end");
});

Deno.test("alignment: box label snaps to center and middle when centered both horizontally and vertically (e.g. Australia)", () => {
  const input = `\
┌───────────┐
│ Australia │
└───────────┘
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const pxBox = rectToPx(box);
  const res = calculateTextAlignment(box, pxBox, box);

  // Both should snap to middle/center (i.e. horizontal align middle, vertical align middle)
  assertEquals(res.text["text-anchor"], "middle");
  assertEquals(res.text.x, pxBox.x + 0.5 * pxBox.w);
  assertEquals(res.text.dx, undefined);

  assertEquals(res.text["dominant-baseline"], "hanging");
  assertEquals(res.text.y, pxBox.y + 0.5 * pxBox.h - 7);
  assertEquals(res.text.dy, undefined);
});

Deno.test("alignment: grid-cell labels use the rendered cell center", () => {
  const input = `\
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃     Deep Space Network      ┃
┠─────────┬─────────┬─────────┨
┃Goldstone│  Madrid │Canberra ┃
┗━━━━━━━━━┷━━━━━━━━━┷━━━━━━━━━┛`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const cells = parsed.root.children[0].children.filter((node) => node.isGridCell);
  const rootGroup = matchChildEl(svgTree, "g", { class: "tp-root" });
  const gridGroup = matchChildEl(rootGroup, "g", { class: "tp-node tp-box" });
  const gridLabel = matchChildEl(gridGroup, "text", { class: "tpc-label", $text: "Deep Space Network" });

  assertAlmostEquals(Number(attrs(gridLabel).x), nodeToRectPx(parsed.root.children[0]).w / 2);
  assertEquals(attrs(gridLabel).y, CHAR_HEIGHT);

  for (const [index, cell] of cells.entries()) {
    const cellGroup = matchChildEl(gridGroup, "g", { class: "tp-node tp-box tp-grid-cell" }, index);
    const label = matchChildEl(cellGroup, "text", { class: "tpc-label" });
    const pxCell = nodeToRectPx(cell);
    assertAlmostEquals(Number(attrs(label).x), pxCell.x + pxCell.w / 2);
    assertAlmostEquals(Number(attrs(label).y) + 7, pxCell.y + pxCell.h / 2);
  }
});

Deno.test("alignment: box label snaps to explicit fractional vertical slots", () => {
  const input = `\
┌─Box───────┐
│           │
│           │
│           │
└───────────┘

:legend
[Box]: middle=60%
`;
  // Using box at 0,0,13,5 -> middle=60% overrides label y
  const parsed = parseTopos(input);
  const boxNode = parsed.root.children[0];
  // Verify that it parsed as 60%
  assertEquals(boxNode.properties?.middle, "60%");

  const svgTree = buildSvgTree(parsed);
  const label = getLabel(svgTree, "tp-node tp-box");
  const pxBox = rectToPx(boxNode);
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, pxBox.y + 0.6 * pxBox.h - 7);
});

// ─── text-alignment.topos: individual box tests ─────────────────────────────
// These tests are expected to FAIL until the alignment.ts refactoring is done.
// Each test corresponds to one box from examples/cases/text-alignment.topos.

// Top-level title (#t): "Long title text" on the ceiling row of the diagram
Deno.test("text-alignment.topos: top title (#t) has ceiling/hanging baseline", () => {
  const input = `\
           # t

┌l──────────────────────┐
│ b                     │
│                       │
│                       │
└───────────────────────┘

:legend
t: "Long title text"
l: "Long label text"
b: "   Long note text that wraps with ⏎ carret. Usage line paragraph symbol.¶ The End."
`;
  const svgTree = buildSvgTree(parseTopos(input));
  // The top title is a root label, rendered directly inside the root group.
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const label = matchChildEl(diagGrp, "text", { class: "tpc-label" });
  assertEquals(attrs(label)["text-anchor"], "middle");
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
});

// Box l: box with "Long label text" in the ceiling row → ceiling/left-aligned label
Deno.test("text-alignment.topos: box l has left-aligned ceiling label", () => {
  const input = `\
┌l──────────────────────┐
│                       │
│                       │
│                       │
└───────────────────────┘

:legend
l: "Long label text"
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "start");
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
});

// Box b: multi-line note (with ¶ paragraph break) placed at left of the box
// Expected: note block is left-aligned, tspans use "start" anchor
Deno.test("text-alignment.topos: box b multi-line note at left has start-anchored tspans", () => {
  const input = `\
┌─Box───────────────────┐
│ b                     │
│                       │
│                       │
└───────────────────────┘

:legend
b: "   Long note text that wraps with ⏎ carret. Usage line paragraph symbol.¶ The End."
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  assertEquals(attrs(note)["text-anchor"], "start");

  // Each tspan should also be left-aligned
  const tspans = children(note).filter(c => tag(c) === "tspan");
  if (tspans.length > 0) {
    for (const tspan of tspans) {
      assertEquals(attrs(tspan)["text-anchor"], "start");
    }
  }
});

// Center-ceiling label + center-middle note: both l and b are centered in the box.
// l is in the ceiling row at center → hanging baseline, middle anchor.
// b is in the middle row at center → middle baseline, middle anchor.
Deno.test("text-alignment.topos: center-ceiling label and center-middle note align correctly", () => {
  const input = `\
┌───────────l───────────┐
│                       │
│           b           │
│                       │
└───────────────────────┘

:legend
l: "Long label text"
b: "   Long note text that wraps with ⏎ carret. Usage line paragraph symbol.¶ The End."
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);

  // Box label l: ceiling row, center position → hanging + middle anchor
  const label = getLabel(svgTree, "tp-node tp-box");
  assertEquals(attrs(label)["text-anchor"], "middle");
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, rectToPx(parsed.root.children[0]).y + 3);
  assertEquals(attrs(label).dy, undefined);

  // Note b: horizontally centered → middle anchor, vertically placed at center row with hanging baseline
  const note = getNoteInBox(svgTree);
  assertEquals(attrs(note)["text-anchor"], "middle");
  assertEquals(attrs(note)["dominant-baseline"], "hanging");
  assertEquals(attrs(note).dy, undefined);
  const pxBox = rectToPx(parsed.root.children[0]);
  assertEquals(attrs(note).y as number, pxBox.y + 36.2);
});

// R1: note text at left edge → snaps block to left, tspans left-aligned
Deno.test("text-alignment.topos: R1 left-aligned note snaps block to start anchor", () => {
  const input = `\
┌─R1────────────────────┐
│  Opportunity          │
│  Perseverance         │
│  Curiosity            │
│  Spirit               │
└───────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  assertEquals(attrs(note)["text-anchor"], "start");

  const tspans = children(note).filter(c => tag(c) === "tspan");
  assertEquals(tspans.length, 4);
  assertTspansAligned(note);
  for (const tspan of tspans) {
    assertEquals(attrs(tspan)["text-anchor"], "start");
  }
});

// R1 variant: a note's top-level x axis controls block position while keeping tspans left-aligned.
Deno.test("text-alignment.topos: R1 with x=center has centered block and start-anchored tspans", () => {
  const input = `\
┌─R1────────────────────┐
│  Opportunity          │
│  Perseverance         │
│  Curiosity            │
│  Spirit               │
└───────────────────────┘

:legend
[R1] > (*): center
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  // Block is explicitly centered
  assertEquals(attrs(note)["text-anchor"], "middle");

  const tspans = children(note).filter(c => tag(c) === "tspan");
  assertEquals(tspans.length, 4);
  assertTspansAligned(note);
  for (const tspan of tspans) {
    assertEquals(attrs(tspan)["text-anchor"], "start");
  }
});

// Line alignment is independent from the text block's placement.
Deno.test("text-alignment.topos: R1 note respects explicit line alignment", () => {
  const input = `\
┌─R1────────────────────┐
│  Opportunity          │
│  Perseverance         │
│  Curiosity            │
│  Spirit               │
└───────────────────────┘

:legend
[R1] > (*): center align-right
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  // Block is explicitly centered
  assertEquals(attrs(note)["text-anchor"], "middle");

  const tspans = children(note).filter(c => tag(c) === "tspan");
  assertEquals(tspans.length, 4);
  assertTspansAligned(note);
  for (const tspan of tspans) {
    assertEquals(attrs(tspan)["text-anchor"], "end");
  }
});

// R1 variant: right aligns the note block while keeping tspans start-anchored.
Deno.test("text-alignment.topos: R1 with x=right has end-anchored block and start-anchored tspans", () => {
  const input = `\
┌─R1────────────────────┐
│  Opportunity          │
│  Perseverance         │
│  Curiosity            │
│  Spirit               │
└───────────────────────┘

:legend
[R1] > (*): right
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  // Block is explicitly right-positioned
  assertEquals(attrs(note)["text-anchor"], "end");

  const tspans = children(note).filter(c => tag(c) === "tspan");
  assertEquals(tspans.length, 4);
  assertTspansAligned(note);
  for (const tspan of tspans) {
    assertEquals(attrs(tspan)["text-anchor"], "start");
  }
});

// R2: note lines placed center-left → block snaps to center, but tspans should remain left-aligned
// (the default for notes: lineAnchor=start even when block is centered)
Deno.test("text-alignment.topos: R2 center-positioned note has start-anchored tspans by default", () => {
  const input = `\
┌─R2────────────────────┐
│     Opportunity       │
│     Perseverance      │
│     Curiosity         │
│     Spirit            │
└───────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  // Block is near center → text-anchor "middle" for the block
  assertEquals(attrs(note)["text-anchor"], "middle");

  // But tspans should still use "start" anchor (left-aligned lines in centered block)
  const tspans = children(note).filter(c => tag(c) === "tspan");
  assertEquals(tspans.length, 4);
  assertTspansAligned(note);
  for (const tspan of tspans) {
    assertEquals(attrs(tspan)["text-anchor"], "start");
  }
});

// R3: note lines placed at right edge → block is right-aligned, tspans still start-anchored
Deno.test("text-alignment.topos: R3 right-positioned note has end block anchor and start tspans", () => {
  const input = `\
┌─R3────────────────────┐
│          Opportunity  │
│          Perseverance │
│          Curiosity    │
│          Spirit       │
└───────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const note = getNoteInBox(svgTree);
  // Block positioned at right → text-anchor "end"
  assertEquals(attrs(note)["text-anchor"], "end");

  // Tspans should use "start" (default line alignment for notes)
  const tspans = children(note).filter(c => tag(c) === "tspan");
  assertEquals(tspans.length, 4);
  assertTspansAligned(note);
  for (const tspan of tspans) {
    assertEquals(attrs(tspan)["text-anchor"], "start");
  }
});

// R4: lines at varying horizontal positions (each line is a separate note that snaps independently)
Deno.test("text-alignment.topos: R4 staggered note lines each snap independently", () => {
  const input = `\
┌─R4────────────────────┐
│     Opportunity       │
│                       │
│    Perseverance       │
│                       │
│      Curiosity        │
│                       │
│       Spirit          │
└───────────────────────┘
`;
  const parsed = parseTopos(input);
  const svgTree = buildSvgTree(parsed);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const box = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" });

  // There should be 4 separate note nodes (one per non-empty line).
  // All lines sit near the horizontal center of the box → each snaps to "middle".
  // Multiple sibling notes preserve their authored vertical cell centers.
  const pxBox = rectToPx(parsed.root.children[0]);
  for (const [i, mapNote] of parsed.root.children[0].children.entries()) {
    const note = matchChildEl(box, "g", { class: "tp-node tp-note" }, i);
    const label = matchChildEl(note, "text", { class: "tpc-label" });
    assertEquals(attrs(label)["text-anchor"], "middle");
    assertEquals(attrs(label)["dominant-baseline"], "hanging");
    const actualY = attrs(label).y as number;
    assertEquals(actualY + 7, pxBox.y + (mapNote.y - parsed.root.children[0].y + 0.5) * CHAR_HEIGHT);
  }
});

// R5: inline nodes in a box → all rawLabels centered
Deno.test("text-alignment.topos: R5 inline nodes all have middle text-anchor", () => {
  const input = `\
┌─R5────────────────────┐
│   [ Opportunity  ]    │
│   [ Perseverance ]    │
│   [  Curiosity   ]    │
│   [   Spirit     ]    │
└───────────────────────┘
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const box = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" });

  for (let i = 0; i < 4; i++) {
    const inline = matchChildEl(box, "g", { class: "tp-node tp-inline" }, i);
    const label = matchChildEl(inline, "text", { class: "tpc-label" });
    assertEquals(attrs(label)["text-anchor"], "middle");
  }
});

// ─── Unit Tests for calculateTextAlignment ───────────────────────────────────

Deno.test("alignment unit: calculateTextAlignment resolves R1, R2, R3 correctly", () => {
  const input = `\
┌─R1────────────────────┐
│  Opportunity          │
│  Perseverance         │
│  Curiosity            │
│  Spirit               │
└───────────────────────┘
┌─R2────────────────────┐
│     Opportunity       │
│     Perseverance      │
│     Curiosity         │
│     Spirit            │
└───────────────────────┘
┌─R3────────────────────┐
│          Opportunity  │
│          Perseverance │
│          Curiosity    │
│          Spirit       │
└───────────────────────┘
`;
  const parsed = parseTopos(input);
  const r1Box = parsed.root.children[0];
  const r1Note = r1Box.children[0];
  const r2Box = parsed.root.children[1];
  const r2Note = r2Box.children[0];
  const r3Box = parsed.root.children[2];
  const r3Note = r3Box.children[0];

  const pxR1Box = rectToPx(r1Box);
  const pxR2Box = rectToPx(r2Box);
  const pxR3Box = rectToPx(r3Box);

  // R1: Left block alignment, left lines
  const res1 = calculateTextAlignment(r1Note, pxR1Box, r1Box);
  assertEquals(res1.text["text-anchor"], "start");
  assertEquals(res1.text.x, pxR1Box.x + 10);
  assertEquals(res1.tspan?.["text-anchor"], "start");
  assertEquals(res1.tspan?.x, pxR1Box.x + 10);

  // R2: Centered block alignment, left lines
  const res2 = calculateTextAlignment(r2Note, pxR2Box, r2Box);
  assertEquals(res2.text["text-anchor"], "middle");
  const expectedCenter2 = pxR2Box.x + 0.5 * pxR2Box.w;
  assertEquals(res2.text.x, expectedCenter2);
  assertEquals(res2.tspan?.["text-anchor"], "start");
  const width2 = measureText("Perseverance").width * CHAR_WIDTH;
  assertAlmostEquals(res2.tspan?.x ?? 0, expectedCenter2 - width2 / 2);

  // R3: Right block alignment, left lines
  const res3 = calculateTextAlignment(r3Note, pxR3Box, r3Box);
  assertEquals(res3.text["text-anchor"], "end");
  const expectedRight3 = pxR3Box.x + pxR3Box.w - 10;
  assertEquals(res3.text.x, expectedRight3);
  assertEquals(res3.tspan?.["text-anchor"], "start");
  const width3 = measureText("Perseverance").width * CHAR_WIDTH;
  assertAlmostEquals(res3.tspan?.x ?? 0, expectedRight3 - width3);
});

Deno.test("alignment unit: note at 2/3 horizontal position does not snap to left but uses free ratio", () => {
  const input = `\
┌─Box───────────────────┐
│                       │
│               b       │
│                       │
└───────────────────────┘
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const note = box.children[0];
  const pxBox = rectToPx(box);
  const res = calculateTextAlignment(note, pxBox, box);

  // Should use free ratio middle alignment, not snapped to left
  assertEquals(res.text["text-anchor"], "middle");
  const expectedX = pxBox.x + (2 / 3) * pxBox.w;
  assertEquals(res.text.x, expectedX);
});

Deno.test("alignment unit: note near right edge with long text snaps to right alignment to avoid overflow", () => {
  const input = `\
┌─Box───────────────────┐
│                       │
│                   b   │
│                       │
└───────────────────────┘

:legend
b: "Short label that fits"
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const note = box.children[0];
  const pxBox = rectToPx(box);
  const res = calculateTextAlignment(note, pxBox, box);

  // Should have snapped to right alignment
  assertEquals(res.text["text-anchor"], "end");
  assertEquals(res.text.x, pxBox.x + pxBox.w - 10);
});

Deno.test("alignment unit: box label near right edge with long text snaps to right alignment to avoid overflow", () => {
  const input = `\
┌────────────────────l──┐
│                       │
│                       │
│                       │
└───────────────────────┘

:legend
l: "Short label that fits"
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const pxBox = rectToPx(box);
  const res = calculateTextAlignment(box, pxBox, box);

  // Should have snapped to right alignment
  assertEquals(res.text["text-anchor"], "end");
  assertEquals(res.text.x, pxBox.x + pxBox.w - INSET_PX);
  assertEquals(res.text.dx, undefined);
});

Deno.test("alignment unit: calculateTextAlignment resolves explicit legend overrides", () => {
  const input = `\
┌─Box───────┐
│           │
│           │
│           │
└───────────┘

:legend
[Box]: middle=60%
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const pxBox = rectToPx(box);
  const res = calculateTextAlignment(box, pxBox, box);
  assertEquals(res.text["dominant-baseline"], "hanging");
  assertEquals(res.text.y, pxBox.y + 0.6 * pxBox.h - 7);
});

Deno.test("alignment unit: calculateTextAlignment resolves explicit integer overrides as grid offsets", () => {
  const input = `\
┌─Box───────┐
│           │
│           │
│           │
└───────────┘

:legend
[Box]: left=2 top=3
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const pxBox = rectToPx(box);
  const res = calculateTextAlignment(box, pxBox, box);

  // Horizontal left=2 -> starts at left (align=start) with offset 2 * CHAR_WIDTH
  assertEquals(res.text["text-anchor"], "start");
  assertEquals(res.text.x, pxBox.x + 2 * CHAR_WIDTH);
  assertEquals(res.text.dx, undefined);

  // Vertical top=3 -> hanging at the final grid position
  assertEquals(res.text["dominant-baseline"], "hanging");
  assertEquals(res.text.y, pxBox.y + 3 * CHAR_HEIGHT);
  assertEquals(res.text.dy, undefined);
});

Deno.test("alignment unit: calculateTextAlignment resolves explicit center and middle overrides as middle-aligned offsets", () => {
  const input = `\
┌─Box───────┐
│           │
│           │
│           │
└───────────┘

:legend
[Box]: center=5 middle=4
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const pxBox = rectToPx(box);
  const res = calculateTextAlignment(box, pxBox, box);

  // Horizontal center=5 -> center-aligned (align=middle) with offset 5 * CHAR_WIDTH
  assertEquals(res.text["text-anchor"], "middle");
  assertEquals(res.text.x, pxBox.x + 5 * CHAR_WIDTH);
  assertEquals(res.text.dx, undefined);

  // Vertical middle=4 -> the text block is centered on the final grid position
  assertEquals(res.text["dominant-baseline"], "hanging");
  assertEquals(res.text.y, pxBox.y + 4 * CHAR_HEIGHT - 7);
  assertEquals(res.text.dy, undefined);
});

Deno.test("alignment unit: left and top map coordinates bypass nested note heuristics", () => {
  const diagram = `\
┌─Box───────────────────┐
│   Note                │
│                       │
│                       │
└───────────────────────┘

:legend
Note: "A replacement ⏎ note"`;
  const automatic = parseTopos(diagram);
  const mapped = parseTopos(`${diagram} left=map top=map`);
  const automaticBox = automatic.root.children[0];
  const box = mapped.root.children[0];
  const automaticNote = automaticBox.children[0];
  const note = box.children[0];
  const automaticAlignment = calculateTextAlignment(automaticNote, rectToPx(automaticBox), automaticBox);
  const mapAlignment = calculateTextAlignment(note, rectToPx(box), box);

  assertNotEquals(Number(automaticAlignment.text.x), note.x * CHAR_WIDTH);
  assertNotEquals(Number(automaticAlignment.text.y), note.y * CHAR_HEIGHT);
  assertEquals(mapAlignment.text["text-anchor"], "start");
  assertEquals(mapAlignment.text.x, note.x * CHAR_WIDTH);
  assertEquals(mapAlignment.text["dominant-baseline"], "hanging");
  assertEquals(mapAlignment.text.y, note.y * CHAR_HEIGHT);
  assertEquals(mapAlignment.tspan?.dy, "1.2em");
});

Deno.test("alignment unit: center and middle map coordinates bypass nested note heuristics", () => {
  const diagram = `\
┌─Box───────────────────┐
│   Note                │
│                       │
│                       │
└───────────────────────┘

:legend
Note: "A replacement ⏎ note"`;
  const automatic = parseTopos(diagram);
  const mapped = parseTopos(`${diagram} center=map middle=map`);
  const automaticBox = automatic.root.children[0];
  const box = mapped.root.children[0];
  const automaticNote = automaticBox.children[0];
  const note = box.children[0];
  const automaticAlignment = calculateTextAlignment(automaticNote, rectToPx(automaticBox), automaticBox);
  const mapAlignment = calculateTextAlignment(note, rectToPx(box), box);

  const authoredCenterX = (note.x + note.w / 2) * CHAR_WIDTH;
  const authoredMiddleY = (note.y + note.h / 2) * CHAR_HEIGHT;
  assertNotEquals(Number(automaticAlignment.text.x) + Number(automaticAlignment.text.dx ?? 0), authoredCenterX);
  assertNotEquals(Number(automaticAlignment.text.y) + 15.4, authoredMiddleY);
  assertEquals(mapAlignment.text["text-anchor"], "middle");
  assertEquals(Number(mapAlignment.text.x) + Number(mapAlignment.text.dx ?? 0), authoredCenterX);
  assertEquals(mapAlignment.text["dominant-baseline"], "hanging");
  assertEquals(Number(mapAlignment.text.y) + 15.4, authoredMiddleY);
  assertEquals(mapAlignment.tspan?.dy, "1.2em");
});

Deno.test("alignment unit: right map coordinate preserves the authored text edge", () => {
  const diagram = `\
┌─Box───────────────────┐
│   Note                │
│                       │
└───────────────────────┘

:legend
Note: "A replacement ⏎ note" right=map`;
  const parsed = parseTopos(diagram);
  const box = parsed.root.children[0];
  const note = box.children[0];
  const alignment = calculateTextAlignment(note, rectToPx(box), box);

  assertEquals(alignment.text["text-anchor"], "end");
  assertEquals(alignment.text.x, (note.x + note.w) * CHAR_WIDTH);
});

Deno.test("alignment unit: leading controls multiline spacing", () => {
  const input = `\
┌─Box───────────────────┐
│   Note                │
│                       │
└───────────────────────┘

:legend
Note: "First ⏎ Second" leading=2 middle=50%
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const note = box.children[0];
  const result = calculateTextAlignment(note, rectToPx(box), box);

  assertEquals(result.tspan?.dy, "48px");
  assertEquals(result.text.y, rectToPx(box).y + rectToPx(box).h / 2 - 31);
});

Deno.test("alignment unit: multi-line box label tspan re-anchors each line at the same x (centered)", () => {
  const input = `\
┌───────────────────────────────────┐
│                                   │
│       # Very Long Component       │
│       Descriptive Name            │
│                                   │
└───────────────────────────────────┘
`;
  const parsed = parseTopos(input);
  const box = parsed.root.children[0];
  const pxBox = rectToPx(box);
  const res = calculateTextAlignment(box, pxBox, box);

  // Explicitly centered: text-anchor=middle, x at center
  assertEquals(res.text["text-anchor"], "middle");
  const centerX = pxBox.x + 0.5 * pxBox.w;
  assertEquals(res.text.x, centerX);

  // tspan must carry x so each line re-anchors to the same center (not continuing from line end)
  assertEquals(res.tspan?.x, centerX);
  assertEquals(res.tspan?.dx, undefined); // no offset for center slot
});
