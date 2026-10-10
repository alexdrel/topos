import { parseDiagram } from "../refine.ts";
import { test } from "node:test";
import { partialDeepStrictEqual as assertObjectMatch } from "node:assert/strict";
import { matchChild } from "../../test/test-utils.ts";
import { DEFAULT_PEN } from "../../style.ts";

const UNI = DEFAULT_PEN;

test("Stacked Box Recognition", () => {
  const diagram = `
   ┌────────────────┐
   │ ┌──────────────┴─┐
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘

   ┌─STACK────────┐
   │┌─────────────┴─┐
   ││┌──────────────┴─┐
   └┤│       2        │
    └┤                │
     └────────────────┘
  `;
  const root = parseDiagram(diagram).root;
  // Each stacked group should be a single outer box, not 3 nested boxes.
  matchChild(root, { label: "1", style: UNI, $children: 0 }, 0, 2);
  matchChild(root, { label: "STACK", style: UNI, $children: 1 }, 1, 2);
});

test("Stacked Box Has No Phantom Edges", () => {
  const diagram = `
   ┌────────────────┐
   │ ┌──────────────┴─┐
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
  `;
  const root = parseDiagram(diagram).root;
  // Each stacked group should be a single outer box, not 3 nested boxes.
  const matchedChild = matchChild(root, { label: "1", style: UNI, $children: 0, $edges: 0 });
  assertObjectMatch(matchedChild.stack!, { layers: 3, dx: -2, dy: -1 });
});

test("Stacked Box Reversed Offsets", () => {
  const diagram = `
        ┌────────────────┐
      ┌─┴──────────────┐ │
    ┌─┴──────────────┐ │ │
  ┌─┴──────────────┐ │ ├─┘
  │       3        │ ├─┘
  │                ├─┘
  └────────────────┘


  ┌────────────────┐
  │       4        ├─┐
  │                │ ├─┐
  └─┬──────────────┘ │ │
    └─┬──────────────┘ │
      └────────────────┘
  `;
  const root = parseDiagram(diagram).root;
  // Each stacked group should be a single outer box, not 3 nested boxes.
  const matchedChild = matchChild(root, { label: "3", style: UNI, $children: 0, $edges: 0 }, 0, 2);
  assertObjectMatch(matchedChild.stack!, { layers: 4, dx: 2, dy: -1 });
  const matchedChild1 = matchChild(root, { label: "4", style: UNI, $children: 0, $edges: 0 }, 1, 2);
  assertObjectMatch(matchedChild1.stack!, { layers: 3, dx: 2, dy: 1 });
});

test("Stacked Box Label On Lower Top Edge", () => {
  const diagram = `\
    ┌────────────────┐
  ┌─┴──────────────┐ │
┌─┴─3────────────┐ │ │
│                │ ├─┘
│                ├─┘
└────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const stack = matchChild(root, { label: "3", style: UNI, $children: 0, $edges: 0 });
  assertObjectMatch(stack.stack!, { layers: 3, dx: 2, dy: -1 });
});

test("Stacked Box Right-Aligned Label On Lower Top Edge", () => {
  const diagram = `\
    ┌────────────────┐
  ┌─┴──────────────┐ │
┌─┴──────────3───┐ │ │
│                │ ├─┘
│                ├─┘
└────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const stack = matchChild(root, { label: "3", style: UNI, $children: 0, $edges: 0 });
  assertObjectMatch(stack.stack!, { layers: 3, dx: 2, dy: -1 });
});

test("Stacked Box Up-Right Offset", () => {
  const diagram = `
     ┌──────────────┐
    ┌┤              │
   ┌┤│      5       │
   ││└─────────────┬┘
   │└─────────────┬┘
   └──────────────┘
  `;
  const root = parseDiagram(diagram).root;
  const matchedChild = matchChild(root, { label: "5", style: UNI, $children: 0, $edges: 0 }, 0, 1);
  assertObjectMatch(matchedChild.stack!, { layers: 3, dx: -1, dy: 1 });
});
