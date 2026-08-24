import { assertAlmostEquals, assertEquals, assertObjectMatch } from "@std/assert";
import { parseTopos } from "../../topos.ts";
import { buildSvgTree } from "../svg.ts";
import { CHAR_HEIGHT, CHAR_WIDTH, nodeRenderedBoundsPx } from "../geometry.ts";
import { matchChildEl } from "../../jsonml/assert.ts";
import { attrs, Child, XmlEl } from "../../jsonml/jsonml.ts";
import { resolveStack } from "../stacked-box.ts";

/**
 * Enamel Stacked Architecture Tests
 * Verifies local asset injection, inner-contracted double outlines, and pattern propagation.
 */

Deno.test("stacked: local pattern injection and unique IDs", () => {
  const input = `\
┌───┐
│ H │
└───┘

:legend
[H]: stack red hatch
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);

  // The stack is one node group with three shape layers.
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeH = matchChildEl(root, "g", { class: "tp-hatch" });
  const pattern = matchChildEl(nodeH, "pattern", { id: "tpc-pat-hatch-0" });
  const patternId = String(attrs(pattern).id);
  const rect = matchChildEl(nodeH, "rect", { class: "tpc-shape tp-opaque" });
  const style = attrs(rect).style as string;

  assertEquals(patternId.startsWith("tpc-pat-hatch-"), true, `Pattern ID should be descriptive, got ${patternId}`);
  assertEquals(style.includes(`fill: url(#${patternId})`), true, "Shape fill should target its local pattern ID");
  assertEquals(
    style.includes(`--tp-local-fill: url(#${patternId})`),
    true,
    "Should set local fill variable for symbols",
  );
});

Deno.test("stacked: inner-scaling for .double", () => {
  const input = `\
┌───┐
│ D │
└───┘

:legend
[D]: double
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeD = matchChildEl(root, "g", { class: "tp-double" });

  // 1. Verify two rects exist using matchChildEl with indices
  const outer = matchChildEl(nodeD, "rect", { class: "tpc-shape" }, 0, 2);
  const inner = matchChildEl(nodeD, "rect", { class: "tpc-shape" }, 1, 2);

  // 2. Verify coordinates (Inner should be contracted by 3px)
  const o = attrs(outer);
  assertObjectMatch(attrs(inner), {
    x: Number(o.x) + 3,
    y: Number(o.y) + 3,
    width: Number(o.width) - 6,
    height: Number(o.height) - 6,
  });
});

Deno.test("stacked: particles decorate only the face layer", () => {
  const input = `\
┌───┐   ┌───┐
│ D │   │ S │
└───┘   └───┘

:legend
[D]: double spark
[S]: stack spark
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const particleCount = (className: string) => {
    const node = matchChildEl(root, "g", { class: className });
    return node.slice(2).filter((child) =>
      Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tpc-particle")
    ).length;
  };

  assertEquals(particleCount("tp-double"), 1);
  assertEquals(particleCount("tp-stack"), 1);
});

Deno.test("stacked: isolated fill for .double", () => {
  const input = `\
┌───┐
│ D │
└───┘

:legend
[D]: double red hatch
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeD = matchChildEl(root, "g", { class: "tp-double" });

  const outer = matchChildEl(nodeD, "rect", { class: "tpc-shape" }, 0, 2);
  const inner = matchChildEl(nodeD, "rect", { class: "tpc-shape" }, 1, 2);

  // Outer should have fill: none
  const outerStyle = attrs(outer).class as string;
  assertEquals(outerStyle.includes("tp-transparent"), true, "Outer layer of double stroke should have no fill");

  // Inner should have the pattern
  const innerStyle = attrs(inner).style as string;
  assertEquals(innerStyle.includes("fill: url(#tpc-pat-hatch-"), true, "Inner layer should receive the pattern fill");
});

Deno.test("stacked: symbol pattern propagation via --tp-local-fill", () => {
  const input = `\
┌───┐
│ F │
└───┘

:legend
[F]: hatch @file
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeF = matchChildEl(root, "g", { class: "tp-hatch" });

  const use = matchChildEl(nodeF, "use", { class: "tpc-shape" });
  const style = attrs(use).style as string;

  // Verify both high-priority fill and the variable for symbol sub-paths
  assertEquals(style.includes("fill: url(#tpc-pat-hatch-"), true);
  assertEquals(style.includes("--tp-local-fill: url(#tpc-pat-hatch-"), true);
});

Deno.test("stacked: shared filters for .double layers", () => {
  const input = `\
┌───┐
│ C │
└───┘

:legend
[C]: double chalk
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeC = matchChildEl(root, "g", { class: "tp-double" });

  const outer = matchChildEl(nodeC, "rect", { class: "tpc-shape" }, 0, 2);
  const inner = matchChildEl(nodeC, "rect", { class: "tpc-shape" }, 1, 2);

  assertEquals(attrs(nodeC).filter, "url(#tpc-flt-chalk)");
  assertEquals(attrs(outer).filter, undefined);
  assertEquals(attrs(inner).filter, undefined);
});

Deno.test("stacked: traced stack centers its label in the rendered face", () => {
  const input = `\
   ┌────────────────┐    
   │ ┌──────────────┴─┐  
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const node = matchChildEl(root, "g", { class: "tp-node" });
  const face = matchChildEl(node, "rect", { class: "tpc-shape tp-opaque" });
  const label = matchChildEl(node, "text", { class: "tpc-label" });
  const faceAttrs = attrs(face);

  assertObjectMatch(faceAttrs, {
    x: 7 * CHAR_WIDTH,
    y: 2 * CHAR_HEIGHT,
    width: 18 * CHAR_WIDTH,
    height: 4 * CHAR_HEIGHT,
  });
  assertEquals(attrs(label).x, Number(faceAttrs.x) + Number(faceAttrs.width) * 0.5);
  assertEquals(Number(attrs(label).y) + 7, Number(faceAttrs.y) + Number(faceAttrs.height) * 0.5);
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
});

Deno.test("stacked: annotating a plain box does not move its centered label", () => {
  const ast = parseTopos(`\
┌───────┐  ┌───────┐
│       │  │       │
│   A   │  │   B   │
│       │  │       │
└───────┘  └───────┘

:legend
[B] : stack
`);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeA = matchChildEl(root, "g", { class: "tp-node" }, 0, 2);
  const nodeB = matchChildEl(root, "g", { class: "tp-node" }, 1, 2);
  const labelA = matchChildEl(nodeA, "text", { class: "tpc-label", $text: "A" });
  const labelB = matchChildEl(nodeB, "text", { class: "tpc-label", $text: "B" });

  assertEquals(attrs(labelB).y, attrs(labelA).y);
});

Deno.test("stacked: edges meet the rendered face perimeter", () => {
  const ast = parseTopos(`\
┌───────┐      ┌───────┐
│       │      │       │
│   A   ├─────▶│   B   │
│       │      │       │
└───────┘      └───────┘

:legend
[A] : stack
[B] : stack
`);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-edge" });
  const path = matchChildEl(edge, "path", { class: "tpc-shape" });
  const coordinates = String(attrs(path).d).match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g)!;

  const source = ast.nodes.find((node) => node.label === "A")!;
  const target = ast.nodes.find((node) => node.label === "B")!;
  const sourceBounds = nodeRenderedBoundsPx(source);
  const targetBounds = nodeRenderedBoundsPx(target);

  assertAlmostEquals(Number(coordinates[0].split(",")[0]), sourceBounds.x + sourceBounds.w + 2, 0.02);
  assertAlmostEquals(Number(coordinates.at(-1)!.split(",")[0]), targetBounds.x - 2, 0.02);
});

Deno.test("stacked: Enamel resolves numeric stack properties", () => {
  const ast = parseTopos(`\
┌───┐
│ A │
└───┘

:legend
[A] : stack=4,-2,-1
`);

  const node = ast.nodes.find((candidate) => candidate.label === "A")!;
  assertEquals(resolveStack(node), { layers: 4, dx: -2, dy: -1 });
  assertEquals(node.stack, undefined);
});

Deno.test("stacked: stack=0 suppresses traced stack geometry", () => {
  const ast = parseTopos(`\
   ┌────────────────┐
   │ ┌──────────────┴─┐
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘

:legend
[1] : stack=0
`);

  const node = ast.nodes.find((candidate) => candidate.label === "1")!;
  assertEquals(node.stack, { layers: 3, dx: -2, dy: -1 });
  assertEquals(resolveStack(node), undefined);
});

Deno.test("stacked: semantic symbols replication", () => {
  const input = `\
   ┌────────────────┐
   │ ┌──────────────┴─┐
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
:legend
[1]: @database
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(root, "g", { class: "tp-node" }) as XmlEl;
  const uses = (nodeGrp.slice(2) as Child[]).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "use"
  );

  assertEquals(uses.length, 3, "Should render 3 database symbols for stack(3)");
  assertEquals(String(uses[0][1].class).includes("tp-hollow"), true, "Shadow layer should have hollow class");
  assertEquals(String(uses[2][1].class).includes("tp-opaque"), true, "Top layer should have opaque class");
});
