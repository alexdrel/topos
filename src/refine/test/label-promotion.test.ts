import { parseDiagram } from "../refine.ts";
import { test } from "node:test";
import { matchChild } from '../../test/test-utils.ts';
import { ASCII_PEN, DEFAULT_PEN } from "../../style.ts";

const UNI = DEFAULT_PEN;
const ASCII = ASCII_PEN;
const ROUND = { ...DEFAULT_PEN, corner: "rounded" as const };

test("Tall Narrow Content Remains A Note", () => {
  // User expects 1 merged note under aggressive merging, no label
  const diagram = `
┌──┐
│AB│
│CD│
│EF│
│GH│
└──┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "AB\nCD\nEF\nGH", nodeType: "note" }, 0, 1);
});

test("Multiline Prose Remains A Note", () => {
  const diagram = `
┌────────────────────────────┐
│ This box contains a lot of │
│ prose text that looks like │
└────────────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "This box contains a lot of\nprose text that looks like", nodeType: "note" }, 0, 1);
});

test("Explicit Border Label Wins Over Prose", () => {
  const diagram = `
┌─Title──────┐
│ Body       │
└────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Title", $children: 1 }, 0, 1);
  matchChild(box, { label: "Body", nodeType: "note" }, 0, 1);
});


test("Indented List Remains A Note", () => {
  const diagram = `
┌─Test─────────────────┐
│ Header text here     │
│  - Item 1            │
│  - Item 2            │
└──────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Test", $children: 1 }, 0, 1);
  matchChild(box, { label: "Header text here\n - Item 1\n - Item 2", nodeType: "note" }, 0, 1);
});

test("Paragraphs With Blank Lines Remain Notes", () => {
  const diagram = `
┌─Test───────────────────────┐
│ Para 1 line 1              │
│ para 1 line 2              │
│                            │
│ Para 2 line 1              │
│ para 2 line 2              │
└────────────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Test", $children: 2 }, 0, 1);
  matchChild(box, { label: "Para 1 line 1\npara 1 line 2", nodeType: "note" }, 0, 2);
  matchChild(box, { label: "Para 2 line 1\npara 2 line 2", nodeType: "note" }, 1, 2);
});

test("Double Header Prevents Note Merging", () => {
  const diagram = `
┌─Test───────────────────────┐
│ ## Centered Title          │
│ ## Centered Subtitle       │
│ ## Centered Body text line │
└────────────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Test", $children: 3 }, 0, 1);
  matchChild(box, { label: "Centered Title", nodeType: "note" }, 0, 3);
  matchChild(box, { label: "Centered Subtitle", nodeType: "note" }, 1, 3);
  matchChild(box, { label: "Centered Body text line", nodeType: "note" }, 2, 3);
});

test("Multiple Notes Prevent Label Promotion", () => {
  const diagram = `
┌────────────────────────────┐
│      Centered Title        │
│                            │
│     Centered Subtitle      │
│  Centered Body text line   │
└────────────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { nodeType: "box", $children: 3 }, 0, 1);
  matchChild(box, { label: "Centered Title", nodeType: "note" }, 0, 3);
  matchChild(box, { label: "Centered Subtitle", nodeType: "note" }, 1, 3);
  matchChild(box, { label: "Centered Body text line", nodeType: "note" }, 2, 3);
});

test("Header Promotes Note To Label", () => {
  const diagram = `
┌────────────────────────────┐
│ # Centered Title           │
│ ## Centered Subtitle       │
│ ## Centered Body text line │
└────────────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Centered Title" }, 0, 1);
  matchChild(box, { label: "Centered Subtitle", nodeType: "note" }, 0, 2);
  matchChild(box, { label: "Centered Body text line", nodeType: "note" }, 1, 2);
});


test("Header Promotes Multiline Label", () => {
  const diagram = `
┌────────────────────────────┐
│     # Centered Title       │
│     Multi line             │
└────────────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const _box = matchChild(root, { label: "Centered Title\nMulti line" }, 0, 1);
});

test("Reflowed Single Line Promotes To Label", () => {
  const diagram = `
┌────────────────────────────┐
│    Centered Title          │
│    Multi line ¶            │
└────────────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const _box = matchChild(root, { label: "Centered Title Multi line" }, 0, 1);
});

test("Reflow Controls Preserve Note Paragraphs", () => {
  const diagram = `
┌─────────────────────────┐
│  This is line one that  │
│ wraps with ⏎ carret.    │
│  Usage line paragraph   │
│ symbol.¶ The End.       │
└─────────────────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { nodeType: "box" });
  matchChild(box, { label: "This is line one that wraps with\ncarret. Usage line paragraph symbol.\nThe End.", nodeType: "note" });
});

test("ASCII Box Prose Remains A Note", () => {
  const diagram = `
+------------------+
| Box with + chars |
| and | operators  |
+------------------+
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: undefined, style: ASCII, $children: 1 }, 0, 1);
  matchChild(box, { label: "Box with + chars\nand | operators", nodeType: "note" }, 0, 1);
});

test("Inline First Line Is Not Promoted To Label", () => {
  const diagram = `
┌──────────────┐
│  (storage1)  │
│  (storage2)  │
└──────────────┘
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: undefined, style: UNI, $children: 2 }, 0, 1);
  matchChild(box, { label: "storage1", nodeType: "inline" }, 0, 2);
  matchChild(box, { label: "storage2", nodeType: "inline" }, 1, 2);
});

test("Header Promotes Across Vertical Gap", () => {
  const diagram = `
╭──────────────╮
│  # Database  │
│              │
│ storage line │
╰──────────────╯
`;
  const root = parseDiagram(diagram).root;
  const box = matchChild(root, { label: "Database", style: ROUND, $children: 1 }, 0, 1);
  matchChild(box, { label: "storage line", nodeType: "note" }, 0, 1);
});
