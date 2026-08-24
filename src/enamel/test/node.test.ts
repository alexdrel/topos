import { assertEquals } from "@std/assert";
import { parseTopos } from "../../topos.ts";

import { buildSvgTree, compendiumAsset } from "../svg.ts";
import { findEl, matchChildEl } from "../../jsonml/assert.ts";
import { attrs, type XmlEl } from "../../jsonml/jsonml.ts";

/**
 * 1. Exhaustive nodeType & Label Verification
 */
Deno.test("svg: exhaustive nodeType and label verification", () => {
  const input = `\
┌─────┐  ( Inline )
│ Box │  Prose Text
└─────┘      |
          A ─●─ B
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const box = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" }, 0);
  matchChildEl(box, "text", { class: "tpc-label", $text: "Box" });

  const inline = matchChildEl(diagGrp, "g", { class: "tp-node tp-inline" }, 0);
  matchChildEl(inline, "text", { class: "tpc-label", $text: "Inline" });

  const note = matchChildEl(diagGrp, "g", { class: "tp-node tp-note" }, 0);
  matchChildEl(note, "text", { class: "tpc-label", $text: "Prose Text" });

  matchChildEl(diagGrp, "g", { class: "tp-node tp-hub" }, 0);
});

/**
 * 2. Regions
 */
Deno.test("svg: promoted regions render as regular node rectangles", () => {
  const input = `\
## LANE1                                            ## LANE2

   ┌───────────┐                                     ┌───────────┐
   │ Process 1 │------------------------------------>│ Process 2 │
   └───────────┘                                     └───────────┘
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const region = matchChildEl(diagGrp, "g", { class: "tp-node tp-region" }, 0);
  matchChildEl(region, "g", { class: "tp-node tp-box" }, 0);
  matchChildEl(region, "rect", { class: "tpc-shape" }, 0);
});

/**
 * 3. Symbols & Semantic Types
 */
Deno.test("svg: symbols and semantic types", () => {
  const input = `\
┌─────┐
│ DB  │
└─────┘

:legend
[DB]: @database
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const dbNode = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" });
  matchChildEl(dbNode, "use", { class: "tpc-shape", href: "#tpc-sym-database" });
});

Deno.test("svg: corner geometry supports inline defaults and regular boxes", () => {
  const inlineShape = (text: string, tag: string): XmlEl => {
    const root = matchChildEl(buildSvgTree(parseTopos(text)), "g", { class: "tp-root" });
    const inline = matchChildEl(root, "g", { class: "tp-node tp-inline" });
    return matchChildEl(inline, tag, { class: "tpc-shape" });
  };
  inlineShape("[Square]", "rect");
  assertEquals(attrs(inlineShape("(Round)", "rect")).rx, 12);
  inlineShape("<Diamond>", "polygon");
  inlineShape("{Lean}", "polygon");

  const boxShape = (corner: string): XmlEl => {
    const ast = parseTopos(`\
┌─────┐
│ Box │
└─────┘

:legend
[Box]: ${corner}
`);
    const root = matchChildEl(buildSvgTree(ast), "g", { class: "tp-root" });
    const box = matchChildEl(root, "g", { class: "tp-node tp-box" });
    return matchChildEl(box, "polygon", { class: "tpc-shape" });
  };
  boxShape("rhombus");
  const bevelPoints = String(attrs(boxShape("bevel")).points).split(" ");
  assertEquals(bevelPoints.length, 8);
  const skew = attrs(boxShape("skew")).points;
  const parallelogram = attrs(boxShape("parallelogram")).points;
  assertEquals(skew, parallelogram);
  boxShape("trapez");

  const diamond = parseTopos(`\
┌───────┐
│       │
│  BB   │
│       │
└───────┘

:legend
[BB]: rhombus
`);
  const diamondRoot = matchChildEl(buildSvgTree(diamond), "g", { class: "tp-root" });
  const diamondBox = matchChildEl(diamondRoot, "g", { class: "tp-node tp-box" });
  const diamondPoints = String(attrs(matchChildEl(diamondBox, "polygon", { class: "tpc-shape" })).points)
    .split(" ")
    .map((point) => Number(point.split(",", 1)[0]));
  assertEquals(diamondPoints[1], diamondPoints[2]);

  const tall = parseTopos(`\
┌───┐
│ B │
│   │
│   │
│   │
│   │
│   │
└───┘

:legend
[B]: trapez
`);
  const tallRoot = matchChildEl(buildSvgTree(tall), "g", { class: "tp-root" });
  const tallBox = matchChildEl(tallRoot, "g", { class: "tp-node tp-box" });
  const [topLeft, topRight] = String(attrs(matchChildEl(tallBox, "polygon", { class: "tpc-shape" })).points)
    .split(" ", 2)
    .map((point) => Number(point.split(",", 1)[0]));
  assertEquals(topLeft < topRight, true);
});

/**
 * 4. Deep Nesting
 */
Deno.test("svg: deep nesting (3+ levels)", () => {
  const input = `\
┌───────────────┐
│ Level 1       │
│ ┌───────────┐ │
│ │ Level 2   │ │
│ │ ┌───────┐ │ │
│ │ │ L 3   │ │ │
│ │ └───────┘ │ │
│ └───────────┘ │
└───────────────┘`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const l1 = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" });
  const l2 = matchChildEl(l1, "g", { class: "tp-node tp-box" });
  const l3 = matchChildEl(l2, "g", { class: "tp-node tp-box" });
  matchChildEl(l3, "text", { $text: "L 3" });
});

/**
 * 5. Coloring (Slots & Density)
 */
Deno.test("svg: coloring (slots and density)", () => {
  const input = `\
┌─────┐
│ A   │
└─────┘

:legend
[A]: stroke=red fill=blue,soft label=purple,strong
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  matchChildEl(diagGrp, "g", { class: "tp-node tp-box tp-stroke-red tp-fill-blue tp-fill-soft tp-label-purple tp-label-strong" });
});

Deno.test("svg: local colors directly override node paint", () => {
  const input = `\
┌─────┐
│ A   │
└─────┘

:legend
[A]: fill-color=#abc stroke-color=navy label-color="#123456"
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  matchChildEl(diagGrp, "g", {
    class: "tp-node tp-box",
    style: "--tp-entity-fill: #abc; --tp-entity-stroke: navy; --tp-entity-label: #123456",
  });
});

Deno.test("svg: notes support scoped label eidos classes", () => {
  const input = `\
Note

:legend
Note: red label=blue,strong
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const note = matchChildEl(diagGrp, "g", { class: "tp-note" });

  assertEquals(attrs(note).class, "tp tp-node tp-note tp-color-red tp-label-blue tp-label-strong");
});

/**
 * 6. Varied Semantic Symbols
 */
Deno.test("svg: varied semantic symbols", () => {
  const input = `\
┌───┐ ┌───┐
│ A │ │ B │
└───┘ └───┘

:legend
[A]: @file
[B]: @cloud
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const f = matchChildEl(diagGrp, "g", { class: "tp-box" }, 0);
  matchChildEl(f, "use", { href: "#tpc-sym-file" });

  const u = matchChildEl(diagGrp, "g", { class: "tp-box" }, 1);
  matchChildEl(u, "use", { href: "#tpc-sym-cloud" });
});

Deno.test("svg: rectangular symbol bodies fill their viewport", () => {
  assertEquals(attrs(compendiumAsset("tpc-sym-file")!).viewBox, "4 4 92 92");
  assertEquals(attrs(compendiumAsset("tpc-sym-folder")!).viewBox, "4 20 92 80");
});

/**
 * 7. Root & Region Background Shapes
 */
Deno.test("svg: root node has no background shape", () => {
  const input = `\
┌───┐
│ A │
└───┘`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const rootGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const rootShape = findEl(rootGrp!, "rect", { class: "tpc-shape" }, 1);
  assertEquals(rootShape, undefined, "Root node should not have a physical shape rect");
});

/**
 * 8. Region Geometry
 */
Deno.test("svg: multiple promoted regions render quiet regular bodies", () => {
  const input = `\
## L1   ## L2   ## L3
 ┌───┐
 │ A │
 └───┘
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const l1 = matchChildEl(diagGrp, "g", { class: "tp-node tp-region" }, 0);
  const shape1 = matchChildEl(l1, "rect", { class: "tpc-shape" });
  assertEquals(attrs(shape1)["stroke-width"], undefined);

  const l2 = matchChildEl(diagGrp, "g", { class: "tp-node tp-region" }, 1);
  matchChildEl(l2, "rect", { class: "tpc-shape" });
});

Deno.test("svg: ceiling rawLabels stay inside the box with a tight inset", () => {
  const input = `\
┌─Title──────┐
│ Body       │
└────────────┘`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const box = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" });
  const title = matchChildEl(box, "text", { class: "tpc-label", $text: "Title" });

  assertEquals(attrs(title)["dominant-baseline"], "hanging");
  assertEquals(attrs(title).y, 3);
  assertEquals(attrs(title).dy, undefined);
});

Deno.test("svg: explicit label placement overrides inferred placement", () => {
  const input = `\
┌───┐
│ A │
│   │
│   │
└───┘

:legend
[A]: right bottom
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const box = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" });
  const label = matchChildEl(box, "text", { class: "tpc-label", $text: "A" });

  assertEquals(attrs(label)["text-anchor"], "end");
  assertEquals(attrs(label)["dominant-baseline"], "hanging");
  assertEquals(attrs(label).y, 100);
  assertEquals(attrs(label).dy, undefined);
});

Deno.test("svg: stroke-none disables shape strokes", () => {
  const input = `\
┌─────┐
│ A   │
└─────┘

:legend
[A]: stroke=none fill=blue,soft
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const box = matchChildEl(diagGrp, "g", { class: "tp-node tp-box tp-stroke-none tp-fill-blue tp-fill-soft" });
  matchChildEl(box, "rect", { class: "tpc-shape" });
});

Deno.test("svg: none hides an entity or only its scoped label", () => {
  const input = `\
┌────────────┐ ┌──────────┐
│ Hidden     │ │ No label │
│  [Child]   │ └──────────┘
└────────────┘

Hidden note

:legend
[Hidden]: none label=solid
[No label]: label=none
%Hidden note%: label=none
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const hidden = matchChildEl(diagGrp, "g", { class: "tp-node tp-box tp-none tp-label-solid" });
  matchChildEl(hidden, "g", { class: "tp-node tp-inline" });
  matchChildEl(diagGrp, "g", { class: "tp-node tp-box tp-label-none" });
  matchChildEl(diagGrp, "g", { class: "tp-node tp-note tp-label-none" });
});

Deno.test("svg: hub label alignment left and right", () => {
  const input = `\
  Top ●

  ● Bottom
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const hub1 = matchChildEl(diagGrp, "g", { class: "tp-node tp-hub" }, 0);
  const label1 = matchChildEl(hub1, "text", { class: "tpc-label", "text-anchor": "end", $text: "Top" });
  assertEquals(attrs(label1).dx, undefined);

  const hub2 = matchChildEl(diagGrp, "g", { class: "tp-node tp-hub" }, 1);
  const label2 = matchChildEl(hub2, "text", { class: "tpc-label", "text-anchor": "start", $text: "Bottom" });
  assertEquals(attrs(label2).dx, undefined);
});

Deno.test("svg: hub and note label alignment overrides", () => {
  const input = `\
  Top ●

  ● Bottom

  Note1

  Note2

:legend
Top: label=right
Bottom: label=left
Note1: center
Note2: right
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  // Top (originally Top ● [left] but overridden to right -> text-anchor: "start")
  const hub1 = matchChildEl(diagGrp, "g", { class: "tp-node tp-hub" }, 0);
  const label1 = matchChildEl(hub1, "text", { class: "tpc-label", "text-anchor": "start", $text: "Top" });
  assertEquals(attrs(label1).dx, undefined);

  // Bottom (originally ● Bottom [right] but overridden to left -> text-anchor: "end")
  const hub2 = matchChildEl(diagGrp, "g", { class: "tp-node tp-hub" }, 1);
  const label2 = matchChildEl(hub2, "text", { class: "tpc-label", "text-anchor": "end", $text: "Bottom" });
  assertEquals(attrs(label2).dx, undefined);

  // Note1 (explicit block center -> middle anchor)
  const note1 = matchChildEl(diagGrp, "g", { class: "tp-node tp-note" }, 0);
  matchChildEl(note1, "text", { class: "tpc-label", "text-anchor": "middle", $text: "Note1" });

  // Note2 (explicit block right -> end anchor)
  const note2 = matchChildEl(diagGrp, "g", { class: "tp-node tp-note" }, 1);
  matchChildEl(note2, "text", { class: "tpc-label", "text-anchor": "end", $text: "Note2" });
});
