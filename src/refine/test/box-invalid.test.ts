import { parseDiagram } from "../refine.ts";
import { test } from "node:test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";

function assertBoxCount(diagram: string, expectedBoxes: number): void {
  const result = parseDiagram(diagram);
  assertEquals(result.root.children.filter((node) => node.nodeType === "box").length, expectedBoxes);

}

test("Non-Box: Broken Rounded Bottom Corner", () => {
  const diagram = `\
╭────╮
│ A  │
 ╰───╯
`;
  assertBoxCount(diagram, 0);
});

test("Non-Box: Broken Double Bottom Corner", () => {
  const diagram = `\
╔════╗
║ B  ║
 ╚═══╝
`;
  assertBoxCount(diagram, 0);
});

test("Non-Box: Only Horizontal Lines", () => {
  const diagram = `\
---------
---------
`;
  assertBoxCount(diagram, 0);
});

test("Non-Box: Only Vertical Lines", () => {
  const diagram = `\
||
||
`;
  assertBoxCount(diagram, 0);
});

test("Non-Box: Broken Corner", () => {
  const diagram = `\
+----+
| A  |
 ----+
`;
  assertBoxCount(diagram, 0);
});

test("Non-Box: Missing Bottom Edge", () => {
  const diagram = `\
+----+
| A  |
`;
  assertBoxCount(diagram, 0);
});

test("Non-Box: Broken Top Edge", () => {
  const diagram = `\
┌─    X     │───┐
└───────────────┘
┌─│   X      ───┐
└───────────────┘
┌─│   X     │───┐
└───────────────┘
`;
  assertBoxCount(diagram, 0);
});

test("Mixed Boxes, One Invalid", () => {
  const diagram = `\
┌─────┐  +----+
│ OK  │  | No |
└─────┘  +--- +
`;
  assertBoxCount(diagram, 1);
});
