import { assertEquals } from "@std/assert";
import { matchChild, testParseDiagram, testCompleted, flushPendingWrites } from "../../test/test-utils.ts";
import { ASCII_PEN, DEFAULT_PEN, PenStyle } from "../../style.ts";

Deno.test.afterEach(flushPendingWrites);

const UNI = DEFAULT_PEN;
const ASCII = ASCII_PEN;
const DBL = { ...DEFAULT_PEN, weight: "double" as const };
const ROUND = { ...DEFAULT_PEN, corner: "rounded" as const };
const ASCII_D: PenStyle = { ...ASCII_PEN, weight: "double" };

Deno.test("Minimal 3x3 Unicode Box", (t) => {
  const diagram = `
┌─┐
│X│
└─┘
`;
  const { root } = testParseDiagram(t, diagram);
  matchChild(root, { label: "X", w: 3, h: 3, style: UNI }, 0, 1);
  testCompleted(t);
});

Deno.test("Minimal 3x3 ASCII Box", (t) => {
  const diagram = `
+-+
|Y|
+-+
`;
  const { root } = testParseDiagram(t, diagram);
  matchChild(root, { label: "Y", w: 3, h: 3, style: ASCII }, 0, 1);
  testCompleted(t);
});

Deno.test("Minimal 3x3 Rounded Box", (t) => {
  const diagram = `
╭─╮
│Z│
╰─╯
`;
  const { root } = testParseDiagram(t, diagram);
  matchChild(root, { label: "Z", w: 3, h: 3, style: ROUND }, 0, 1);
  testCompleted(t);
});

Deno.test("Minimal 3x3 Double Box", (t) => {
  const diagram = `
╔═╗
║Q║
╚═╝
`;
  const { root } = testParseDiagram(t, diagram);
  matchChild(root, { label: "Q", w: 3, h: 3, style: DBL }, 0, 1);
  testCompleted(t);
});

Deno.test("Unicode Box", (t) => {
  const diagram = `
┌──────────────┐
│  API Server  │
│  #api .core  │
└──────────────┘
`;

  const { root } = testParseDiagram(t, diagram);
  const box = matchChild(root, { label: "API Server", style: UNI, $children: 0, $rawLabels: 1 }, 0, 1);
  assertEquals(box.rawLabels?.[0].text, "API Server\n#api .core");
  testCompleted(t);
});

Deno.test("ASCII Box Using Only - and | (Simple)", (t) => {
  const diagram = `
---
|A|
+--
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "A", style: ASCII });
  testCompleted(t);
});

Deno.test("ASCII Box Using Only = and | (Wide)", (t) => {
  const diagram = `
=========
| Alpha |
=========

========|
| Beta  |
|========
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "Alpha", style: ASCII_D }, 0, 2);
  matchChild(root, { label: "Beta" }, 1, 2);
  testCompleted(t);
});

Deno.test("ASCII Box Using Only - and | (Tall)", (t) => {
  const diagram = `
------
| A  |
| B  |
------
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "A\nB", nodeType: "note" }, 0, 1);
  testCompleted(t);
});

Deno.test("Mixed ASCII and Unicode Box Borders", (t) => {
  const diagram = `
+──────────┐
| Mixed    │
+──────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "Mixed" }, 0, 1);
  testCompleted(t);
});

Deno.test("Mixed ASCII and Unicode (Patched)", (t) => {
  const diagram = `
+-------------+
| Old System  |
+-------------+
     |
     v
┌─────────────┐
│ New System  │
└─────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "Old System", nodeType: "box", style: ASCII, x: 0, y: 1 }, 0, 2);
  matchChild(root, { label: "New System", nodeType: "box", style: UNI, x: 0, y: 6 }, 1, 2);
  testCompleted(t);
});

Deno.test("Mixed Style: Unicode, Rounded Corner Priority", (t) => {
  const diagram = `
+---+
|   |
╰───┘
`;
  const root = testParseDiagram(t, diagram).root;
  // This currently fails (resolves to ascii/sharp due to "last-seen-wins" traversal logic)
  matchChild(root, { nodeType: "box", style: { family: "unicode", weight: "single", corner: "rounded" } });
  testCompleted(t);
});

Deno.test("2-Row Boxes (No Interior)", (t) => {
  const cases = [
    {
      diagram: `
┌──┐
└──┘
`, style: UNI
    },
    {
      diagram: `
╭──╮
╰──╯
`, style: ROUND
    },
    {
      diagram: `
╔══╗
╚══╝
`,
      style: DBL,
    },
  ];

  for (const c of cases) {
    const root = testParseDiagram(t, c.diagram).root;
    matchChild(root, { w: 4, h: 2, style: c.style, label: undefined, $children: 0 }, 0, 1);
  }
  testCompleted(t);
});

Deno.test("Empty Unicode Box Interior", (t) => {
  const diagram = `
┌────┐
│    │
└────┘
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { style: UNI, label: undefined, $children: 0 }, 0, 1);
  testCompleted(t);
});

Deno.test("Empty ASCII Box Interior", (t) => {
  const diagram = `
+----+
|    |
+----+
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { style: ASCII, label: undefined, $children: 0 }, 0, 1);
  testCompleted(t);
});

// --- Label Position Edge Cases ---

Deno.test("Wide Thin Box (1-row interior)", (t) => {
  const diagram = `
┌──────────────────────┐
│  Wide Content Here   │
└──────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "Wide Content Here", style: UNI, h: 3 }, 0, 1);
  testCompleted(t);
});

Deno.test("Tall Narrow Box", (t) => {
  const diagram = `
┌──┐
│AB│
│CD│
│EF│
│GH│
└──┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { w: 4, h: 6, label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "AB\nCD\nEF\nGH", nodeType: "note" }, 0, 1);
  testCompleted(t);
});

Deno.test("Rounded Box with Braces", (t) => {
  const diagram = `
╭──────────────╮
│  # Database  │
│ (ClickHouse) │
╰──────────────╯
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: "Database", style: ROUND, $children: 1 }, 0, 1);
  matchChild(box, { label: "ClickHouse", nodeType: "inline" }, 0, 1);
  testCompleted(t);
});

Deno.test("Rounded Box with Braces 1", (t) => {
  const diagram = `
╭──────────────╮
│  # Database  │
│   (storage)  │
╰──────────────╯
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: "Database", style: ROUND, $children: 1 }, 0, 1);
  matchChild(box, { label: "storage", nodeType: "inline" }, 0, 1);
  testCompleted(t);
});

Deno.test("Bold Box (┏━┓) detected as bold", (t) => {
  const diagram = `
┏━━━━━━━━┓
┃  Bold  ┃
┗━━━━━━━━┛
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "Bold", style: { weight: 'bold' } }, 0, 1);
  testCompleted(t);
});
