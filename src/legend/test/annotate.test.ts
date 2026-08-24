import { assertEquals, assertExists, assertObjectMatch } from "@std/assert";
import { Dir } from "../../geo.ts";
import { parseTopos } from "../../topos.ts";
import { matchChild, matchEdge } from "../../test/test-utils.ts";

Deno.test("legend annotate: inline sigils participate in normal rule matching", () => {
  const input = `\
+========================+
| System .core#sys@svc   |
+========================+

:legend
#sys : red glow
.core : "Main System"
`;

  const diagram = parseTopos(input);
  const box = matchChild(diagram.root, { text: "Main System" });
  assertEquals(box.id, "sys");
  assertEquals(box.semanticType, "svc");
  assertEquals(box.classes, ["core"]);
  assertObjectMatch(box.eidos!, { color: "red", effect: "glow", weight: "double" });
});

Deno.test("legend annotate: quoted selector matches a multi-word edge label", () => {
  const diagram = parseTopos(`\
A ── Link label ──▶ B

:legend
"Link label" : red
`);

  const edge = matchEdge(diagram.root, { label: "Link label" });
  assertEquals(edge.eidos?.color, "red");
});

Deno.test("legend annotate: formatted text hides boundary sigils without changing entity text", () => {
  const diagram = parseTopos(`\
# Title

#note.red A formatted *note* ⏎ with another line

:legend
#note: center
`);

  const note = matchChild(diagram.root, { id: "note", nodeType: "note" });
  assertEquals(note.text, "#note.red A formatted *note* ⏎ with another line");
  assertEquals(note.segmentedText?.map((line) => line.map((segment) => segment.text).join("")).join("\n"), "A formatted note\nwith another line");
  assertObjectMatch(note.eidos!, { color: "red", textHorizontal: "center" });
});

Deno.test("legend annotate: fences automatically use code text mode", () => {
  const diagram = parseTopos(`\
~~~~
A  *literal*
~~~~
`);

  const note = matchChild(diagram.root, { nodeType: "note" }, (child) => child.nodeType === "note");
  assertObjectMatch(note.eidos!, { noteMode: "code" });
  assertEquals(note.segmentedText, [
    [],
    [{ text: "A  *literal*", code: true }],
    [],
  ]);
});

Deno.test("legend annotate: code text mode can be applied to unfenced text", () => {
  const diagram = parseTopos(`\
| Form | Meaning |
| A    | Alpha   |

:legend
%Form% : code
`);

  const note = matchChild(diagram.root, { nodeType: "note" }, (child) => child.nodeType === "note");
  assertObjectMatch(note.eidos!, { noteMode: "code" });
  assertEquals(note.segmentedText, [
    [{ text: "| Form | Meaning |", code: true }],
    [{ text: "| A    | Alpha   |", code: true }],
  ]);
});

Deno.test("legend annotate: explicit text mode preserves fence delimiters", () => {
  const diagram = parseTopos(`\
\`\`\`
A *formatted*
B \`inline\`
\`\`\`

:legend
%formatted% : text
`);

  const note = matchChild(diagram.root, { nodeType: "note" });
  assertEquals(note.eidos?.noteMode, "text");
  assertEquals(note.segmentedText?.map((line) => line.map((segment) => segment.text).join("")), ["```", "A *formatted*", "B `inline`", "```"]);
});

Deno.test("legend annotate: text mode affects notes while labels remain prose", () => {
  const diagram = parseTopos(`\
┌───────────────┐       ┌───┐
│ A *literal*   ├───────▶ B │
└───────────────┘       └───┘

Loose *literal*

:legend
%Loose% : text label=prose
[A *literal*] : text label=text
[A *literal*] -> [B] : "call *literal*" text label=text
`);

  const note = matchChild(diagram.root, { nodeType: "note" }, (child) => child.nodeType === "note");
  const box = matchChild(diagram.root, { nodeType: "box", label: "A *literal*" }, 0, 3);
  const edge = matchEdge(diagram.root, { text: "call *literal*" });

  assertEquals(note.eidos?.noteMode, "text");
  assertEquals(note.segmentedText?.[0]?.[0]?.text, "Loose *literal*");

  assertEquals(box.segmentedText?.[0]?.map((segment) => segment.text).join(""), "A literal");
  assertEquals(edge.segmentedText?.[0]?.map((segment) => segment.text).join(""), "call literal");
});

Deno.test("legend annotate: inline brackets set shape defaults and match exact selectors", () => {
  const diagram = parseTopos(`\
:map
[A]   (A)   <A>   {A}

:legend
[*] : blue
(*) : red
<*> : green
{*} : orange
<A> : trapez
`);

  const square = matchChild(diagram.root, { label: "A", nodeType: "inline", bracket: "[]" }, 0, 4);
  const round = matchChild(diagram.root, { label: "A", nodeType: "inline", bracket: "()" }, 1, 4);
  const angle = matchChild(diagram.root, { label: "A", nodeType: "inline", bracket: "<>" }, 2, 4);
  const braces = matchChild(diagram.root, { label: "A", nodeType: "inline", bracket: "{}" }, 3, 4);

  assertEquals(square.eidos, { color: "blue" });
  assertEquals(round.eidos, { corner: "pill", color: "red" });
  assertEquals(angle.eidos, { corner: "trapez", color: "green" });
  assertEquals(braces.eidos, { corner: "parallelogram", color: "orange" });
});

Deno.test("legend annotate: stack rules remain declarative", () => {
  const diagram = parseTopos(`\
┌───┐  ┌───┐  ┌───┐
│ A │  │ B │  │ C │
└───┘  └───┘  └───┘

:legend
[A] : stack=3
[B] : stack=4,-2
[C] : stack
[C] : stack=5,1,-1
`);

  assertEquals(matchChild(diagram.root, { label: "A" }, 0, 3).properties?.stack, "3");
  assertEquals(matchChild(diagram.root, { label: "B" }, 1, 3).properties?.stack, "4,-2");
  const c = matchChild(diagram.root, { label: "C" }, 2, 3);
  assertEquals(c.eidos?.layering, "stack");
  assertEquals(c.properties?.stack, "5,1,-1");
});

Deno.test("legend annotate: stack=0 does not mutate traced geometry", () => {
  const diagram = parseTopos(`\
   ┌────────────────┐
   │ ┌──────────────┴─┐
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘

:legend
[1] : stack=0
`);

  const node = matchChild(diagram.root, { label: "1" });
  assertEquals(node.stack, { layers: 3, dx: -2, dy: -1 });
  assertEquals(node.properties?.stack, "0");
});

Deno.test("legend annotate: flat remains a declarative layering eidos", () => {
  const diagram = parseTopos(`\
┌───┐
│ A │
└───┘

:legend
[A] : stack
[A] : flat
`);

  const node = matchChild(diagram.root, { label: "A" });
  assertEquals(node.stack, undefined);
  assertEquals(node.eidos?.layering, "flat");
});

Deno.test("legend annotate: descendant rules include contained edges", () => {
  const input = `\
:map
┌────────────┐
│ # Parent   │
│ [A] -> [B] │
└────────────┘

:legend
Parent >> * : red
`;

  const diagram = parseTopos(input);
  const parent = matchChild(diagram.root, { label: "Parent", nodeType: "box" });
  const a = matchChild(parent, { label: "A" }, 0, 2);
  const b = matchChild(parent, { label: "B" }, 1, 2);
  assertObjectMatch(a.eidos!, { color: "red" });
  assertObjectMatch(b.eidos!, { color: "red" });
  const edge = matchEdge(parent, {});
  assertEquals(edge.direction, "uni");
  assertObjectMatch(edge.eidos!, { color: "red", head: { marker: "angle" } });
});

Deno.test("legend annotate: edge tree parent follows containment, not source parent", () => {
  const diagram = parseTopos(`\
:map
┌────────────┐      [B]
│ # Parent   │       ▲
│ [A] ───────┼───────┘
└────────────┘

:legend
Parent > * : red
`);

  const parent = matchChild(diagram.root, { label: "Parent", nodeType: "box" }, 0, 2);
  const a = matchChild(parent, { label: "A", nodeType: "inline", bracket: "[]" }, 0, 1);
  const b = matchChild(diagram.root, { label: "B", nodeType: "inline", bracket: "[]" }, 1, 2);
  const edge = matchEdge(diagram.root, { direction: "uni", source: a, target: b });

  assertEquals(a.eidos, { color: "red" });
  assertEquals(edge.parent, diagram.root);
  assertEquals(edge.eidos?.color, undefined);
});

Deno.test("legend annotate: edge relations and edge wildcards target existing edges", () => {
  const directedInput = `\
:map
[A] -> [B]

:legend
[A] -> [B] : blue
`;

  const undirectedInput = `\
:map
A  ┐
   │
B  ┘

:legend
*--* : gray
`;

  const anyDirectionInput = `\
:map
[A] -> [B]

:legend
[B] - [A] : soft
`;

  const directedDiagram = parseTopos(directedInput);
  const undirectedDiagram = parseTopos(undirectedInput);
  const anyDirectionDiagram = parseTopos(anyDirectionInput);

  const directed = matchEdge(directedDiagram.root, { direction: "uni", source: "A", target: "B" });
  const undirected = matchEdge(undirectedDiagram.root, { direction: "none", source: "A", target: "B" });
  const anyDirection = matchEdge(anyDirectionDiagram.root, { direction: "uni", source: "A", target: "B" });
  assertObjectMatch(directed.eidos!, { color: "blue", head: { marker: "angle" } });
  assertObjectMatch(undirected.eidos!, { color: "gray" });
  assertObjectMatch(anyDirection.eidos!, { intensity: "soft", head: { marker: "angle" } });
});

Deno.test("legend annotate: '-' matches uni, bi, and none regardless of endpoint order", () => {
  const directedDiagram = parseTopos(`\
:map
[A] -> [B]

:legend
[B] - [A] : soft
`);
  const bidirectionalDiagram = parseTopos(`\
:map
[A] <-> [B]

:legend
[B] - [A] : soft
`);
  const undirectedDiagram = parseTopos(`\
:map
┌───┐   ┌───┐
│ A ├───┤ B │
└───┘   └───┘

:legend
[B] - [A] : soft
`);

  const directed = matchEdge(directedDiagram.root, { direction: "uni", source: "A", target: "B", });
  const bidirectional = matchEdge(bidirectionalDiagram.root, { direction: "bi", source: "A", target: "B" });
  const undirected = matchEdge(undirectedDiagram.root, { direction: "none", source: "A", target: "B" });

  assertObjectMatch(directed.eidos!, { intensity: "soft", head: { marker: "angle" } });
  assertObjectMatch(bidirectional.eidos!, { intensity: "soft", head: { marker: "angle" }, tail: { marker: "angle" } });
  assertObjectMatch(undirected.eidos!, { intensity: "soft" });
});

Deno.test("legend annotate: '<->' matches bidirectional edges regardless of endpoint order", () => {
  const diagram = parseTopos(`\
:map
[A] <-> [B]

:legend
[B] <-> [A] : blue
`);

  const edge = matchEdge(diagram.root, { direction: "bi", source: "A", target: "B" });
  assertObjectMatch(edge.eidos!, { color: "blue", head: { marker: "angle" }, tail: { marker: "angle" } });
});

Deno.test("legend annotate: hub-like wildcard can target parser-created hubs", () => {
  const input = `\
:map
A ───●──▶ B

:legend
<*> : blue
`;

  const diagram = parseTopos(input);
  const hub = diagram.nodes.find((node) => node.nodeType === "hub");
  assertExists(hub);
  assertObjectMatch(hub.eidos!, { color: "blue", marker: "dot" });
});

Deno.test("legend annotate: target hubs by glyph and marker name in tree selector", () => {
  const input = `\
:map
╭───────────────╮
│ ╭───╮   ╭───╮ │
│ │ ● │   │ ● │ │
│ ╰─┬─╯   ╰─▴─╯ │
│   │   ◆   │   │
│   ╰───────╯   │
╰───────────────╯
:legend
/ > [*]: #face
#face > <◆> : orange
`;

  const diagram = parseTopos(input);
  const hub = diagram.nodes.find((node) => node.nodeType === "hub" && node.glyph === "◆");
  assertExists(hub);
  assertObjectMatch(hub.eidos!, { color: "orange", marker: "diamond" });
});

Deno.test("legend annotate: target hubs by glyph and glyph-name", () => {
  const input = `\
:map
A ───●───▶ B
C ───◆───▶ D
E ───◎───▶ F

:legend
<●> : red
<diamond> : blue
<circle-dot> : green
`;

  const diagram = parseTopos(input);
  const hubDot = diagram.nodes.find((n) => n.nodeType === "hub" && n.glyph === "●");
  const hubDiamond = diagram.nodes.find((n) => n.nodeType === "hub" && n.glyph === "◆");
  const hubCircleDot = diagram.nodes.find((n) => n.nodeType === "hub" && n.glyph === "◎");

  assertExists(hubDot);
  assertExists(hubDiamond);
  assertExists(hubCircleDot);

  assertObjectMatch(hubDot.eidos!, { color: "red" });
  assertObjectMatch(hubDiamond.eidos!, { color: "blue" });
  assertObjectMatch(hubCircleDot.eidos!, { color: "green" });
});

Deno.test("legend annotate: wildcard matches loose edges without source or target", () => {
  const input = `\
:map
──▶
[A] ──▶

:legend
* -> * : ray
`;

  const diagram = parseTopos(input);

  assertEquals(diagram.edges.length, 2);

  const floatingEdge = diagram.edges[0];
  const looseEdge = diagram.edges[1];

  assertObjectMatch(floatingEdge.eidos!, { edgeRoute: "ray", head: { marker: "triangle" } });
  assertObjectMatch(looseEdge.eidos!, { edgeRoute: "ray", head: { marker: "triangle" } });
});

Deno.test("legend annotate: unbound selector matches only missing edge endpoints", () => {
  const input = `\
[A] ──▶
──▶ [B]
[A] ──▶ [B]

:legend
[A] -> _ : red
_ -> [B] : blue
`;

  const diagram = parseTopos(input);
  const fromA = diagram.edges.find((edge) => edge.source.node?.label === "A");
  const toB = diagram.edges.find((edge) => edge.target.node?.label === "B");
  const bound = diagram.edges.find((edge) => edge.source.node?.label === "A" && edge.target.node?.label === "B");

  assertExists(fromA);
  assertExists(toB);
  assertExists(bound);
  assertEquals(fromA.target.node, undefined);
  assertEquals(toB.source.node, undefined);
  assertEquals(fromA.eidos?.color, "red");
  assertEquals(toB.eidos?.color, "blue");
  assertEquals(bound.eidos?.color, undefined);
});

Deno.test("legend annotate: visual axes are last-wins while classes accumulate", () => {
  const input = `\
:map
[A]

:legend
[A] : .mc blue soft fill=blue,soft
.mc : red
[A] : green fill=red,solid
`;

  const diagram = parseTopos(input);
  const a = matchChild(diagram.root, { label: "A" });
  assertEquals(a.classes, ["mc"]);
  assertEquals(a.eidos, {
    color: "green", intensity: "soft",
    fill: { color: "red", intensity: "solid" },
  });
});

Deno.test("legend annotate: reset exempts an entity from broad Eidos styling", () => {
  const diagram = parseTopos(`\
:map
[A] [B]

:legend
[*] : .kept blue soft fill=green,solid stack=3
[A] : reset red strong
`);

  const a = matchChild(diagram.root, { label: "A" }, 0, 2);
  const b = matchChild(diagram.root, { label: "B" }, 1, 2);
  assertEquals(a.eidos, { color: "red", intensity: "strong" });
  assertEquals(a.classes, ["kept"]);
  assertEquals(a.properties, { stack: "3" });
  assertEquals(b.eidos, {
    color: "blue", intensity: "soft",
    fill: { color: "green", intensity: "solid" },
  });
});

Deno.test("legend annotate: palette declarations accompany regular rules", () => {
  const diagram = parseTopos(`\
:map
[A .red] [B]
:legend
B: fill=blue,soft
/blue: #0057b8
/red: color-mix(in oklch, #c00 80%, black)`);

  assertEquals(diagram.palette, {
    red: "color-mix(in oklch, #c00 80%, black)",
    blue: "#0057b8",
  });
  assertEquals(diagram.nodes[0].eidos, { color: "red" });
  assertEquals(diagram.nodes[1].eidos, { fill: { color: "blue", intensity: "soft" } });
});

Deno.test("legend annotate: dot-syntax in inline sigils resolves to eidos or class fallback", () => {
  const diagram = parseTopos(`\
:map
[A .red.dashed.fill-blue.external.fill-myclass]
`);
  const a = matchChild(diagram.root, { label: "A" });
  assertEquals(a.classes, ["external", "fill-myclass"]);
  assertEquals(a.eidos, {
    color: "red",
    weight: "dashed",
    fill: { color: "blue" },
  });
});

Deno.test("legend annotate: wildcard matching", () => {
  const diagram = parseTopos(`\
:map
┌───────────────────────────┐
│                           │
│   This is a               │
│   long paragraph          │
│   with three lines or     │
│   four.                   │
│                           │
└───────────────────────────┘

┌─────────────────┐
│   API Gateway   │
└─────────────────┘

:legend
%long paragraph% : blue
[API%] : red
`);

  const box1 = matchChild(diagram.root, { nodeType: "box" }, 0, 2);
  const note = matchChild(box1, { nodeType: "note" });
  assertObjectMatch(note.eidos!, { color: "blue" });

  const box2 = matchChild(diagram.root, { label: "API Gateway", nodeType: "box" }, 1, 2);
  assertObjectMatch(box2.eidos!, { color: "red" });
});

Deno.test("legend annotate: parent caret prefix matching", () => {
  const diagram = parseTopos(`\
:map
┌───────────────────────────┐
│                           │
│   This is a               │
│   long paragraph          │
│   with three lines or     │
│   four.                   │
│                           │
└───────────────────────────┘

:legend
^%long paragraph% : red
`);

  const box = matchChild(diagram.root, { nodeType: "box" });
  assertObjectMatch(box.eidos!, { color: "red" });
});

Deno.test("legend annotate: stacked parent caret prefix matching (grandparent)", () => {
  const diagram = parseTopos(`\
:map
┌─────────────────────────────┐
│ # Outer                     │
│                             │
│ ┌─────────────────────────┐ │
│ │ # Inner                 │ │
│ │                         │ │
│ │ Note line one           │ │
│ │ Note line two           │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘

:legend
^%Note% : red
^^%Note% : blue
`);

  const outer = matchChild(diagram.root, { label: "Outer", nodeType: "box" });
  const inner = matchChild(outer, { label: "Inner", nodeType: "box" });
  assertObjectMatch(inner.eidos!, { color: "red" });
  assertObjectMatch(outer.eidos!, { color: "blue" });
});

Deno.test("legend annotate: parent of node points to target", () => {
  const diagram = parseTopos(`\
:map
┌────────────┐     ┌───┐
│ # Parent   │     │ B │
│ [A]        │─────▶   │
└────────────┘     └───┘

:legend
^[A] -> [B] : red
`);

  const edge = matchEdge(diagram.root, { direction: "uni", source: "Parent", target: "B" });
  assertObjectMatch(edge.eidos!, { color: "red" });
});

Deno.test("legend annotate: spaceless edge rules apply styles", () => {
  const diagram = parseTopos(`\
:map
[A] -> [B]

:legend
[A]->[B] : blue
`);

  const edge = matchEdge(diagram.root, { direction: "uni", source: "A", target: "B" });
  assertObjectMatch(edge.eidos!, { color: "blue" });
});

Deno.test("legend annotate: '<-' matches existing uni edges in reverse direction", () => {
  const diagram = parseTopos(`\
:map
[A] -> [B]

:legend
[B] <- [A] : blue
`);

  const edge = matchEdge(diagram.root, { direction: "uni", source: "A", target: "B" });
  assertObjectMatch(edge.eidos!, { color: "blue" });
});

Deno.test("legend annotate: '~>' creates abstract edge when none exists", () => {
  const diagram = parseTopos(`\
:map
[A]    [B]

:legend
[A] ~> [B] : blue arrow
`);

  assertEquals(diagram.edges.length, 1);
  const edge = matchEdge(diagram.root, { direction: "uni", polyline: [], source: "A", target: "B" });
  assertObjectMatch(edge.eidos!, { color: "blue", head: { marker: "arrow" } });
});

Deno.test("legend annotate: abstract edge needs no empty annotation", () => {
  const diagram = parseTopos(`\
:map
[A]    [B]

:legend
[A] ~> [B]
`);

  assertEquals(diagram.edges.length, 1);
  matchEdge(diagram.root, { direction: "uni", polyline: [], source: "A", target: "B" });
});



Deno.test("legend annotate: '<~' creates abstract edge oriented right-to-left", () => {
  const diagram = parseTopos(`\
:map
[A]    [B]

:legend
[A] <~ [B] : red arrow
`);

  assertEquals(diagram.edges.length, 1);
  const edge = matchEdge(diagram.root, { direction: "uni", polyline: [], source: "B", target: "A" });
  assertObjectMatch(edge.eidos!, { color: "red" });
});

Deno.test("legend annotate: '<~>' creates bidirectional abstract edge", () => {
  const diagram = parseTopos(`\
:map
[A]    [B]

:legend
[A] <~> [B] : purple
`);

  assertEquals(diagram.edges.length, 1);
  const edge = matchEdge(diagram.root, { direction: "bi", polyline: [] });
  assertObjectMatch(edge.eidos!, { color: "purple" });
});

Deno.test("legend annotate: '~>' with class selectors creates multiple abstract edges", () => {
  const diagram = parseTopos(`\
:map
[A]    [B]    [C]

:legend
[A] : .src
[B] : .dst
[C] : .dst
[A] ~> .dst : blue
`);

  assertEquals(diagram.edges.length, 2);
  for (const edge of diagram.edges) {
    assertEquals(edge.polyline, []);
    assertEquals(edge.direction, "uni");
    assertEquals(edge.source.node?.label, "A");
    assertObjectMatch(edge.eidos!, { color: "blue" });
  }
});

Deno.test("legend annotate: border hub edge matching uses parent box", () => {
  const diagram = parseTopos(`\
:map
╔════════╗
║        ║
║   DD   ║
║        ║
╚═════□══╝
      │
      ▼
┌────────┐
│   AA   │
└────────┘

:legend
DD -> AA : blue
`);

  assertEquals(diagram.edges.length, 1);
  const edge = diagram.edges[0];
  assertObjectMatch(edge.eidos!, { color: "blue" });
});

Deno.test("legend annotate: internal hub edge matching does not use parent box", () => {
  const diagram = parseTopos(`\
:map
┌──────────────────┐
│ DD               │
│                  │
│       Hub ●──────┼───────────▶●
│                  │
└──────────────────┘

:legend
Hub -> * : dotted
DD -> * : blue
`);

  assertEquals(diagram.edges.length, 1);
  const edge = diagram.edges[0];
  assertObjectMatch(edge.eidos!, { weight: "dotted" });
  assertEquals(edge.eidos?.color, undefined);
});

Deno.test("legend annotate: grid cell edge matching delegates to parent grid box", () => {
  const diagram = parseTopos(`\
:map
┌─M───┬─────┬─────┐
│ A   │ B   │ C   │
└──┬──┴─────┴───┬─┘
   │            │
   └──────┐     │
          │     │
          │     │
          │     │
          │     │
          │     │
 ┌─N───┬──▼──┬──▼──┐
 │  A  │  B  │  C  │
 └─────┴─────┴─────┘

:legend
M -> N : red
C -> C : blue
`);

  assertEquals(diagram.edges.length, 2);

  // Find the edge connecting M's cell A to N's cell B
  const edgeAB = diagram.edges.find(e => e.source.node?.label === "A" && e.target.node?.label === "B");
  assertExists(edgeAB);
  assertObjectMatch(edgeAB.eidos!, { color: "red" });

  // Find the edge connecting M's cell C to N's cell C
  const edgeCC = diagram.edges.find(e => e.source.node?.label === "C" && e.target.node?.label === "C");
  assertExists(edgeCC);
  // Matches both rules since C is inside M and C is inside N, and direct C->C matching works.
  assertObjectMatch(edgeCC.eidos!, { color: "blue" });
});

Deno.test("legend annotate: region-line annotations survive promotion", () => {
  const input = `\
:map
## EARTH                                          ## MARS

   ┌─────────────────┐                             ┌──────────────┐
   │ Mission Control │---------------------------->│ Mars Orbiter │
   └─────────────────┘                             └──────────────┘

:legend
EARTH : "Earth" blue`;

  const diagram = parseTopos(input);
  const earth = matchChild(diagram.root, { text: "Earth", nodeType: "region" }, 0, 2);
  assertObjectMatch(earth.eidos!, { color: "blue" });
});

Deno.test("legend annotate: ordinary child rules see the promoted hierarchy", () => {
  const input = `\
:map
## EARTH                                          ## MARS

   ┌─────────────────┐                             ┌──────────────┐
   │ Mission Control │---------------------------->│ Mars Orbiter │
   └─────────────────┘                             └──────────────┘

:legend
MARS > * : red`;

  const diagram = parseTopos(input);
  const mars = matchChild(diagram.root, { label: "MARS", nodeType: "region" }, 1, 2);
  const orbiter = matchChild(mars, { label: "Mars Orbiter", nodeType: "box" }, 0, 1);
  assertObjectMatch(orbiter.eidos!, { color: "red" });
});

Deno.test("legend annotate: {*} targets all regions", () => {
  const input = `\
:map
## EARTH                                          ## MARS

   ┌─────────────────┐                             ┌──────────────┐
   │ Mission Control │---------------------------->│ Mars Orbiter │
   └─────────────────┘                             └──────────────┘

:legend
{*} : red`;

  const diagram = parseTopos(input);
  const earth = matchChild(diagram.root, { label: "EARTH", nodeType: "region" }, 0, 2);
  const mars = matchChild(diagram.root, { label: "MARS", nodeType: "region" }, 1, 2);

  assertObjectMatch(earth.eidos!, { color: "red" });
  assertObjectMatch(mars.eidos!, { color: "red" });
});

Deno.test("legend annotate: {LABEL} targets specific region", () => {
  const input = `\
:map
## EARTH                                          ## MARS

   ┌─────────────────┐                             ┌──────────────┐
   │ Mission Control │---------------------------->│ Mars Orbiter │
   └─────────────────┘                             └──────────────┘

:legend
{EARTH} : blue`;

  const diagram = parseTopos(input);
  const earth = matchChild(diagram.root, { label: "EARTH", nodeType: "region" }, 0, 2);
  const mars = matchChild(diagram.root, { label: "MARS", nodeType: "region" }, 1, 2);

  assertObjectMatch(earth.eidos!, { color: "blue" });
  assertEquals(mars.eidos?.color, undefined);
});

Deno.test("legend annotate: parent selector targets nested edges", () => {
  const input = `\
:map
# Title

## REG
   ┌───┐         ┌───┐
   │ A ├────────▶│ B │
   └───┘         └───┘

:legend
REG > *-* : blue`;

  const diagram = parseTopos(input);
  const reg = matchChild(diagram.root, { label: "REG", nodeType: "region" }, 0, 1);
  const edge = reg.edges[0];
  assertEquals(edge !== undefined, true, "Edge should be reparented to REG region");
  assertEquals(edge?.parent, reg, "Edge parent should be the REG region node");
  assertObjectMatch(edge?.eidos!, { color: "blue" }, "Edge should be styled blue by REG > *-*");
});

Deno.test("legend annotate: stem branches inherit their refined source", () => {
  const diagram = parseTopos(`\
A
├── C
├── D
└── B

:legend
A - *: red
`);

  assertEquals(diagram.edges.length, 3);
  for (const edge of diagram.edges) {
    assertEquals(edge.source.node?.label, "A");
    assertEquals(edge.eidos?.color, "red");
  }
});

Deno.test("legend annotate: open termini become Eidos markers", () => {
  const diagram = parseTopos("╶──╴");
  const edge = matchEdge(diagram.root, { direction: "none" });

  assertObjectMatch(edge.eidos!, { tail: { marker: "end-cap" }, head: { marker: "end-cap" } });
});

Deno.test("legend annotate: connected T-stops do not become end-cap markers", () => {
  const diagram = parseTopos(`\
┌───┐   ┌───┐
│ C ├───┤ D │
└───┘   └───┘`);
  const edge = matchEdge(diagram.root, { direction: "none" });

  assertEquals(edge.source.dir, Dir.None);
  assertEquals(edge.target.dir, Dir.None);
  assertEquals(edge.source.node?.label, "C");
  assertEquals(edge.target.node?.label, "D");
  assertEquals(edge.eidos?.tail, undefined);
  assertEquals(edge.eidos?.head, undefined);
});
