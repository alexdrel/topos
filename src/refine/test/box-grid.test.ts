import { parseDiagram } from "../refine.ts";
import { test } from "node:test";
import { matchChild, matchEdge } from '../../test/test-utils.ts';

test("2x2 Junction Grid", () => {
  const diagram = `
┌─────────┬─────────┐
│  Box A  │  Box B  │
├─────────┼─────────┤
│  Box C  │  Box D  │
└─────────┴─────────┘
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  matchChild(container, { label: "Box A", nodeType: "box" }, 0, 4);
  matchChild(container, { label: "Box B", nodeType: "box" }, 1, 4);
  matchChild(container, { label: "Box C", nodeType: "box" }, 2, 4);
  matchChild(container, { label: "Box D", nodeType: "box" }, 3, 4);
});

test("1x3 Junction Grid", () => {
  const diagram = `
┌─────┬─────┬─────┐
│ A   │ B   │ C   │
└──┬──┴─────┴──▲──┘
   │           │
   └───────────┘
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  const a = matchChild(container, { label: "A", nodeType: "box" }, 0, 3);
  matchChild(container, { label: "B", nodeType: "box" }, 1, 3);
  const c = matchChild(container, { label: "C", nodeType: "box" }, 2, 3);

  // Assert the edge connects cell A to cell C
  matchEdge(root, { source: a, target: c, direction: "uni" }, 0, 1);
});

test("3x1 Junction Grid (Unicode)", () => {
  const diagram = `
┌───┐
│ A │
├───┤
│ B │
├───┤
│ C │
└───┘
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  matchChild(container, { label: "A", nodeType: "box" }, 0, 3);
  matchChild(container, { label: "B", nodeType: "box" }, 1, 3);
  matchChild(container, { label: "C", nodeType: "box" }, 2, 3);
});

test("3x1 Junction Grid (ASCII)", () => {
  const diagram = `
+---+
| A |
+---+
| B |
+---+
| C |
+---+
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  matchChild(container, { label: "A", nodeType: "box" }, 0, 3);
  matchChild(container, { label: "B", nodeType: "box" }, 1, 3);
  matchChild(container, { label: "C", nodeType: "box" }, 2, 3);
});

test("2x2 Junction Grid (Double Unicode)", () => {
  const diagram = `
╔═════╦═════╗
║  W  ║  X  ║
╠═════╬═════╣
║  Y  ║  Z  ║
╚═════╩═════╝
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  matchChild(container, { label: "W", nodeType: "box" }, 0, 4);
  matchChild(container, { label: "X", nodeType: "box" }, 1, 4);
  matchChild(container, { label: "Y", nodeType: "box" }, 2, 4);
  matchChild(container, { label: "Z", nodeType: "box" }, 3, 4);
});

test("2x2 Junction Grid (Dashed Unicode)", () => {
  const diagram = `
┌┄┄┄┄┄┬┄┄┄┄┄┐
┆  A  ┆  B  ┆
├┄┄┄┄┄┼┄┄┄┄┄┤
┆  C  ┆  D  ┆
└┄┄┄┄┄┴┄┄┄┄┄┘
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  matchChild(container, { label: "A", nodeType: "box" }, 0, 4);
  matchChild(container, { label: "B", nodeType: "box" }, 1, 4);
  matchChild(container, { label: "C", nodeType: "box" }, 2, 4);
  matchChild(container, { label: "D", nodeType: "box" }, 3, 4);
});

test("Mixed Line Styles Grid", () => {
  const diagram = `
┌─────┬┄┄┄┄┄┐
│  A  ┆  B  ┆
├─────┼┄┄┄┄┄┤
│  C  ┆  D  ┆
└─────┴┄┄┄┄┄┘
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  matchChild(container, { label: "A", nodeType: "box" }, 0, 4);
  matchChild(container, { label: "B", nodeType: "box" }, 1, 4);
  matchChild(container, { label: "C", nodeType: "box" }, 2, 4);
  matchChild(container, { label: "D", nodeType: "box" }, 3, 4);
});

test("Not 2x2 but 2x1", () => {
  const diagram = `
┌──────┄┄┄┄┄┐
│  A  -  B  ┆
├─────-┄┄┄┄┄┤
│  C  -  D  ┆
└──────┄┄┄┄┄┘
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  matchChild(container, { label: "A  -  B", nodeType: "box" }, 0, 2);
  matchChild(container, { label: "C  -  D", nodeType: "box" }, 1, 2);
});

test("Adjacent ASCII Boxes Share Edge", () => {
  const diagram = `
+-----++-----+
| One || Two |
+-----++-----+
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { label: "One", nodeType: "box" }, 0, 2);
  matchChild(root, { label: "Two", nodeType: "box" }, 1, 2);
});

test("Double Seam Unicode Grid", () => {
  const diagram = `
┌─────┬┬─────┐
│ A   ││ C   │
└─────┴┴─────┘
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  matchChild(container, { label: "A", nodeType: "box" }, 0, 2);
  matchChild(container, { label: "C", nodeType: "box" }, 1, 2);
});

test("2x2 Junction Grid (Double Unicode With Label)", () => {
  const diagram = `
╔════WXYZ═══╗
║  W  ║  X  ║
╠═════╬═════╣
║  Y  ║  Z  ║
╚═════╩═════╝
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label: "WXYZ" }, 0, 1);
  matchChild(container, { label: "W", nodeType: "box" }, 0, 4);
  matchChild(container, { label: "X", nodeType: "box" }, 1, 4);
  matchChild(container, { label: "Y", nodeType: "box" }, 2, 4);
  matchChild(container, { label: "Z", nodeType: "box" }, 3, 4);
});

test("Is it a grid? Corners", () => {
  const diagram = `
┌────────┬───────┐
│   B    │       │
├────────┘       │
│       A        │
│       ┌────────┤
│       │   C    │
└───────┴────────┘
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box" }, 0, 1); //  label: "A"
  matchChild(container, { label: "B", nodeType: "box" }, b => b.label === "B"); // not sure about order as A can be parsed as note
  matchChild(container, { label: "C", nodeType: "box" }, b => b.label === "C");
});

// Helper for 4x4 grid tests
function check4x4Grid(diagram: string, label?: string) {
  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", label }, 0, 1);
  const labels = [
    "A", "B", "C", "D",
    "E", "F", "G", "H",
    "I", "J", "K", "L",
    "M", "N", "O", "P"
  ];
  labels.forEach((label, index) => {
    matchChild(container, { label, nodeType: "box" }, index, 16);
  });

}

test("4x4 Junction Grid", () => {
  const diagram = `
┌─────┬─────┬─────┬─────┐
│  A  │  B  │  C  │  D  │
├─────┼─────┼─────┼─────┤
│  E  │  F  │  G  │  H  │
├─────┼─────┼─────┼─────┤
│  I  │  J  │  K  │  L  │
├─────┼─────┼─────┼─────┤
│  M  │  N  │  O  │  P  │
└─────┴─────┴─────┴─────┘
`;
  check4x4Grid(diagram);
});

test("4x4 Junction Grid with Label", () => {
  const diagram = `
┌───ABCDEFGHIJKLMNOP────┐
│  A  │  B  │  C  │  D  │
├─────┼─────┼─────┼─────┤
│  E  │  F  │  G  │  H  │
├─────┼─────┼─────┼─────┤
│  I  │  J  │  K  │  L  │
├─────┼─────┼─────┼─────┤
│  M  │  N  │  O  │  P  │
└─────┴─────┴─────┴─────┘
`;
  check4x4Grid(diagram, "ABCDEFGHIJKLMNOP");
});

test("4x4 ASCII Grid", () => {
  const diagram = `
+-----+-----+-----+-----+
|  A  |  B  |  C  |  D  |
+-----+-----+-----+-----+
|  E  |  F  |  G  |  H  |
+-----+-----+-----+-----+
|  I  |  J  |  K  |  L  |
+-----+-----+-----+-----+
|  M  |  N  |  O  |  P  |
+-----+-----+-----+-----+
`;
  check4x4Grid(diagram);
});

test("4x4 MD Table Grid", () => {
  const diagram = `
-------------------------  
|  A  |  B  |  C  |  D  |
|-----|-----|-----|-----|
|  E  |  F  |  G  |  H  |
|-----|-----|-----|-----|
|  I  |  J  |  K  |  L  |
|-----|-----|-----|-----|
|  M  |  N  |  O  |  P  |
-------------------------
`;
  check4x4Grid(diagram);
});
test("1x2 Mixed Weight Grid (Bold Outer, Single Inner)", () => {
  const diagram = `
┏━━━━━━━┯━━━━━━━┓
┃   A   │   B   ┃
┗━━━━━━━┷━━━━━━━┛
`;

  const root = parseDiagram(diagram).root;
  // Outer container should be bold
  const container = matchChild(root, { nodeType: "box", style: { weight: 'bold' } }, 0, 1);
  // Inner cells should be single weight
  matchChild(container, { label: "A", nodeType: "box", style: { weight: 'single' } }, 0, 2);
  matchChild(container, { label: "B", nodeType: "box", style: { weight: 'single' } }, 1, 2);
});

test("2x2 Mixed Weight Grid (Bold Outer, Single Inner)", () => {
  const diagram = `
┏━━━━━━━┯━━━━━━━┓
┃   A   │   B   ┃
┠───────┼───────┨
┃   C   │   D   ┃
┗━━━━━━━┷━━━━━━━┛
`;

  const root = parseDiagram(diagram).root;
  const container = matchChild(root, { nodeType: "box", style: { weight: 'bold' } }, 0, 1);
  matchChild(container, { label: "A", nodeType: "box", style: { weight: 'single' } }, 0, 4);
  matchChild(container, { label: "B", nodeType: "box", style: { weight: 'single' } }, 1, 4);
  matchChild(container, { label: "C", nodeType: "box", style: { weight: 'single' } }, 2, 4);
  matchChild(container, { label: "D", nodeType: "box", style: { weight: 'single' } }, 3, 4);
});
