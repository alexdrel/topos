import { assertEquals } from '@std/assert';
import { matchChild, matchEdge, testParseDiagram, testCompleted, flushPendingWrites } from '../../test/test-utils.ts';
import { ASCII_PEN, DEFAULT_PEN } from '../../style.ts';

Deno.test.afterEach(flushPendingWrites);

const UNI = DEFAULT_PEN;
const ASCII = ASCII_PEN;

Deno.test("Nested Boxes", (t) => {
  const diagram = `
┌─────────────────────────────┐
│      Container #outer       │
│  ┌───────────┐              │
│  │  Inner A  │              │
│  └───────────┘              │
│                             │
│  ┌───────────┐              │
│  │  Inner B  │              │
│  └───────────┘              │
└─────────────────────────────┘
`;

  const { root } = testParseDiagram(t, diagram);
  // Outer box implicitly wraps its children
  const outer = matchChild(root, { label: "Container", style: UNI, $rawLabels: 1 }, 0, 1);
  assertEquals(outer.rawLabels?.[0].text, "Container #outer");
  // The label is promoted and stripped from children.
  // There is no explicit note object for "Container #outer", it's consumed!
  matchChild(outer, { label: "Inner A" }, 0, 2);
  matchChild(outer, { label: "Inner B" }, 1, 2);
  testCompleted(t);
});

Deno.test("Double Nested Boxes", (t) => {
  const diagram = `
┌────────────────┐
│ Outer          │
│ ┌──────────┐   │
│ │ Middle   │   │
│ │ +------+ │   │
│ │ | In   | │   │
│ │ +------+ │   │
│ └──────────┘   │
└────────────────┘
`;

  const { root } = testParseDiagram(t, diagram);
  const outer = matchChild(root, { label: "Outer" });
  const middle = matchChild(outer, { label: "Middle" });
  matchChild(middle, { label: "In", style: ASCII });
  testCompleted(t);
});

Deno.test("Nested Boxes With Labelled Parent", (t) => {
  const diagram = `
┌─PARENT ZONE──┐
│ ┌────────┐   │
│ │ Alpha  │   │
│ └────────┘   │
│ ┌────────┐   │
│ │ Beta   │   │
│ └────────┘   │
└──────────────┘
`;

  const { root } = testParseDiagram(t, diagram);
  const outer = matchChild(root, { label: "PARENT ZONE" }, 0, 1);
  matchChild(outer, { label: "Alpha" }, 0, 2);
  matchChild(outer, { label: "Beta" }, 1, 2);
  testCompleted(t);
});

Deno.test("Nested Boxes With Dashed Inner", (t) => {
  const diagram = `
┌──────────────┐
│ Parent       │
│ ┌┄┄┄┄┄┄┐     │
│ ┆ Dash ┆     │
│ └┄┄┄┄┄┄┘     │
└──────────────┘
`;

  const { root } = testParseDiagram(t, diagram);
  const outer = matchChild(root, { label: "Parent" }, 0, 1);
  matchChild(outer, { label: "Dash", nodeType: "box", style: { weight: 'dashed' } }, 0, 1);
  testCompleted(t);
});

Deno.test("Nested Boxes With Overlap", (t) => {
  const diagram = `
┌────────────────┐
│     ┌────────┐ │
│     │   B    │ │
│     └────────┘ │
│                │
│       A        │
└────────────────┘
`;

  const { root } = testParseDiagram(t, diagram);
  // A is a note, not a label
  const outer = matchChild(root, { label: undefined }, 0, 1);
  matchChild(outer, { label: "B" }, 0, 2);
  matchChild(outer, { label: "A", nodeType: "note" }, 1, 2);
  testCompleted(t);
});

Deno.test("Nested Boxes With Overlap ASCII", (t) => {
  // Mixed ASCII/Unicode overlap edge case
  const diagram = `
┌──────────────┐
│      +----+  │
│  Labe|ABCD|  │
│      +----+  │
│              │
└──────────────┘
`;

  const { root } = testParseDiagram(t, diagram);
  const outer = matchChild(root, { label: undefined }, 0, 1);
  matchChild(outer, { label: "ABCD" }, 0, 2);
  matchChild(outer, { label: "Labe", nodeType: "note" }, 1, 2);
  testCompleted(t);
});

Deno.test("Adjacent Unicode Boxes Share Edge", (t) => {
  const diagram = `
┌─────┐┌─────┐
│ One ││ Two │
└─────┘└─────┘
`;
  const { root } = testParseDiagram(t, diagram);
  matchChild(root, { label: "One", style: UNI, x: 0, y: 1, w: 7, h: 3 }, 0, 2);
  matchChild(root, { label: "Two", style: UNI, x: 7, y: 1, w: 7, h: 3 }, 1, 2);
  testCompleted(t);
});

Deno.test("Vertically Adjacent Boxes With No Gap", (t) => {
  const diagram = `
┌──────┐
│ Top  │
└──────┘
┌──────┐
│ Bot  │
└──────┘
`;
  const { root } = testParseDiagram(t, diagram);
  matchChild(root, { label: "Top", style: UNI, x: 0, y: 1, w: 8, h: 3 }, 0, 2);
  matchChild(root, { label: "Bot", style: UNI, x: 0, y: 4, w: 8, h: 3 }, 1, 2);
  testCompleted(t);
});

Deno.test("Unicode Boxes", (t) => {
  const diagram = `
  ┌────────────────┐
  │                │
  │       A        │
  │                │  ┌─────┐
  └────────────────┘  │     │
                      │  B  │
┌────────────────┐    │     │
│                │    │     │
│       C        │    └─────┘
│                │
└────────────────┘
`;

  const { root } = testParseDiagram(t, diagram);
  matchChild(root, { label: "A", x: 2, y: 1, w: 18, h: 5 }, 0, 3);
  matchChild(root, { label: "B", x: 22, y: 4, w: 7, h: 6 }, 1, 3);
  matchChild(root, { label: "C", x: 0, y: 7, w: 18, h: 5 }, 2, 3);
  testCompleted(t);
});

Deno.test("Diagonal Corner Touching Boxes Stay Separate", (t) => {
  const diagram = `
┌──┐
│A │
└──┘┌──┐
    │B │
    └──┘
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "A", style: UNI, x: 0, y: 1, w: 4, h: 3 }, 0, 2);
  matchChild(root, { label: "B", style: UNI, x: 4, y: 3, w: 4, h: 3 }, 1, 2);
  testCompleted(t);
});

Deno.test("Small adjacent (ascii) boxes ", (t) => {
  const diagram = `
    ┌───┐   ┌───┐
    │ C ├───┤ D │
    └───┘   └───┘

    +-----+   +-----+
    | One |---> Two |
    +-----+   +-----+

+-----++-----+
| One || Two |
+-----++-----+
+-----+
|Three|
+-----+


+-----+
| One |
+--+--+
   |
+--+--+
| Two |
+-----+
`;
  const root = testParseDiagram(t, diagram).root;

  // Row 1: C, D (Unicode)
  matchChild(root, { label: "C", style: UNI }, 0, 9);
  matchChild(root, { label: "D", style: UNI }, 1, 9);
  matchEdge(root, { direction: "none", source: "C", target: "D" }, e => e.source.node?.label === "C" && e.target.node?.label === "D");

  // Middle ASCII boxes with arrow
  matchChild(root, { label: "One", style: ASCII }, 2, 9);
  matchChild(root, { label: "Two", style: ASCII }, 3, 9);
  matchEdge(root, { direction: "uni", source: "One", target: "Two" }, e => e.source.node?.label === "One" && e.target.node?.y === 5);

  // Adjacent ASCII boxes
  matchChild(root, { label: "One", style: ASCII }, 4, 9);
  matchChild(root, { label: "Two", style: ASCII }, 5, 9);

  // Standalone Three
  matchChild(root, { label: "Three", style: ASCII }, 6, 9);

  // Vertical ASCII boxes with connection
  matchChild(root, { label: "One", style: ASCII }, 7, 9);
  matchChild(root, { label: "Two", style: ASCII }, 8, 9);
  matchEdge(root, { direction: "none", source: "One", target: "Two" }, e => e.source.node?.label === "One" && e.source.node?.y === 17);

  testCompleted(t);
});

// --- Bold Box ---
