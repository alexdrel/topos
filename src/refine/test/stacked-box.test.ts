import { assertObjectMatch } from "@std/assert";
import { matchChild, testParseDiagram, testCompleted, flushPendingWrites } from "../../test/test-utils.ts";
import { DEFAULT_PEN } from "../../style.ts";

Deno.test.afterEach(flushPendingWrites);

const UNI = DEFAULT_PEN;

Deno.test("Stacked Box Recognition", (t) => {
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
  const root = testParseDiagram(t, diagram).root;
  // Each stacked group should be a single outer box, not 3 nested boxes.
  matchChild(root, { label: "1", style: UNI, $children: 0 }, 0, 2);
  matchChild(root, { label: "STACK", style: UNI, $children: 1 }, 1, 2);
  testCompleted(t);
});

Deno.test("Stacked Box Has No Phantom Edges", (t) => {
  const diagram = `
   ┌────────────────┐
   │ ┌──────────────┴─┐
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
  `;
  const root = testParseDiagram(t, diagram).root;
  // Each stacked group should be a single outer box, not 3 nested boxes.
  const matchedChild = matchChild(root, { label: "1", style: UNI, $children: 0, $edges: 0 });
  assertObjectMatch(matchedChild.stack!, { layers: 3, dx: -2, dy: -1 });
  testCompleted(t);
});

Deno.test("Stacked Box Reversed Offsets", (t) => {
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
  const root = testParseDiagram(t, diagram).root;
  // Each stacked group should be a single outer box, not 3 nested boxes.
  const matchedChild = matchChild(root, { label: "3", style: UNI, $children: 0, $edges: 0 }, 0, 2);
  assertObjectMatch(matchedChild.stack!, { layers: 4, dx: 2, dy: -1 });
  const matchedChild1 = matchChild(root, { label: "4", style: UNI, $children: 0, $edges: 0 }, 1, 2);
  assertObjectMatch(matchedChild1.stack!, { layers: 3, dx: 2, dy: 1 });

  testCompleted(t);
});

Deno.test("Stacked Box Label On Lower Top Edge", (t) => {
  const diagram = `\
    ┌────────────────┐
  ┌─┴──────────────┐ │
┌─┴─3────────────┐ │ │
│                │ ├─┘
│                ├─┘
└────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const stack = matchChild(root, { label: "3", style: UNI, $children: 0, $edges: 0 });
  assertObjectMatch(stack.stack!, { layers: 3, dx: 2, dy: -1 });
  testCompleted(t);
});

Deno.test("Stacked Box Right-Aligned Label On Lower Top Edge", (t) => {
  const diagram = `\
    ┌────────────────┐
  ┌─┴──────────────┐ │
┌─┴──────────3───┐ │ │
│                │ ├─┘
│                ├─┘
└────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const stack = matchChild(root, { label: "3", style: UNI, $children: 0, $edges: 0 });
  assertObjectMatch(stack.stack!, { layers: 3, dx: 2, dy: -1 });
  testCompleted(t);
});

Deno.test("Stacked Box Up-Right Offset", (t) => {
  const diagram = `
     ┌──────────────┐
    ┌┤              │
   ┌┤│      5       │
   ││└─────────────┬┘
   │└─────────────┬┘
   └──────────────┘
  `;
  const root = testParseDiagram(t, diagram).root;
  const matchedChild = matchChild(root, { label: "5", style: UNI, $children: 0, $edges: 0 }, 0, 1);
  assertObjectMatch(matchedChild.stack!, { layers: 3, dx: -1, dy: 1 });
  testCompleted(t);
});
