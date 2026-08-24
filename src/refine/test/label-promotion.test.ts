import { matchChild, testParseDiagram, testCompleted, flushPendingWrites } from '../../test/test-utils.ts';
import { ASCII_PEN, DEFAULT_PEN } from "../../style.ts";

Deno.test.afterEach(flushPendingWrites);

const UNI = DEFAULT_PEN;
const ASCII = ASCII_PEN;
const ROUND = { ...DEFAULT_PEN, corner: "rounded" as const };

Deno.test("Tall Narrow Content Remains A Note", (t) => {
  // User expects 1 merged note under aggressive merging, no label
  const diagram = `
┌──┐
│AB│
│CD│
│EF│
│GH│
└──┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "AB\nCD\nEF\nGH", nodeType: "note" }, 0, 1);
  testCompleted(t);
});

Deno.test("Multiline Prose Remains A Note", (t) => {
  const diagram = `
┌────────────────────────────┐
│ This box contains a lot of │
│ prose text that looks like │
└────────────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: undefined, $children: 1 }, 0, 1);
  matchChild(box, { label: "This box contains a lot of\nprose text that looks like", nodeType: "note" }, 0, 1);
  testCompleted(t);
});

Deno.test("Explicit Border Label Wins Over Prose", (t) => {
  const diagram = `
┌─Title──────┐
│ Body       │
└────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: "Title", $children: 1 }, 0, 1);
  matchChild(box, { label: "Body", nodeType: "note" }, 0, 1);
  testCompleted(t);
});


Deno.test("Indented List Remains A Note", (t) => {
  const diagram = `
┌─Test─────────────────┐
│ Header text here     │
│  - Item 1            │
│  - Item 2            │
└──────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: "Test", $children: 1 }, 0, 1);
  matchChild(box, { label: "Header text here\n - Item 1\n - Item 2", nodeType: "note" }, 0, 1);
  testCompleted(t);
});

Deno.test("Paragraphs With Blank Lines Remain Notes", (t) => {
  const diagram = `
┌─Test───────────────────────┐
│ Para 1 line 1              │
│ para 1 line 2              │
│                            │
│ Para 2 line 1              │
│ para 2 line 2              │
└────────────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: "Test", $children: 2 }, 0, 1);
  matchChild(box, { label: "Para 1 line 1\npara 1 line 2", nodeType: "note" }, 0, 2);
  matchChild(box, { label: "Para 2 line 1\npara 2 line 2", nodeType: "note" }, 1, 2);
  testCompleted(t);
});

Deno.test("Double Header Prevents Note Merging", (t) => {
  const diagram = `
┌─Test───────────────────────┐
│ ## Centered Title          │
│ ## Centered Subtitle       │
│ ## Centered Body text line │
└────────────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: "Test", $children: 3 }, 0, 1);
  matchChild(box, { label: "Centered Title", nodeType: "note" }, 0, 3);
  matchChild(box, { label: "Centered Subtitle", nodeType: "note" }, 1, 3);
  matchChild(box, { label: "Centered Body text line", nodeType: "note" }, 2, 3);
  testCompleted(t);
});

Deno.test("Multiple Notes Prevent Label Promotion", (t) => {
  const diagram = `
┌────────────────────────────┐
│      Centered Title        │
│                            │
│     Centered Subtitle      │
│  Centered Body text line   │
└────────────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { nodeType: "box", $children: 3 }, 0, 1);
  matchChild(box, { label: "Centered Title", nodeType: "note" }, 0, 3);
  matchChild(box, { label: "Centered Subtitle", nodeType: "note" }, 1, 3);
  matchChild(box, { label: "Centered Body text line", nodeType: "note" }, 2, 3);
  testCompleted(t);
});

Deno.test("Header Promotes Note To Label", (t) => {
  const diagram = `
┌────────────────────────────┐
│ # Centered Title           │
│ ## Centered Subtitle       │
│ ## Centered Body text line │
└────────────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: "Centered Title" }, 0, 1);
  matchChild(box, { label: "Centered Subtitle", nodeType: "note" }, 0, 2);
  matchChild(box, { label: "Centered Body text line", nodeType: "note" }, 1, 2);
  testCompleted(t);
});


Deno.test("Header Promotes Multiline Label", (t) => {
  const diagram = `
┌────────────────────────────┐
│     # Centered Title       │
│     Multi line             │
└────────────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const _box = matchChild(root, { label: "Centered Title\nMulti line" }, 0, 1);
  testCompleted(t);
});

Deno.test("Reflowed Single Line Promotes To Label", (t) => {
  const diagram = `
┌────────────────────────────┐
│    Centered Title          │
│    Multi line ¶            │
└────────────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const _box = matchChild(root, { label: "Centered Title Multi line" }, 0, 1);
  testCompleted(t);
});

Deno.test("Reflow Controls Preserve Note Paragraphs", (t) => {
  const diagram = `
┌─────────────────────────┐
│  This is line one that  │
│ wraps with ⏎ carret.    │
│  Usage line paragraph   │
│ symbol.¶ The End.       │
└─────────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { nodeType: "box" });
  matchChild(box, { label: "This is line one that wraps with\ncarret. Usage line paragraph symbol.\nThe End.", nodeType: "note" });
  testCompleted(t);
});

Deno.test("ASCII Box Prose Remains A Note", (t) => {
  const diagram = `
+------------------+
| Box with + chars |
| and | operators  |
+------------------+
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: undefined, style: ASCII, $children: 1 }, 0, 1);
  matchChild(box, { label: "Box with + chars\nand | operators", nodeType: "note" }, 0, 1);
  testCompleted(t);
});

Deno.test("Inline First Line Is Not Promoted To Label", (t) => {
  const diagram = `
┌──────────────┐
│  (storage1)  │
│  (storage2)  │
└──────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: undefined, style: UNI, $children: 2 }, 0, 1);
  matchChild(box, { label: "storage1", nodeType: "inline" }, 0, 2);
  matchChild(box, { label: "storage2", nodeType: "inline" }, 1, 2);
  testCompleted(t);
});

Deno.test("Header Promotes Across Vertical Gap", (t) => {
  const diagram = `
╭──────────────╮
│  # Database  │
│              │
│ storage line │
╰──────────────╯
`;
  const root = testParseDiagram(t, diagram).root;
  const box = matchChild(root, { label: "Database", style: ROUND, $children: 1 }, 0, 1);
  matchChild(box, { label: "storage line", nodeType: "note" }, 0, 1);
  testCompleted(t);
});
