import { parseDiagram } from "../refine.ts";
import { test } from "node:test";

import { matchChild, matchEdge, matchNode } from "../../test/test-utils.ts";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { Dir } from "../../geo.ts";

test("Simple Right Arrow ->", () => {
  const diagram = `
    A -> B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'uni', source: "A", target: "B" });
});

test("Simple Left Arrow <-", () => {
  const diagram = `
    B <- A
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'uni', source: "A", target: "B" });
});

test("Double Arrow <->", () => {
  const diagram = `
    A <-> B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'bi', source: "A", target: "B" });
});

test("Windy Arrow", () => {
  const diagram = `
    A
    |
    +---> B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'uni', source: "A", target: "B" });
});

test("Windy Arrow 1", () => {
  const diagram = `
    +---> B
    |
 A -+
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'uni', source: "A", target: "B" });
});


test("Arrow with Horizontal Label Span", () => {
  const diagram = `
    --- status -->
    `;
  const root = parseDiagram(diagram).root;
  const edge = matchEdge(root, { direction: 'uni' });
  assertEquals(edge.polyline.length, 2, "Simplified polyline for straight arrow should have 2 points");
});

test("Unicode Right Arrow ─►", () => {
  const diagram = `
    A ─► B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'uni', source: "A", target: "B" });
});

test("Unicode Left Arrow ◄─", () => {
  const diagram = `
    B ◄─ A
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'uni', source: "A", target: "B" });
});

test("Unicode Bidirectional ◄─►", () => {
  const diagram = `
    A ◄─► B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'bi', source: "A", target: "B" });
});

test("Unicode Double Chevron »", () => {
  const diagram = `
    A «──» B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'bi', source: "A", target: "B" });
});

test("Unicode UnDirectional", () => {
  const diagram = `
    A ───── B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'none', source: "A", target: "B" });
});

test("Half-wires resolve only through connectable termini", () => {
  const diagram = `\
[A]──[B]
[A]╶╴[B]
[A]◀─╴╶─⯈[B]`;
  const root = parseDiagram(diagram).root;

  matchEdge(root, { source: "A", target: "B" }, 0, 4);

  const floating = matchEdge(root, {
    source: { dir: Dir.None },
    target: { dir: Dir.None },
    nodes: [],
  }, 1, 4);
  assertEquals(floating.source.node, undefined);
  assertEquals(floating.target.node, undefined);

  const left = matchEdge(root, { direction: "uni" }, 2, 4);
  assertEquals(left.source.dir, Dir.None);
  assertEquals(left.source.node, undefined);
  assertEquals(left.target.node?.label, "A");

  const right = matchEdge(root, { direction: "uni" }, 3, 4);
  assertEquals(right.source.dir, Dir.None);
  assertEquals(right.source.node, undefined);
  assertEquals(right.target.node?.label, "B");
});

test("Unicode UnDirectional Path with Junctions", () => {
  const diagram = `
┌──A 
│ 
└B
    `;

  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'none', source: "A", target: "B" });
});

test("Unicode Arrows with Junction Start ├─►", () => {
  const diagram = `
┌──────────┐      ┌───────┐
│          │      │       │
│    AA    ├─────▶│  BB   │
│          │      │       │
└────▲─────┘      └───┬───┘
     │                │
     └────────────────┘
    `;
  const root = parseDiagram(diagram).root;

  // Verify Boxes
  const aa = matchChild(root, { label: "AA", nodeType: 'box', x: 0, y: 1, w: 12, h: 5 }, 0, 2);
  const bb = matchChild(root, { label: "BB", nodeType: 'box', x: 18, y: 1, w: 9, h: 5 }, 1, 2);

  matchEdge(root, { direction: 'uni', source: aa, target: bb }, 0, 2);
  matchEdge(root, { direction: 'uni', source: bb, target: aa }, 1, 2);
});

test("Complex Circuit with Junctions", () => {
  const diagram = `
       +--------+
       |        |
    A -+        +-> B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'uni', source: "A", target: "B" });
});

test("Unicode Complex Path with Corners", () => {
  const diagram = `
    A
    │
    ╰──►B
    `;
  const root = parseDiagram(diagram).root;
  matchEdge(root, { direction: 'uni', source: "A", target: "B" });
});

test("Complex Box-to-Box Connection", () => {
  const diagram = `
       ┌───────────────┐
       │               │
       │               │
  ┌────┴─────┐         │
  │          │         │     ┌─────────────┐
  │    AA    │         │     │             │
  │          │         │     │     BB      │
  │          │         │     │             │
  └──────────┘         │     └─────▲───────┘
                       │           │
                       │           │
                       └───────────┘
`;

  // Parse
  const root = parseDiagram(diagram).root;

  // Verify Boxes
  const aa = matchChild(root, { label: "AA", x: 2, y: 4, w: 12, h: 6 }, 0, 2);
  const bb = matchChild(root, { label: "BB", x: 29, y: 5, w: 15, h: 5 }, 1, 2);

  matchEdge(root, { direction: 'uni', source: aa, target: bb });
});

test("Spiral", () => {
  const diagram = `
┌───────────────────────T 
│ ┌─────────────────────┐ 
│ │ ┌─────────────────┐ │ 
│ │ │ ┌─────────────┐ │ │ 
│ │ │ │ ┌─────────┐ │ │ │ 
│ │ │ │ │ ┌─────┐ │ │ │ │ 
│ │ │ │ │ │ X ┐ │ │ │ │ │ 
│ │ │ │ │ └───┘ │ │ │ │ │ 
│ │ │ │ └───────┘ │ │ │ │ 
│ │ │ └───────────┘ │ │ │ 
│ │ └───────────────┘ │ │ 
│ └───────────────────┘ │ 
└───────────────────────┘ 
  `;
  const root = parseDiagram(diagram).root;
  // The incomplete spiral is not a box; remnants are note nodes with undirected edges.
  const T = matchChild(root, { nodeType: "note", label: "T" }, 0, 2);
  const X = matchChild(root, { nodeType: "note", label: "X" }, 1, 2);
  matchEdge(root, { direction: 'none', source: T, target: X });
});


test("Internal Label vs Edge Target Promotion Clash", () => {
  const diagram = `
┌──────┐            
│  A   │            
└──┬───┘            
   │                
   └─────────┐      
       ┌─────┼─────┐
       │     │     │
       │     ▼     │
       │     B     │
       │           │
       │           │
       └───────────┘
    `;
  const root = parseDiagram(diagram).root;

  // Box A
  const a = matchChild(root, { label: "A", nodeType: 'box' }, 0, 2);
  // Anonymous Box
  const anonymous = matchChild(root, { nodeType: 'box' }, 1, 2);
  // Note B (The target)
  const b = matchChild(anonymous, { label: "B", nodeType: 'note', $links: 1 });

  // Edge should ideally point to note B, and B should not be promoted to label
  matchEdge(root, { source: a, target: b, direction: 'uni' });
});

test("Narrow Corners (A -> B via corners)", () => {
  const diagram = `
A  ┐ ┌ C 
   │ │    
   │ │    
B  ┘ └ D 
`;
  const root = parseDiagram(diagram).root;

  const a = matchChild(root, { label: "A", nodeType: 'note', $links: 1 }, 0, 4);
  const c = matchChild(root, { label: "C", nodeType: 'note' }, 1, 4);
  const b = matchChild(root, { label: "B", nodeType: 'note', $links: 1 }, 2, 4);
  const d = matchChild(root, { label: "D", nodeType: 'note' }, 3, 4);

  // Edge should point to note B, and A should not be promoted to label
  matchEdge(root, { source: a, target: b, direction: 'none' }, 0, 2);
  matchEdge(root, { source: c, target: d, direction: 'none' }, 1, 2);
});


test("Vertical wire crossing horizontal text does not split label", () => {
  const diagram = `\
  │
hello
  │
`;
  const root = parseDiagram(diagram).root;
  assertEquals(root.children.length, 0);
  matchEdge(root, { label: 'hello' });
});

test("Edges: LCA distribution", () => {
  const diagram = `
╭──────────────── Outer ────────────────╮
│                                       │
│    ┌─────────── Inner ───────────┐    │
│    │                             │    │
│    │    ┌─A─┐           ┌─B─┐    │    │
│    │    │   ├──────────▶│   │    │    │
│    │    └───┘           └───┘    │    │
│    │                             │    │
│    └─────────────────────────────┘    │
│                                       │
╰───────────────────────────────────────╯
    `;
  const root = parseDiagram(diagram).root;
  matchNode(root, { $children: 1, $edges: 0 });

  const outer = matchChild(root, { label: "Outer", $edges: 0, $children: 1 }, 0, 1);
  const inner = matchChild(outer, { label: "Inner", $children: 2, $edges: 1 }, 0, 1);
  const a = matchChild(inner, { label: "A" }, 0 /* first A */, 2);
  const b = matchChild(inner, { label: "B" }, 1 /* second B */, 2);

  matchEdge(inner, { direction: 'uni', source: a, target: b }, 0, 1);
});

test("Edges: gap label association", () => {
  const diagram = `
┌───────┐                         ┌────────┐
│  Src  ├────────── Foo ─────────▶│  Dest  │
└───────┘                         └────────┘
    `;
  const root = parseDiagram(diagram).root;
  const src = matchChild(root, { label: "Src", $children: 0 }, 0, 2);
  const dest = matchChild(root, { label: "Dest", $children: 0 }, 1, 2);

  matchEdge(root, { label: "Foo", source: src, target: dest }, 0, 1);
});

test("Edges: port blocking", () => {
  const diagram = `
┌───┐             ┌────────┐             ┌───┐
│ A │------------>│ Middle │<------------│ B │
└───┘             └────────┘             └───┘
    `;
  const root = parseDiagram(diagram).root;
  const a = matchChild(root, { label: "A" }, 0, 3);
  const middle = matchChild(root, { label: "Middle" }, 1, 3);
  const b = matchChild(root, { label: "B" }, 2, 3);

  matchEdge(root, { direction: 'uni', source: a, target: middle }, 0, 2);
  matchEdge(root, { direction: 'uni', source: b, target: middle }, 1, 2);
});

test("Edges: directionality", () => {
  const cases = [
    {
      diag: `
┌───┐             ┌───┐
│ A │-----------> │ B │
└───┘             └───┘`,
      dir: "uni" as const,
      reverse: false,
      label: "ASCII Uni"
    },
    {
      diag: `
┌───┐             ┌───┐
│ A │<----------- │ B │
└───┘             └───┘`,
      dir: "uni" as const,
      reverse: true,
      label: "ASCII Reverse"
    },
    {
      diag: `
┌───┐             ┌───┐
│ A │ <---------> │ B │
└───┘             └───┘`,
      dir: "bi" as const,
      reverse: false,
      label: "ASCII Bi"
    }
  ];

  for (const c of cases) {
    const root = parseDiagram(c.diag).root;
    const a = matchChild(root, { label: "A" }, 0, 2);
    const b = matchChild(root, { label: "B" }, 1, 2);

    matchEdge(root, { direction: c.dir, source: c.reverse ? b : a, target: c.reverse ? a : b }, 0, 1);
  }
});

test("Edges: embedded vertical arrowhead", () => {
  const diagram = `
┌──────┐
│  A   │
└──┬───┘
   │
   └──────┐
       ┌──▼────┐
       │   B   │
       └───────┘
    `;
  const root = parseDiagram(diagram).root;
  const a = matchChild(root, { label: "A" }, 0, 2);
  const b = matchChild(root, { label: "B" }, 1, 2);

  matchEdge(root, { direction: 'uni', source: a, target: b }, 0, 1);
});

test("Edges: embedded horizontal arrowhead", () => {
  const diagram = `
┌───┐      ┌───┐
│ A ├──────▶ B │
└───┘      └───┘
    `;
  const root = parseDiagram(diagram).root;
  const a = matchChild(root, { label: "A" }, 0, 2);
  const b = matchChild(root, { label: "B" }, 1, 2);

  matchEdge(root, { direction: 'uni', source: a, target: b }, 0, 1);
});

test("Edges: embedded arrowhead on complex path", () => {
  const diagram = `
          ┌────────────────┐
          │                │
          │                │
┌──────┐  │   ┌───────┐    │
│  A   ◇──┘   │   B   ◀────┘
└──────┘      └───────┘
    `;
  const root = parseDiagram(diagram).root;
  const a = matchChild(root, { label: "A" }, 0, 2);
  const b = matchChild(root, { label: "B" }, 1, 2);
  const port = matchChild(a, { nodeType: "hub" }, 0, 1);

  matchEdge(root, { direction: 'uni', source: port, target: b }, 0, 1);
});
