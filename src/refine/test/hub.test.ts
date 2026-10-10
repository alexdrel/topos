import { parseDiagram } from "../refine.ts";
import { test } from "node:test";

import { matchChild, matchEdge } from '../../test/test-utils.ts';
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { projectTracesToGrid } from "../../ink/ink.ts";

test("Standalone Hub", () => {
  const diagram = `\
    ●
    `;
  const root = parseDiagram(diagram).root;
  matchChild(root, { nodeType: 'hub', glyph: '●', label: undefined }, 0, 1);
});

test("Hub Resolution and Ghost Edge Pruning", () => {
  const diagram = `\
●─────────▶●◀────────────●
           │
           │
           │
           ▼
           ●
`;
  const result = parseDiagram(diagram);
  const root = result.root;

  const leftHub = matchChild(root, { nodeType: "hub", glyph: "●" }, 0, 4);
  const centerHub = matchChild(root, { nodeType: "hub", glyph: "●" }, 1, 4);
  const rightHub = matchChild(root, { nodeType: "hub", glyph: "●" }, 2, 4);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "●" }, 3, 4);

  // Match the three connecting edges
  matchEdge(root, { source: leftHub, target: centerHub, direction: "uni" }, 0, 3);
  matchEdge(root, { source: rightHub, target: centerHub, direction: "uni" }, 1, 3);
  matchEdge(root, { source: centerHub, target: bottomHub, direction: "uni" }, 2, 3);
});

test("Standalone Hub with label is promoted to a hub node", () => {
  const diagram = `\
● client
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { nodeType: 'hub', glyph: '●', label: 'client' }, 0, 1);
});

test("Standalone Hub with label is promoted to a hub node", () => {
  const diagram = `\
● client
`;
  const root = parseDiagram(diagram).root;
  matchChild(root, { nodeType: 'hub', glyph: '●', label: 'client' }, 0, 1);
});
test("Connected Hubs with Labels", () => {
  const diagram = `\
  ◎ Top   
  │       
  │       
  │       
  ▼       
  ◇ Bottom
`;
  const result = parseDiagram(diagram);
  const root = result.root;

  const topHub = matchChild(root, { nodeType: 'hub', glyph: '◎', label: 'Top' }, 0, 2);
  const bottomHub = matchChild(root, { nodeType: 'hub', glyph: '◇', label: 'Bottom' }, 1, 2);

  matchEdge(root, { source: topHub, target: bottomHub, direction: 'uni' }, 0, 1);
});

test("Hubs example: parses correctly with 5 hubs and 4 edges", () => {
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

  const result = parseDiagram(diagram);
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
});

test("Hubs connected with space (read with hub glyphs as part of text traces)", () => {
  const diagram = `\
  ┌─▶ ◎ Top
  │        
  │        
  │        
  ▼        
  ◇ Bottom
`;
  const result = parseDiagram(diagram);
  const root = result.root;
  const topHub = matchChild(root, { nodeType: "hub", glyph: "◎", label: "Top" }, 0, 2);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "◇", label: "Bottom" }, 1, 2);
  matchEdge(root, { source: topHub, target: bottomHub, direction: "bi" }, 0, 1);
});

test("Hubs connected directly via line (read with hub glyphs as part of line trace)", () => {
  const diagram = `\
  ◎ Top   
  │       
  │       
  │       
  │       
  ◇ Bottom
`;
  const result = parseDiagram(diagram);
  const root = result.root;
  const topHub = matchChild(root, { nodeType: "hub", glyph: "◎", label: "Top" }, 0, 2);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "◇", label: "Bottom" }, 1, 2);
  matchEdge(root, { source: topHub, target: bottomHub, direction: "none" }, 0, 1);
});

test("Hub on box boundary (port with label)", () => {
  const diagram = `\
             ┌────┐
        ◀────□ A  │
             └────┘
`;
  const result = parseDiagram(diagram);
  const root = result.root;
  const boxNode = matchChild(root, { nodeType: "box", label: undefined }, 0, 1);
  const port = matchChild(boxNode, { nodeType: "hub", glyph: "□", label: "A" }, 0, 1);
  const edge = matchEdge(root, { source: port, direction: "uni" }, 0, 1);
  assertEquals(edge.source.glyph, "");
  assertEquals(projectTracesToGrid(result).text.trimEnd(), diagram.trimEnd());
});

test("Box border hubs are named child nodes without edges", () => {
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
  const result = parseDiagram(diagram);
  const root = result.root;
  const boxNode = matchChild(root, { nodeType: "box", label: "inet_srv" }, 0, 1);

  matchChild(boxNode, { nodeType: "hub", glyph: "□", label: "http" }, 0, 3);
  matchChild(boxNode, { nodeType: "hub", glyph: "□", label: "https" }, 1, 3);
  matchChild(boxNode, { nodeType: "hub", glyph: "□", label: "ftp" }, 2, 3);
  assertEquals(result.edges.length, 0);
  assertEquals(projectTracesToGrid(result).text.trimEnd(), diagram.trimEnd());
});

test("Hubs connected with space (label to the left of glyph)", () => {
  const diagram = `\
  A ◎ ◀─▶ B ◇
`;
  const result = parseDiagram(diagram);
  const root = result.root;
  const topHub = matchChild(root, { nodeType: "hub", glyph: "◎", label: "A" }, 0, 2);
  const bottomHub = matchChild(root, { nodeType: "hub", glyph: "◇", label: "B" }, 1, 2);
  matchEdge(root, { source: topHub, target: bottomHub, direction: "bi" }, 0, 1);
});

test("Hub with 3-direction intersection of lines", () => {
  const diagram = `\
      │    
      │    
      │    
  ┌───◆───┐
  │       │
  ▼       ▼
`;
  const result = parseDiagram(diagram);
  const root = result.root;
  const hubNode = matchChild(root, { nodeType: "hub", glyph: "◆" }, 0, 1);
  matchEdge(root, { target: hubNode, direction: "none" }, 0, 3);
  matchEdge(root, { source: hubNode, direction: "uni" }, 1, 3);
  matchEdge(root, { source: hubNode, direction: "uni" }, 2, 3);
});
