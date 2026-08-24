import { assertEquals } from "@std/assert";
import { testParseDiagram, testCompleted, flushPendingWrites } from "../../test/test-utils.ts";

Deno.test.afterEach(flushPendingWrites);

function assertBoxCount(t: Deno.TestContext, diagram: string, expectedBoxes: number): void {
  const result = testParseDiagram(t, diagram);
  assertEquals(result.root.children.filter((node) => node.nodeType === "box").length, expectedBoxes);
  testCompleted(t);
}

Deno.test("Non-Box: Broken Rounded Bottom Corner", (t) => {
  const diagram = `\
╭────╮
│ A  │
 ╰───╯
`;
  assertBoxCount(t, diagram, 0);
});

Deno.test("Non-Box: Broken Double Bottom Corner", (t) => {
  const diagram = `\
╔════╗
║ B  ║
 ╚═══╝
`;
  assertBoxCount(t, diagram, 0);
});

Deno.test("Non-Box: Only Horizontal Lines", (t) => {
  const diagram = `\
---------
---------
`;
  assertBoxCount(t, diagram, 0);
});

Deno.test("Non-Box: Only Vertical Lines", (t) => {
  const diagram = `\
||
||
`;
  assertBoxCount(t, diagram, 0);
});

Deno.test("Non-Box: Broken Corner", (t) => {
  const diagram = `\
+----+
| A  |
 ----+
`;
  assertBoxCount(t, diagram, 0);
});

Deno.test("Non-Box: Missing Bottom Edge", (t) => {
  const diagram = `\
+----+
| A  |
`;
  assertBoxCount(t, diagram, 0);
});

Deno.test("Non-Box: Broken Top Edge", (t) => {
  const diagram = `\
┌─    X     │───┐
└───────────────┘
┌─│   X      ───┐
└───────────────┘
┌─│   X     │───┐
└───────────────┘
`;
  assertBoxCount(t, diagram, 0);
});

Deno.test("Mixed Boxes, One Invalid", (t) => {
  const diagram = `\
┌─────┐  +----+
│ OK  │  | No |
└─────┘  +--- +
`;
  assertBoxCount(t, diagram, 1);
});
