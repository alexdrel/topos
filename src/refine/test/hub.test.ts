import { testParseDiagram, testCompleted, flushPendingWrites } from '../../test/test-utils.ts';
import { matchChild, matchEdge } from '../../test/test-utils.ts';
import { assertEquals } from "@std/assert";
import { projectTracesToGrid } from "../../ink/ink.ts";


Deno.test.afterEach(flushPendingWrites);

Deno.test("Standalone Hub", (t) => {
  const diagram = `\
    ●
    `;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { nodeType: 'hub', glyph: '●', label: undefined }, 0, 1);
  testCompleted(t);
});

Deno.test("Hub Resolution and Ghost Edge Pruning", (t) => {
  const diagram = `\
●─────────▶●◀────────────●
           │
           │
           │
           ▼
           ●
`;
  const result = testParseDiagram(t, diagram);
  const root = result.root;

  const leftHub = matchChild(root, { nodeType: "hub", glyph: "●" }, 0, 4);
  const centerHub = matchChild(root, { nodeType: "hub", glyph: "●" }, 1, 4);
  const rightHub = matchChild(root, { nodeType: "hub", glyph: "●" }, 2, 4);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "●" }, 3, 4);

  // Match the three connecting edges
  matchEdge(root, { source: leftHub, target: centerHub, direction: "uni" }, 0, 3);
  matchEdge(root, { source: rightHub, target: centerHub, direction: "uni" }, 1, 3);
  matchEdge(root, { source: centerHub, target: bottomHub, direction: "uni" }, 2, 3);

  testCompleted(t);
});

Deno.test("Standalone Hub with label is promoted to a hub node", (t) => {
  const diagram = `\
● client
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { nodeType: 'hub', glyph: '●', label: 'client' }, 0, 1);
  testCompleted(t);
});

Deno.test("Standalone Hub with label is promoted to a hub node", (t) => {
  const diagram = `\
● client
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { nodeType: 'hub', glyph: '●', label: 'client' }, 0, 1);
  testCompleted(t);
});
Deno.test("Connected Hubs with Labels", (t) => {
  const diagram = `\
  ◎ Top   
  │       
  │       
  │       
  ▼       
  ◇ Bottom
`;
  const result = testParseDiagram(t, diagram);
  const root = result.root;

  const topHub = matchChild(root, { nodeType: 'hub', glyph: '◎', label: 'Top' }, 0, 2);
  const bottomHub = matchChild(root, { nodeType: 'hub', glyph: '◇', label: 'Bottom' }, 1, 2);

  matchEdge(root, { source: topHub, target: bottomHub, direction: 'uni' }, 0, 1);

  testCompleted(t);
});

Deno.test("Hubs example: parses correctly with 5 hubs and 4 edges", (t) => {
  const diagram = `\
            ■ Top
            │
            ▼
 □─────────>◎<────────────□
            │
            │
            │
            ▼
            ◇ Bottom
`;

  const result = testParseDiagram(t, diagram);
  const root = result.root;

  // Verify hubs using matchChild
  const topHub = matchChild(root, { nodeType: "hub", glyph: "■", label: "Top" }, 0, 5);
  const leftHub = matchChild(root, { nodeType: "hub", glyph: "□" }, 1, 5);
  const centerHub = matchChild(root, { nodeType: "hub", glyph: "◎" }, 2, 5);
  const rightHub = matchChild(root, { nodeType: "hub", glyph: "□" }, 3, 5);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "◇", label: "Bottom" }, 4, 5);

  // Verify edges

  // ■ Top -> ◎
  matchEdge(root, { source: topHub, target: centerHub, direction: "uni" }, 0, 4);
  // left □ -> ◎
  matchEdge(root, { source: leftHub, target: centerHub, direction: "uni" }, 1, 4);
  // right □ -> ◎
  matchEdge(root, { source: rightHub, target: centerHub, direction: "uni" }, 2, 4);
  // ◎ -> ◇ Bottom
  matchEdge(root, { source: centerHub, target: bottomHub, direction: "uni" }, 3, 4);

  // Verify that it roundtrips via traces
  assertEquals(projectTracesToGrid(result).text.trimEnd(), diagram.trimEnd());

  testCompleted(t);
});

Deno.test("Hubs connected with space (read with hub glyphs as part of text traces)", (t) => {
  const diagram = `\
  ┌─▶ ◎ Top
  │        
  │        
  │        
  ▼        
  ◇ Bottom
`;
  const result = testParseDiagram(t, diagram);
  const root = result.root;
  const topHub = matchChild(root, { nodeType: "hub", glyph: "◎", label: "Top" }, 0, 2);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "◇", label: "Bottom" }, 1, 2);
  matchEdge(root, { source: topHub, target: bottomHub, direction: "bi" }, 0, 1);
  testCompleted(t);
});

Deno.test("Hubs connected directly via line (read with hub glyphs as part of line trace)", (t) => {
  const diagram = `\
  ◎ Top   
  │       
  │       
  │       
  │       
  ◇ Bottom
`;
  const result = testParseDiagram(t, diagram);
  const root = result.root;
  const topHub = matchChild(root, { nodeType: "hub", glyph: "◎", label: "Top" }, 0, 2);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "◇", label: "Bottom" }, 1, 2);
  matchEdge(root, { source: topHub, target: bottomHub, direction: "none" }, 0, 1);
  testCompleted(t);
});

Deno.test("Hub on box boundary (port with label)", (t) => {
  const diagram = `\
             ┌────┐
        ◀────□ A  │
             └────┘
`;
  const result = testParseDiagram(t, diagram);
  const root = result.root;
  const boxNode = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  const port = matchChild(boxNode, { nodeType: "hub", glyph: "□", label: "A" }, 0, 1);
  const edge = matchEdge(root, { source: port, direction: "uni" }, 0, 1);
  assertEquals(edge.source.glyph, "");
  assertEquals(projectTracesToGrid(result).text.trimEnd(), diagram.trimEnd());
  testCompleted(t);
});

Deno.test("Box border hubs are named child nodes without edges", (t) => {
  const diagram = `\
        ┌─inet_srv──┐
        │           │
        □  http     │
        │           │
        □  https    │
        │           │
        □  ftp      │
        │           │
        └───────────┘`;
  const result = testParseDiagram(t, diagram);
  const root = result.root;
  const boxNode = matchChild(root, { nodeType: "box", label: "inet_srv" }, 0, 1);

  matchChild(boxNode, { nodeType: "hub", glyph: "□", label: "http" }, 0, 3);
  matchChild(boxNode, { nodeType: "hub", glyph: "□", label: "https" }, 1, 3);
  matchChild(boxNode, { nodeType: "hub", glyph: "□", label: "ftp" }, 2, 3);
  assertEquals(result.edges.length, 0);
  assertEquals(projectTracesToGrid(result).text.trimEnd(), diagram.trimEnd());
  testCompleted(t);
});

Deno.test("Hubs connected with space (label to the left of glyph)", (t) => {
  const diagram = `\
  A ◎ ◀─▶ B ◇
`;
  const result = testParseDiagram(t, diagram);
  const root = result.root;
  const topHub = matchChild(root, { nodeType: "hub", glyph: "◎", label: "A" }, 0, 2);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "◇", label: "B" }, 1, 2);
  matchEdge(root, { source: topHub, target: bottomHub, direction: "bi" }, 0, 1);
  testCompleted(t);
});

Deno.test("Hub with 3-direction intersection of lines", (t) => {
  const diagram = `\
      │    
      │    
      │    
  ┌───◆───┐
  │       │
  ▼       ▼
`;
  const result = testParseDiagram(t, diagram);
  const root = result.root;
  const hubNode = matchChild(root, { nodeType: "hub", glyph: "◆" }, 0, 1);
  matchEdge(root, { target: hubNode, direction: "none" }, 0, 3);
  matchEdge(root, { source: hubNode, direction: "uni" }, 1, 3);
  matchEdge(root, { source: hubNode, direction: "uni" }, 2, 3);
  testCompleted(t);
});
