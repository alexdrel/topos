import { parseDiagram } from "../refine.ts";
import { test } from "node:test";
import { partialDeepStrictEqual as assertObjectMatch, deepStrictEqual as assertEquals } from "node:assert/strict";

import { matchChild, matchNode } from '../../test/test-utils.ts';
import { ASCII_PEN, DEFAULT_PEN } from "../../style.ts";

const UNI = DEFAULT_PEN;
const ASCII = ASCII_PEN;
const DBL = { ...DEFAULT_PEN, weight: "double" as const };

test("Visible Space Glyph Becomes Semantic Em Space", () => {
  const root = parseDiagram("A␠B").root;
  matchChild(root, { label: "A B", nodeType: "note" }, 0, 1);
});

test("Visible NBSP Glyph Becomes Semantic Non-Breaking Space", () => {
  const root = parseDiagram("A⍽B").root;
  matchChild(root, { label: "A B", nodeType: "note" }, 0, 1);
});


test("Top Label Only", () => {
  const diagram = `
┌─SERVICE NAME──┐
└───────────────┘
`;

  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "SERVICE NAME" }, 0, 1);
});

test("Diagram Title Detection", () => {
  const diagram = `
   # Diagram Title   
┌───────────────────┐
│        A          │
└───────────────────┘
`;

  const root = parseDiagram(diagram).root;
  matchNode(root, { label: "Diagram Title" });
  matchChild(root, { label: "A", nodeType: "box" }, 0, 1);
});

test("Top Label + Inner Lines", () => {
  const diagram = `
┌─Container─────┐
│  Service A    │
│  Service B    │
│  Service C    │
└───────────────┘
`;

  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Container", $children: 1 }, 0, 1);
  matchChild(box, { label: "Service A\nService B\nService C", nodeType: "note" }, 0, 1);
});

test("Top Label ASCII With Punctuation", () => {
  const diagram = `
+--API/v2_core--+
| Content       |
+---------------+
`;

  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "API/v2_core", $children: 1 }, 0, 1);
  matchChild(box, { label: "Content", nodeType: "note" }, 0, 1);
});

test("Top Label With Spaces", () => {
  const diagram = `
┌─ LABEL WITH SPACES ───┐
│   Content here        │
└───────────────────────┘
`;

  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "LABEL WITH SPACES", $children: 1 }, 0, 1);
  matchChild(box, { label: "Content here", nodeType: "note" }, 0, 1);
});

test("Inline Brackets In Prose", () => {
  const diagram = `
This is a paragraph with [inline box] and some
more text that continues. The parser should not
treat the paragraph boundaries as a box.

┌────────────┐
│ Real Box   │
└────────────┘
`;

  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "Real Box", nodeType: "box" }, (c) => c.label === "Real Box");
});

test("Prose Produces Note Nodes", () => {
  const diagram = `
Some random text with - and | characters
that might look like boxes but aren't.
- bullet points
| pipe separators
`;

  const root = parseDiagram(diagram).root;
  matchChild(root, {
    nodeType: "note",
    label: "Some random text with - and | characters\nthat might look like boxes but aren't.\n- bullet points\n| pipe separators"
  }, 0, 1);
});

test("Mixed Content Box Is Valid", () => {
  const diagram = `
┌────────────────────────────┐
│ This box contains a lot of │
│ prose text that looks like │
│ a paragraph rather than a  │
│ label.                     │
└────────────────────────────┘
`;

  const root = parseDiagram(diagram).root;
  // Box + merged note. No label.
  const box = matchChild(root, { label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "This box contains a lot of\nprose text that looks like\na paragraph rather than a\nlabel.", nodeType: "note" }, 0, 1);
});

test("Box Label: spaced", () => {
  const diagram = `
┌─ SERVICE NAME ─┐
└────────────────┘
`;

  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "SERVICE NAME" }, 0, 1);
  assertObjectMatch(box.rawLabels![0], { text: " SERVICE NAME ", x: 2 });
});

test("Box Label: +/-", () => {
  const diagram = `
┌─SERV+ICE-NAME──┐
└────────────────┘
`;

  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "SERV+ICE-NAME" }, 0, 1);
});


test("Box Label: wire inside", () => {
  const diagram = `
┌─SERV─────NAME──┐
└────────────────┘
`;

  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "SERV NAME" }, 0, 1);
  assertEquals(box.rawLabels?.length, 2);
  assertObjectMatch(box.rawLabels![0], { text: "SERV", x: 2 });
  assertObjectMatch(box.rawLabels![1], { text: "NAME", x: 11 });
});

test("Box Label: 2x2 Junction Grid Label", () => {
  const diagram = `
┌────C1───┬────C2───┐
│  Box A  │  Box B  │
├─────────┼─────────┤
│  Box C  │  Box D  │
└─────────┴─────────┘
`;

  const root = parseDiagram(diagram).root;

  const grid = matchChild(root, { $children: 4 });
  assertEquals(grid.rawLabels?.length, 2);
  assertObjectMatch(grid.rawLabels![0], { text: "C1", x: 5 });
  assertObjectMatch(grid.rawLabels![1], { text: "C2", x: 15 });
});

test("Label Directly After Corner (Unicode)", () => {
  const diagram = `
┌LABEL──┐
│ Body  │
└───────┘
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "LABEL", style: UNI }, 0, 1);
});

test("Label Directly After Corner (Double)", () => {
  const diagram = `
╔═TITLE═╗
║ Body  ║
╚═══════╝
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "TITLE", style: DBL }, 0, 1);
});

test("Label Directly After Corner (ASCII)", () => {
  const diagram = `
+-TITLE-+
| Body  |
+-------+
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "TITLE", style: ASCII }, 0, 1);
});

// --- Shape Edge Cases ---

test("Box - Label on bottom edge", () => {
  const diagram = `\
   ┌─────┐
   │     │
   │     │
   └──B──┘
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "B", style: UNI, $children: 0, $edges: 0 });
});
