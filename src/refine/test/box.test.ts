import { parseDiagram } from "../refine.ts";
import { test } from "node:test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { matchChild } from "../../test/test-utils.ts";
import { ASCII_PEN, DEFAULT_PEN, PenStyle } from "../../style.ts";

const UNI = DEFAULT_PEN;
const ASCII = ASCII_PEN;
const DBL = { ...DEFAULT_PEN, weight: "double" as const };
const ROUND = { ...DEFAULT_PEN, corner: "rounded" as const };
const ASCII_D: PenStyle = { ...ASCII_PEN, weight: "double" };

test("Minimal 3x3 Unicode Box", () => {
  const diagram = `
┌─┐
│X│
└─┘
`;
  const { root } = parseDiagram(diagram);
  matchChild(root, { label: "X", w: 3, h: 3, style: UNI }, 0, 1);
});

test("Minimal 3x3 ASCII Box", () => {
  const diagram = `
+-+
|Y|
+-+
`;
  const { root } = parseDiagram(diagram);
  matchChild(root, { label: "Y", w: 3, h: 3, style: ASCII }, 0, 1);
});

test("Minimal 3x3 Rounded Box", () => {
  const diagram = `
╭─╮
│Z│
╰─╯
`;
  const { root } = parseDiagram(diagram);
  matchChild(root, { label: "Z", w: 3, h: 3, style: ROUND }, 0, 1);
});

test("Minimal 3x3 Double Box", () => {
  const diagram = `
╔═╗
║Q║
╚═╝
`;
  const { root } = parseDiagram(diagram);
  matchChild(root, { label: "Q", w: 3, h: 3, style: DBL }, 0, 1);
});

test("Unicode Box", () => {
  const diagram = `
┌──────────────┐
│  API Server  │
│  #api .core  │
└──────────────┘
`;

  const { root } = parseDiagram(diagram);
  const box = matchChild(root, { label: "API Server", style: UNI, $children: 0, $rawLabels: 1 }, 0, 1);
  assertEquals(box.rawLabels?.[0].text, "API Server\n#api .core");
});

test("ASCII Box Using Only - and | (Simple)", () => {
  const diagram = `
---
|A|
+--
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "A", style: ASCII });
});

test("ASCII Box Using Only = and | (Wide)", () => {
  const diagram = `
=========
| Alpha |
=========

========|
| Beta  |
|========
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "Alpha", style: ASCII_D }, 0, 2);
  matchChild(root, { label: "Beta" }, 1, 2);
});

test("ASCII Box Using Only - and | (Tall)", () => {
  const diagram = `
------
| A  |
| B  |
------
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "A\nB", nodeType: "note" }, 0, 1);
});

test("Mixed ASCII and Unicode Box Borders", () => {
  const diagram = `
+──────────┐
| Mixed    │
+──────────┘
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "Mixed" }, 0, 1);
});

test("Mixed ASCII and Unicode (Patched)", () => {
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
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "Old System", nodeType: "box", style: ASCII, x: 0, y: 1 }, 0, 2);
  matchChild(root, { label: "New System", nodeType: "box", style: UNI, x: 0, y: 6 }, 1, 2);
});

test("Mixed Style: Unicode, Rounded Corner Priority", () => {
  const diagram = `
+---+
|   |
╰───┘
`;
  const root = parseDiagram(diagram).root;
  // This currently fails (resolves to ascii/sharp due to "last-seen-wins" traversal logic)
  matchChild(root, { nodeType: "box", style: { family: "unicode", weight: "single", corner: "rounded" } });
});

test("2-Row Boxes (No Interior)", () => {
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
    const root = parseDiagram(c.diagram).root;
    matchChild(root, { w: 4, h: 2, style: c.style, label: undefined, $children: 0 }, 0, 1);
  }
});

test("Empty Unicode Box Interior", () => {
  const diagram = `
┌────┐
│    │
└────┘
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { style: UNI, label: undefined, $children: 0 }, 0, 1);
});

test("Empty ASCII Box Interior", () => {
  const diagram = `
+----+
|    |
+----+
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { style: ASCII, label: undefined, $children: 0 }, 0, 1);
});

// --- Label Position Edge Cases ---

test("Wide Thin Box (1-row interior)", () => {
  const diagram = `
┌──────────────────────┐
│  Wide Content Here   │
└──────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "Wide Content Here", style: UNI, h: 3 }, 0, 1);
});

test("Tall Narrow Box", () => {
  const diagram = `
┌──┐
│AB│
│CD│
│EF│
│GH│
└──┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { w: 4, h: 6, label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "AB\nCD\nEF\nGH", nodeType: "note" }, 0, 1);
});

test("Rounded Box with Braces", () => {
  const diagram = `
╭──────────────╮
│  # Database  │
│ (ClickHouse) │
╰──────────────╯
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Database", style: ROUND, $children: 1 }, 0, 1);
  matchChild(box, { label: "ClickHouse", nodeType: "inline" }, 0, 1);
});

test("Rounded Box with Braces 1", () => {
  const diagram = `
╭──────────────╮
│  # Database  │
│   (storage)  │
╰──────────────╯
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Database", style: ROUND, $children: 1 }, 0, 1);
  matchChild(box, { label: "storage", nodeType: "inline" }, 0, 1);
});

test("Bold Box (┏━┓) detected as bold", () => {
  const diagram = `
┏━━━━━━━━┓
┃  Bold  ┃
┗━━━━━━━━┛
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "Bold", style: { weight: 'bold' } }, 0, 1);
});
