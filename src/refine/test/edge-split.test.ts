import { assert } from "@std/assert";
import { testParseDiagram, testCompleted, flushPendingWrites } from '../../test/test-utils.ts';

import { matchChild, matchEdge } from "../../test/test-utils.ts";

Deno.test.afterEach(flushPendingWrites);

Deno.test("Edge split inherits source from implicit stem", (t) => {
  const diagram = `
A ───┬──▶ B
     │
     ▼
     C
`;

  const root = testParseDiagram(t, diagram).root;
  const a = matchChild(root, { label: "A", nodeType: "note" }, 0, 3);
  const b = matchChild(root, { label: "B", nodeType: "note" }, 1, 3);
  const c = matchChild(root, { label: "C", nodeType: "note" }, 2, 3);

  const stem = matchEdge(root, { direction: "uni", source: a, target: b }, 0, 2);
  const branch = matchEdge(root, { direction: "uni", source: a, target: c }, 1, 2);

  assert(branch.source.stem === stem, "Expected implicit split branch source to reference its stem edge");
  testCompleted(t);
});

const LABELED_TREE_ROTATIONS = [
  {
    name: "down",
    diagram: `\
 [A]
 ├──[C]
 ├──[D]
 └──[B]`,
    stemTerminus: "source",
  },
  {
    name: "left",
    diagram: `\
 ┌────┬────┬──[A]
 │    │    │
 │    │    │
[B]  [D]  [C]`,
    stemTerminus: "source",
  },
  {
    name: "up",
    diagram: `\
[B]──┐
[D]──┤
[C]──┤
    [A]`,
    stemTerminus: "target",
  },
  {
    name: "right",
    diagram: `\
    [C]  [D]  [B]
     │    │    │
     │    │    │
[A]──┴────┴────┘`,
    stemTerminus: "target",
  },
] as const;

for (const { name, diagram, stemTerminus } of LABELED_TREE_ROTATIONS) {
  Deno.test(`Edge split resolves labeled-tree stems ${name}`, (t) => {
    const root = testParseDiagram(t, diagram).root;
    const a = matchChild(root, { label: "A" }, (child) => child.label === "A", 4);
    const b = matchChild(root, { label: "B" }, (child) => child.label === "B", 4);
    const c = matchChild(root, { label: "C" }, (child) => child.label === "C", 4);
    const d = matchChild(root, { label: "D" }, (child) => child.label === "D", 4);

    const edges = root.edges;
    assert(edges.length === 3);
    const stem = edges.find((edge) => edge.nodes.includes(a) && edge.nodes.includes(b));
    const branchC = edges.find((edge) => edge.nodes.includes(c));
    const branchD = edges.find((edge) => edge.nodes.includes(d));
    assert(stem);
    assert(branchC);
    assert(branchD);
    assert(branchC[stemTerminus].node === a);
    assert(branchD[stemTerminus].node === a);
    assert(branchC[stemTerminus].stem === stem);
    assert(branchD[stemTerminus].stem === stem);
    testCompleted(t);
  });
}

Deno.test("Edge split resolves ASCII stem", (t) => {
  const diagram = `
A ---+---> B
     |
     v
     C
`;

  const root = testParseDiagram(t, diagram).root;
  const a = matchChild(root, { label: "A", nodeType: "note" }, 0, 3);
  const b = matchChild(root, { label: "B", nodeType: "note" }, 1, 3);
  const c = matchChild(root, { label: "C", nodeType: "note" }, 2, 3);

  const stem = matchEdge(root, { direction: "uni", source: a, target: b }, 0, 2);
  const branch = matchEdge(root, { direction: "uni", source: a, target: c }, 1, 2);

  assert(branch.source.stem === stem, "Expected implicit split branch source to reference its stem edge");
  testCompleted(t);
});

Deno.test("Edge split resolves double branching", (t) => {
  const diagram = `
A ───┬──▶ B
     │
     └──┬──▶ C
        │
        ▼
        D
`;

  const root = testParseDiagram(t, diagram).root;
  const a = matchChild(root, { label: "A", nodeType: "note" }, 0, 4);
  const b = matchChild(root, { label: "B", nodeType: "note" }, 1, 4);
  const c = matchChild(root, { label: "C", nodeType: "note" }, 2, 4);
  const d = matchChild(root, { label: "D", nodeType: "note" }, 3, 4);

  const stemToB = matchEdge(root, { direction: "uni", source: a, target: b }, 0, 3);
  const branchToC = matchEdge(root, { direction: "uni", source: a, target: c }, (edge) => edge.target.node === c, 3);
  const branchToD = matchEdge(root, { direction: "uni", source: a, target: d }, (edge) => edge.target.node === d, 3);
  assert(branchToC.source.stem === stemToB);
  assert(branchToD.source.stem === branchToC);

  testCompleted(t);
});

Deno.test("Edge split links explicit hub branches to their stem", (t) => {
  const diagram = `
A ───●──▶ B
     │
     ▼
     C
`;

  const root = testParseDiagram(t, diagram).root;
  const a = matchChild(root, { label: "A", nodeType: "note" }, 0, 4);
  const hub = matchChild(root, { nodeType: "hub" }, 1, 4);
  const b = matchChild(root, { label: "B", nodeType: "note" }, 2, 4);
  const c = matchChild(root, { label: "C", nodeType: "note" }, 3, 4);

  const _stem = matchEdge(root, { direction: "none", source: a, target: hub }, 0, 3);
  const _branchToB = matchEdge(root, { direction: "uni", source: hub, target: b }, 1, 3);
  const _branchToC = matchEdge(root, { direction: "uni", source: hub, target: c }, 2, 3);

  testCompleted(t);
});

Deno.test("Edge split inside container retains stem", (t) => {
  const diagram = `\
╭───────────────── Ink ─────────────────╮
│            ┌───────●───────┬──────┐   │
│            │               │      │   │
│            ▼               ▼      ▼   │
│         ╭─────╮         ╭─────╮╭─────╮│
│         │  A  │         │  B  ││  C  ││
│         ╰─────╯         ╰─────╯╰─────╯│
╰───────────────────────────────────────╯
`;

  const root = testParseDiagram(t, diagram).root;
  const ink = matchChild(root, { label: "Ink", nodeType: "box" }, 0, 1);
  const _a = matchChild(ink, { label: "A", nodeType: "box" }, 1, 4);
  const b = matchChild(ink, { label: "B", nodeType: "box" }, 2, 4);
  const c = matchChild(ink, { label: "C", nodeType: "box" }, 3, 4);

  const stem = matchEdge(ink, { direction: "uni", target: c }, (edge) => edge.target.node === c, 3);
  const branch = matchEdge(ink, { direction: "uni", target: b }, (edge) => edge.target.node === b, 3);

  assert(branch.source.stem === stem, "Expected branch source inside container to reference its stem edge");
  testCompleted(t);
});
