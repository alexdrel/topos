import { testParseDiagram, testCompleted, flushPendingWrites } from '../../test/test-utils.ts';


import { matchChild, matchEdge } from '../../test/test-utils.ts';

Deno.test.afterEach(flushPendingWrites);

Deno.test("Inline Annotations", (t) => {
  const diagram = `
EARTH                                                        MARS
`;

  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "EARTH", nodeType: "note", x: 0, y: 1 }, 0, 2);
  matchChild(root, { label: "MARS", nodeType: "note", x: 61, y: 1 }, 1, 2);
  testCompleted(t);
});

Deno.test("Inline Nodes Basic", (t) => {
  const diagram = `
<User> -> [API Gateway] -> (Database)
`;

  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "User", nodeType: "inline", bracket: "<>", $children: 0 }, 0, 3);
  matchChild(root, { label: "API Gateway", nodeType: "inline", bracket: "[]", $children: 0 }, 1, 3);
  matchChild(root, { label: "Database", nodeType: "inline", bracket: "()", $children: 0 }, 2, 3);

  matchEdge(root, { source: "User", target: "API Gateway" }, 0, 2);
  matchEdge(root, { source: "API Gateway", target: "Database" }, 1, 2);
  testCompleted(t);
});

Deno.test("Adjacent Bracketed Tokens", (t) => {
  const diagram = `
[A] [B][C]
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "A", nodeType: "inline", bracket: "[]" }, 0, 3);
  matchChild(root, { label: "B", nodeType: "inline", bracket: "[]" }, 1, 3);
  matchChild(root, { label: "C", nodeType: "inline", bracket: "[]" }, 2, 3);
  testCompleted(t);
});

Deno.test("Inline Nodes With Internal Spaces and Multiple Space Separation", (t) => {
  const diagram = `
[API Gateway]   (Primary DB)
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "API Gateway", nodeType: "inline", bracket: "[]", $children: 0 }, 0, 2);
  matchChild(root, { label: "Primary DB", nodeType: "inline", bracket: "()", $children: 0 }, 1, 2);
  testCompleted(t);
});

Deno.test("Inline Nodes With Hyphenated Labels", (t) => {
  const diagram = `
[API-GW] -> [auth_service]
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "API-GW", nodeType: "inline", bracket: "[]", $children: 0 }, 0, 2);
  matchChild(root, { label: "auth_service", nodeType: "inline", bracket: "[]", $children: 0 }, 1, 2);

  matchEdge(root, { source: "API-GW", target: "auth_service" }, 0, 1);
  testCompleted(t);
});

Deno.test("Inline Nodes With Slashes And Dots", (t) => {
  const diagram = `
[api/v2] -> [svc.core]
`;
  const root = testParseDiagram(t, diagram).root;
  const src = matchChild(root, { label: "api/v2", nodeType: "inline", bracket: "[]", $children: 0 }, 0, 2);
  const dst = matchChild(root, { label: "svc.core", nodeType: "inline", bracket: "[]", $children: 0 }, 1, 2);

  matchEdge(root, { source: src, target: dst }, 0, 1);
  testCompleted(t);
});

Deno.test("Inline Nodes With Connectors", (t) => {
  const diagram = `
[A]->[B] -> (C) -> <D>
`;
  const root = testParseDiagram(t, diagram).root;
  const a = matchChild(root, { label: "A", nodeType: "inline", bracket: "[]", $children: 0 }, 0, 4);
  const b = matchChild(root, { label: "B", nodeType: "inline", bracket: "[]", $children: 0 }, 1, 4);
  const c = matchChild(root, { label: "C", nodeType: "inline", bracket: "()", $children: 0 }, 2, 4);
  const d = matchChild(root, { label: "D", nodeType: "inline", bracket: "<>", $children: 0 }, 3, 4);

  matchEdge(root, { source: a, target: b }, 0, 3);
  matchEdge(root, { source: b, target: c }, 1, 3);
  matchEdge(root, { source: c, target: d }, 2, 3);
  testCompleted(t);
});

Deno.test("Inline Nodes Mixed Nested Delimiters Use Grammar Styles", (t) => {
  const diagram = `
[ A (B) <C> ]
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "A (B) <C>", nodeType: "inline", bracket: "[]", $children: 0 }, 0, 1);
  testCompleted(t);
});

Deno.test("Nested Brackets of the Same Type", (t) => {
  const diagram = `
[DB [PG1] [PG2]]
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "DB [PG1] [PG2]", nodeType: "inline", bracket: "[]", $children: 0 }, 0, 1);
  testCompleted(t);
});

Deno.test("Nested Brackets of the Same Type (Single Line)", (t) => {
  const diagram = `
[ DB [ PG1 ] [ PG2 ] ]
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "DB [ PG1 ] [ PG2 ]", nodeType: "inline", bracket: "[]", $children: 0 }, 0, 1);
  testCompleted(t);
});

Deno.test("Single-Spaced Adjacent Brackets", (t) => {
  const diagram = `
[A] [B]
[C] [D]
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "A", nodeType: "inline", bracket: "[]" }, 0, 4);
  matchChild(root, { label: "B", nodeType: "inline", bracket: "[]" }, 1, 4);
  matchChild(root, { label: "C", nodeType: "inline", bracket: "[]" }, 2, 4);
  matchChild(root, { label: "D", nodeType: "inline", bracket: "[]" }, 3, 4);
  testCompleted(t);
});

Deno.test("Spaced Brackets converted to inline nodes", (t) => {
  const diagram = `
[A]    [B]
[C]    [D]
`;
  const root = testParseDiagram(t, diagram).root;
  const _a = matchChild(root, { label: "A", nodeType: "inline" }, 0, 4);
  const _b = matchChild(root, { label: "B", nodeType: "inline" }, 1, 4);
  const _c = matchChild(root, { label: "C", nodeType: "inline" }, 2, 4);
  const _d = matchChild(root, { label: "D", nodeType: "inline" }, 3, 4);

  testCompleted(t);
});

Deno.test("Inline Nodes Multi-Line", (t) => {
  const diagram = `
<User> -> [API Gateway] -> (Database)


╭────────────────────────────╮
│  <User> -> [API Gateway]   │
╰────────────────────────────╯
`;

  const root = testParseDiagram(t, diagram).root;
  const inlineUser = matchChild(root, { label: "User", nodeType: "inline", bracket: "<>", $children: 0 }, 0, 4);
  const api = matchChild(root, { label: "API Gateway", nodeType: "inline", bracket: "[]", $children: 0 }, 1, 4);
  const db = matchChild(root, { label: "Database", nodeType: "inline", bracket: "()", $children: 0 }, 2, 4);
  const box = matchChild(root, { nodeType: "box", y: 4 }, 3, 4);
  matchEdge(root, { source: inlineUser, target: api }, 0, 2);
  matchEdge(root, { source: api, target: db }, 1, 2);

  matchChild(box, { label: "User", nodeType: "inline", bracket: "<>", $children: 0 }, 0, 2);
  matchChild(box, { label: "API Gateway", nodeType: "inline", bracket: "[]", $children: 0 }, 1, 2);
  matchEdge(box, { source: "User", target: "API Gateway" });

  testCompleted(t);
});

Deno.test("Inline Nodes Multi-Line With Noise", (t) => {
  const diagram = `
[API] -> (DB)
Some text here
<User> -> [API2]
`;
  const root = testParseDiagram(t, diagram).root;
  const api = matchChild(root, { label: "API", nodeType: "inline", bracket: "[]", $children: 0 }, 0, 5);
  const db = matchChild(root, { label: "DB", nodeType: "inline", bracket: "()", $children: 0 }, 1, 5);
  /*noise*/    matchChild(root, { label: "Some text here", nodeType: "note", y: 2, $children: 0 }, 2, 5);
  const user = matchChild(root, { label: "User", nodeType: "inline", y: 3, bracket: "<>", $children: 0 }, 3, 5);
  const api2 = matchChild(root, { label: "API2", nodeType: "inline", y: 3, bracket: "[]", $children: 0 }, 4, 5);

  matchEdge(root, { source: api, target: db }, 0, 2);
  matchEdge(root, { source: user, target: api2 }, 1, 2);
  testCompleted(t);
});

Deno.test("Bracketed Tokens In Prose Remain Plain Text", (t) => {
  const diagram = `
This is a paragraph with [not a node] embedded in text.
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "This is a paragraph with [not a node] embedded in text.", nodeType: "note", x: 0, $children: 0 }, 0, 1);
  testCompleted(t);
});

Deno.test("Inline Nodes within boxes (Rovers test case)", (t) => {
  const diagram = `\
 ┌─ROVERS────────────────┐
 │   [ Opportunity  ]    │
 │   [ Perseverance ]    │
 │   [  Curiosity   ]    │
 │   [   Spirit     ]    │
 └───────────────────────┘
`;
  const root = testParseDiagram(t, diagram).root;
  const rovers = matchChild(root, { label: "ROVERS", nodeType: "box", $children: 4 }, 0, 1);
  matchChild(rovers, { label: "Opportunity", nodeType: "inline", bracket: "[]" }, 0, 4);
  matchChild(rovers, { label: "Perseverance", nodeType: "inline", bracket: "[]" }, 1, 4);
  matchChild(rovers, { label: "Curiosity", nodeType: "inline", bracket: "[]" }, 2, 4);
  matchChild(rovers, { label: "Spirit", nodeType: "inline", bracket: "[]" }, 3, 4);
  testCompleted(t);
});

Deno.test("Inline nodes may contain structural glyphs", (t) => {
  const diagram = `\
[Unmatched │ Wire ]

Normal text [Note
`;
  const root = testParseDiagram(t, diagram).root;
  matchChild(root, { label: "Unmatched │ Wire", nodeType: "inline", bracket: "[]" }, 0, 2);
  matchChild(root, { label: "Normal text [Note", nodeType: "note" }, 1, 2);
  testCompleted(t);
});

