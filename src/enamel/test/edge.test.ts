import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { parseTopos } from "../../topos.ts";
import { buildSvgTree } from "../svg.ts";
import { attrs, children, tag, textContent, XmlEl } from "../../jsonml/jsonml.ts";
import { matchChildEl } from "../../jsonml/assert.ts";
import { CHAR_HEIGHT, CHAR_WIDTH, nodeToRectPx } from "../geometry.ts";
import { toPathStr } from "../edge.ts";

const getRadiusFromD = (d: string) => {
  if (!d.includes("Q")) return 0;
  const segments = d.split(" Q ");
  for (const segment of segments.slice(1)) {
    const parts = segment.trim().split(/[ ,]/).filter(Boolean);
    const [xC, yC] = [parseFloat(parts[0]), parseFloat(parts[1])];
    const [x2, y2] = [parseFloat(parts[2]), parseFloat(parts[3])];
    const prevParts = d.split(` Q ${parts[0]},${parts[1]}`)[0].trim().split(/[ ,ML]/).filter(Boolean);
    const [x1, y1] = [parseFloat(prevParts.at(-2)!), parseFloat(prevParts.at(-1)!)];
    if (Math.abs(x1 - xC) < 0.1 && Math.abs(x2 - xC) < 0.1) continue;
    if (Math.abs(y1 - yC) < 0.1 && Math.abs(y2 - yC) < 0.1) continue;
    return Math.sqrt((x1 - xC) ** 2 + (y1 - yC) ** 2);
  }
  return 0;
};

const findEdgeByClass = (node: XmlEl, cls: string): XmlEl | undefined => {
  if (tag(node) === "g" && String(attrs(node).class ?? "").includes(cls)) return node;
  for (const c of children(node)) {
    const found = findEdgeByClass(c, cls);
    if (found) return found;
  }
  return undefined;
};

/**
 * 1. Edge Pipeline: Markers and Labels
 */
Deno.test("svg: edge pipeline (markers and rawLabels)", () => {
  const input = `\
┌───┐       ┌───┐
│ A ├─call──▶ B │
└───┘       └───┘`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" });

  matchChildEl(edge, "path", {
    class: "tpc-shape",
    "marker-end": "url(#tpc-arr-triangle)",
  });
  matchChildEl(edge, "text", { class: "tpc-label", $text: "call" });
});

Deno.test("svg: open edge termini use break markers", () => {
  for (const input of ["╶──╴", "╷\n│\n╵"]) {
    const svgTree = buildSvgTree(parseTopos(input));
    const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
    const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" });

    matchChildEl(edge, "path", {
      class: "tpc-shape",
      "marker-start": "url(#tpc-arr-end-cap)",
      "marker-end": "url(#tpc-arr-end-cap)",
    });
  }
});

Deno.test("svg: connected T-stops do not use break markers", () => {
  const input = `\
┌───┐   ┌───┐
│ C ├───┤ D │
└───┘   └───┘`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" });
  const path = matchChildEl(edge, "path", { class: "tpc-shape" });

  assertEquals(attrs(path)["marker-start"], undefined);
  assertEquals(attrs(path)["marker-end"], undefined);
});

Deno.test("svg: connected T-stops preserve their authored off-center row", () => {
  const input = `\
┌─────┐   ┌─────┐
│ A   ├───┤ B   │
│     │   │     │
│     │   │     │
└─────┘   └─────┘`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" });
  const path = matchChildEl(edge, "path", { class: "tpc-shape" });
  const coordinates = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const authoredY = 1.5 * CHAR_HEIGHT;

  assertEquals(coordinates[1], authoredY);
  assertEquals(coordinates.at(-1), authoredY);
});

/**
 * 2. Abstract Edges and Fill-None
 */
Deno.test("svg: abstract edges and fill-none", () => {
  const input = `\
┌───┐       ┌───┐
│ A ├───────┤ B │
└───┘       └───┘

:legend
[A] -- [B]: .legend fill=none
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  matchChildEl(diagGrp, "g", { class: "tp-edge legend tp-fill-none" });
});

Deno.test("svg: local colors directly override edge paint", () => {
  const input = `\
┌───┐       ┌───┐
│ A ├───────┤ B │
└───┘       └───┘

:legend
[A] -- [B]: fill-color=#abc stroke-color=navy label-color="#123456"
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  matchChildEl(diagGrp, "g", {
    class: "tp-edge",
    style: "--tp-entity-fill: #abc; --tp-entity-stroke: navy; --tp-entity-label: #123456",
  });
});

/**
 * 3. Edge Processing & Geometry
 */
Deno.test("edge path: rounds a corner", () => {
  assertEquals(
    toPathStr([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 4),
    "M 0,0 L 6,0 Q 10,0 10,4 L 10,10",
  );
});

Deno.test("edge path: bevels a corner", () => {
  assertEquals(
    toPathStr([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 4, "bevel"),
    "M 0,0 L 6,0 L 10,4 L 10,10",
  );
});

Deno.test("edge path: requires at least two points", () => {
  assertEquals(toPathStr([{ x: 5, y: 5 }]), "");
});

Deno.test("edge path: caps radius to half the adjacent segment", () => {
  assertEquals(
    toPathStr([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 20),
    "M 0,0 L 5,0 Q 10,0 10,5 L 10,10",
  );
});

Deno.test("svg: edge geometry (label multipoint midpoint)", () => {
  const input = `\
┌───┐
│ A │
└───┘
  │
  └─label──▶ ┌───┐
             │ B │
             └───┘`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" }, 0);
  const label = matchChildEl(edge, "text", { class: "tpc-label" }, 0);
  const path = matchChildEl(edge, "path", { class: "tpc-shape" }, 0);

  const y = Number(attrs(label).y);
  const d = String(attrs(path).d);
  assertEquals(d.length > 5, true, "Path must have sufficient geometric data");
  assertEquals(y > 0, true, "Label should be dynamically positioned");
});

Deno.test("svg: edge label preserves its authored center relative to the edge bounds", () => {
  const input = `\
┌───┐             ┌───┐
│ A ├─left────────▶ B │
└───┘             └───┘`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" });
  const label = matchChildEl(edge, "text", { class: "tpc-label", $text: "left" });
  const path = matchChildEl(edge, "path", { class: "tpc-shape" });
  const pathNumbers = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pathMidpointX = (pathNumbers[0] + pathNumbers.at(-2)!) / 2;

  assert(Number(attrs(label).x) < pathMidpointX, "A left-authored edge label should render left of the path midpoint");
});

Deno.test("svg: vertical edge label center is not displaced by its source width", () => {
  const input = `\
       ┌─────────────────────────────────────⯈
       │
       │
       │
       │
Long label text
       │
       │
       │
       │`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" });
  const label = matchChildEl(edge, "text", { class: "tpc-label", $text: "Long label text" });
  const path = matchChildEl(edge, "path", { class: "tpc-shape" });
  const pathNumbers = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pathXs = pathNumbers.filter((_, index) => index % 2 === 0);

  assertAlmostEquals(Number(attrs(label).x), Math.min(...pathXs));
});

Deno.test("svg: edge label center may remain outside the polyline bounds", () => {
  const input = `\
              ┌────▶
              │
              │
              │
              │
              │
              │
              │
Long label text
              │
              │
              │
              │`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" });
  const label = matchChildEl(edge, "text", { class: "tpc-label", $text: "Long label text" });
  const path = matchChildEl(edge, "path", { class: "tpc-shape" });
  const pathNumbers = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pathXs = pathNumbers.filter((_, index) => index % 2 === 0);

  assert(Number(attrs(label).x) < Math.min(...pathXs), "The rendered label center should remain left of the vertical line");
});

Deno.test("svg: legend edge labels align from traced vertical paths", () => {
  const input = `\
[A]            ▲
 │             │
 │             │
 │             │
 │             │
 │             │
 ▼            [B]

:legend
A -> _: "LEFT" left
B -> _: "RIGHT" right
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edges = root.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "g" && String(attrs(child).class).includes("tp-edge")
  );
  const placements = Object.fromEntries(edges.map((edge) => {
    const label = matchChildEl(edge, "text", { class: "tpc-label" });
    const shape = edge.slice(2).find((child): child is XmlEl =>
      Array.isArray(child) && String(attrs(child).class).includes("tpc-shape")
    )!;
    const coordinates = String(attrs(shape).d ?? attrs(shape).points).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const pathXs = coordinates.filter((_, index) => index % 2 === 0);
    return [textContent(label), { label, pathX: (Math.min(...pathXs) + Math.max(...pathXs)) / 2 }];
  }));

  assert(Number(attrs(placements.LEFT.label).x) < placements.LEFT.pathX);
  assertEquals(attrs(placements.LEFT.label)["text-anchor"], "end");
  assert(Number(attrs(placements.RIGHT.label).x) > placements.RIGHT.pathX);
  assertEquals(attrs(placements.RIGHT.label)["text-anchor"], "start");
});

Deno.test("svg: lateral block and standard labels share the path midpoint Y", () => {
  const input = `\
┌─────────┐
│    A    │
└──┬───▲──┘
   │   │
   │   │
   │   │
┌──▼───┴──┐
│    B    │
└─────────┘

:legend
[A] -> [B]: "LEFT" left block
[B] -> [A]: "RIGHT" right
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  matchChildEl(matchChildEl(root, "g", { class: "tp-edge tp-block" }), "polygon", { class: "tpc-shape" });
  const labels = root.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "g" && String(attrs(child).class).includes("tp-edge")
  ).map((edge) => matchChildEl(edge, "text", { class: "tpc-label" }));

  assertEquals(attrs(labels[0]).y, attrs(labels[1]).y);
  assertEquals(labels.map((label) => attrs(label)["dominant-baseline"]), ["middle", "middle"]);
});

Deno.test("svg: Legend positions authored labels on vertical edges", () => {
  const input = `\
▲             ▲
│             │
│             │
el1           el2
│             │
│             │
▼             ▼

:legend
el1: left
el2: right
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edges = root.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "g" && String(attrs(child).class).includes("tp-edge")
  );
  const placements = Object.fromEntries(edges.map((edge) => {
    const label = matchChildEl(edge, "text", { class: "tpc-label" });
    const path = matchChildEl(edge, "path", { class: "tpc-shape" });
    const pathX = Number(String(attrs(path).d).match(/-?\d+(?:\.\d+)?/)?.[0]);
    return [textContent(label), { label, pathX }];
  }));

  assert(Number(attrs(placements.el1.label).x) < placements.el1.pathX);
  assert(Number(attrs(placements.el2.label).x) > placements.el2.pathX);
});

Deno.test("svg: explicit legend edge label coordinates override both axes", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

:legend
[A] -> [B]: "Link" left=1 top=2
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-edge" });
  const label = matchChildEl(edge, "text", { class: "tpc-label" });
  const path = matchChildEl(edge, "path", { class: "tpc-shape" });
  const coordinates = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pathXs = coordinates.filter((_, index) => index % 2 === 0);
  const pathYs = coordinates.filter((_, index) => index % 2 === 1);

  assertAlmostEquals(Number(attrs(label).x), Math.min(...pathXs) + CHAR_WIDTH, 0.02);
  assertAlmostEquals(Number(attrs(label).y), Math.min(...pathYs) + 2 * CHAR_HEIGHT, 0.02);
});

Deno.test("svg: multi-line edge labels support scoped line alignment", () => {
  const input = `\
A ── Link ──▶ B

:legend
"Link": "First ⏎ Second" label=red,align-left
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-edge" });
  const label = matchChildEl(edge, "text", { class: "tpc-label" });
  const tspans = children(label).filter((child): child is XmlEl => Array.isArray(child) && tag(child) === "tspan");

  assertEquals(tspans.map((tspan) => textContent(tspan)), ["First", "Second"]);
  assertEquals(tspans.map((tspan) => attrs(tspan)["text-anchor"]), ["start", "start"]);
});

Deno.test("svg: bottom-right edge label stays above a traced bend", () => {
  const input = `\
┌───┐
│ A ├──────┐
└───┘      │
           ▼
         ┌───┐
         │ B │
         └───┘

:legend
[A] -> [B]: "Link" bottom right
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-edge" });
  const label = matchChildEl(edge, "text", { class: "tpc-label" });
  const path = matchChildEl(edge, "path", { class: "tpc-shape" });
  const coordinates = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pathXs = coordinates.filter((_, index) => index % 2 === 0);
  const pathYs = coordinates.filter((_, index) => index % 2 === 1);

  assert(Number(attrs(label).x) > pathXs.at(-1)!);
  assert(Number(attrs(label).y) < Math.max(...pathYs));
  assertEquals(attrs(label)["text-anchor"], "start");
});

Deno.test("svg: left and right choose opposite ends of a horizontal path", () => {
  const render = (position: "left" | "right") => {
    const input = `\
┌─────────label─────────▶
│
│
│
▼

:legend
label: ${position}
`;
    const svgTree = buildSvgTree(parseTopos(input));
    const root = matchChildEl(svgTree, "g", { class: "tp-root" });
    const edge = matchChildEl(root, "g", { class: "tp-edge" });
    return {
      label: matchChildEl(edge, "text", { class: "tpc-label" }),
      path: matchChildEl(edge, "path", { class: "tpc-shape" }),
    };
  };
  const left = render("left");
  const right = render("right");
  const coordinates = String(attrs(left.path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pathXs = coordinates.filter((_, index) => index % 2 === 0);

  assert(Number(attrs(left.label).x) < Number(attrs(right.label).x));
  assert(Number(attrs(left.label).x) < Math.max(...pathXs));
  assert(Number(attrs(right.label).x) > Math.min(...pathXs));
  assertEquals(attrs(left.label)["text-anchor"], "start");
  assertEquals(attrs(right.label)["text-anchor"], "end");
});

/**
 * 4. Orthogonal Arrival (Alignment Fix)
 */
Deno.test("svg: orthogonal arrival (no crooked arrowheads)", () => {
  const input = `\
   ┌───┐
   │ A │
   └───┘
     │
     ▼
┌────────────┐
│    Wide    │
└────────────┘`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" }, 0);
  const path = matchChildEl(edge, "path", { class: "tpc-shape" }, 0);
  const d = String(attrs(path).d);

  const parts = d.split(/[ ,ML]/).filter(Boolean);
  const x1 = parseFloat(parts[0]);
  const x2 = parseFloat(parts[2]);

  assertAlmostEquals(x1, x2, 0.01, `Edge arrival should be perfectly vertical: ${d}`);
});

Deno.test("svg: terminus offset leaves authored space around attached notes", () => {
  const input = `\
       +--------+
       |        |
    A -+        +-> B

    +-- A
    |
    +---> B`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const targets = ast.nodes.filter((node) => node.nodeType === "note" && node.label === "B");

  for (const [index, target] of targets.entries()) {
    const edge = matchChildEl(root, "g", { class: "tp-edge" }, index);
    const path = matchChildEl(edge, "path", { class: "tpc-shape" });
    const coordinates = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

    assertEquals(ast.edges[index].target.offset, 2);
    assertAlmostEquals(coordinates.at(-2)!, nodeToRectPx(target).x - CHAR_WIDTH);
  }
});

Deno.test("svg: edges keep a fixed clearance from node perimeters", () => {
  const input = `\
┌───┐   ┌───┐
│ A ├──▶│ B │
└───┘   └───┘

:legend
[B]: bold
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const path = matchChildEl(matchChildEl(root, "g", { class: "tp-edge" }), "path", { class: "tpc-shape" });
  const coordinates = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const source = nodeToRectPx(ast.nodes.find((node) => node.label === "A")!);
  const target = nodeToRectPx(ast.nodes.find((node) => node.label === "B")!);

  assertAlmostEquals(coordinates[0], source.x + source.w + 2, 0.02);
  assertAlmostEquals(coordinates.at(-2)!, target.x - 2, 0.02);
});

Deno.test("svg: terminus attachment can be overridden by Legend", () => {
  const ast = parseTopos(`\
┌───┐             ┌───┐
│ A ├────────────▶│ B │
└───┘             └───┘

:legend
A -> B: gap head=m-gap
`);
  const root = matchChildEl(buildSvgTree(ast), "g", { class: "tp-root" });
  const path = matchChildEl(matchChildEl(root, "g", { class: "tp-edge" }), "path", { class: "tpc-shape" });
  const coordinates = String(attrs(path).d).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const source = nodeToRectPx(ast.nodes.find((node) => node.label === "A")!);
  const target = nodeToRectPx(ast.nodes.find((node) => node.label === "B")!);

  assertAlmostEquals(coordinates[0], source.x + source.w + CHAR_WIDTH + 2, 0.02);
  assertAlmostEquals(coordinates.at(-2)!, target.x - 2 * CHAR_WIDTH - 2, 0.02);
});

/**
 * 5. Hub Trimming
 */
Deno.test("svg: hub trimming (no lines going into center)", () => {
  const input = `\
 ●───▶ [A]
 │
 ▼
┌─────┐
│ Box │
└─────┘`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const hub = ast.nodes.find((node) => node.nodeType === "hub")!;
  const box = ast.nodes.find((node) => node.nodeType === "box")!;
  const hubBounds = nodeToRectPx(hub);
  const boxBounds = nodeToRectPx(box);

  const edgeDown = matchChildEl(root, "g", { class: "tp-edge" }, 1);
  const pathDown = matchChildEl(edgeDown, "path");
  const dDown = String(attrs(pathDown).d);
  const ptsDown = dDown.split(/[ ,ML]/).filter(Boolean);
  const yStart = parseFloat(ptsDown[1]);
  assertAlmostEquals(
    yStart,
    hubBounds.y + hubBounds.h,
    0.1,
    `Vertical hub edge should start at the hub's bottom boundary, got ${yStart}.`,
  );

  const edgeRight = matchChildEl(root, "g", { class: "tp-edge" }, 0);
  const dRight = String(attrs(matchChildEl(edgeRight, "path")).d);
  const xStart = parseFloat(dRight.split(/[ ,ML]/).filter(Boolean)[0]);
  assertAlmostEquals(
    xStart,
    hubBounds.x + hubBounds.w,
    0.1,
    `Horizontal hub edge should start at the hub's right boundary, got ${xStart}.`,
  );

  const xEnd = parseFloat(ptsDown.at(-2)!);
  const yEnd = parseFloat(ptsDown.at(-1)!);
  assertAlmostEquals(
    xEnd,
    hubBounds.x + hubBounds.w / 2,
    0.1,
    `Vertical edge should stay aligned with the hub's horizontal center, got ${xEnd}.`,
  );
  assertAlmostEquals(
    yEnd,
    boxBounds.y - 2,
    0.1,
    `Vertical edge should arrive at the box's top boundary, got ${yEnd}.`,
  );
});

/**
 * 6. Rounding Levels (Drafting Style)
 */
Deno.test("svg: edge rounding levels (tight vs loose)", () => {
  const input = `\
  [A]
   │
   └──────────▶ [B]

  [C]
   │
   │
   │
   └────────────────────────▶ [D]

  [E]
   │
   └──────────▶ [F]

  [G]
   │
   └──────────▶ [H]
:legend
[A]->[B]: tight .r-tight
[C]->[D]: loose .r-loose
[E]->[F]: rounded .r-rounded
[G]->[H]: sharp .r-sharp`;

  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });

  const eTight = findEdgeByClass(root, "r-tight")!;
  const eLoose = findEdgeByClass(root, "r-loose")!;
  const eRounded = findEdgeByClass(root, "r-rounded")!;
  const eSharp = findEdgeByClass(root, "r-sharp")!;

  const rT = getRadiusFromD(String(attrs(matchChildEl(eTight, "path")).d));
  const rL = getRadiusFromD(String(attrs(matchChildEl(eLoose, "path")).d));
  const rR = getRadiusFromD(String(attrs(matchChildEl(eRounded, "path")).d));
  const rS = getRadiusFromD(String(attrs(matchChildEl(eSharp, "path")).d));

  assertAlmostEquals(rT, 4, 0.5, `Tight radius should be ~4, got ${rT}`);
  assertAlmostEquals(rL, 24, 0.5, `Loose radius should be ~24, got ${rL}`);
  assertAlmostEquals(rR, 12, 0.5, `Rounded radius should be ~12, got ${rR}`);
  assertEquals(rS, 0, `Sharp radius should be 0, got ${rS}`);
});

/**
 * 7. Glyph-based Rounding & Overrides (6-case matrix)
 */
Deno.test("svg: edge rounding completion (6 edges matrix)", () => {
  const input = `\
  [A]
   │
   └──────────▶ [B]

  [C]
   │
   ╰──────────▶ [D]

  [E]
   │
   ╰──────────▶ [F]

  [G]
   │
   └──────────▶ [H]

  [I]
   │
   └──────────▶ [J]

  [K]
   │
   │
   │
   └──────────▶ [L]
:legend
[E]->[F]: sharp .m-exp-s
[G]->[H]: tight .m-exp-t
[I]->[J]: rounded .m-exp-r
[K]->[L]: loose .m-exp-l
[A]->[B]: .m-imp-s
[C]->[D]: .m-imp-r`;

  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });

  // 1. Implicit Sharp (└)
  const rImpS = getRadiusFromD(String(attrs(matchChildEl(findEdgeByClass(root, "m-imp-s")!, "path")).d));
  assertEquals(rImpS, 0, "Implicit sharp glyph should have 0 radius");

  // 2. Implicit Rounded (╰)
  const rImpR = getRadiusFromD(String(attrs(matchChildEl(findEdgeByClass(root, "m-imp-r")!, "path")).d));
  assertAlmostEquals(rImpR, 12, 0.5, `Implicit rounded glyph should be 12, got ${rImpR}`);

  // 3. Explicit Sharp Override (╰ + sharp)
  const rExpS = getRadiusFromD(String(attrs(matchChildEl(findEdgeByClass(root, "m-exp-s")!, "path")).d));
  assertEquals(rExpS, 0, "Explicit sharp override should be 0");

  // 4. Explicit Tight (└ + tight)
  const rExpT = getRadiusFromD(String(attrs(matchChildEl(findEdgeByClass(root, "m-exp-t")!, "path")).d));
  assertAlmostEquals(rExpT, 4, 0.5, `Explicit tight should be 4, got ${rExpT}`);

  // 5. Explicit Rounded (└ + rounded)
  const rExpR = getRadiusFromD(String(attrs(matchChildEl(findEdgeByClass(root, "m-exp-r")!, "path")).d));
  assertAlmostEquals(rExpR, 12, 0.5, `Explicit rounded should be 12, got ${rExpR}`);

  // 6. Explicit Loose (└ + loose)
  const rExpL = getRadiusFromD(String(attrs(matchChildEl(findEdgeByClass(root, "m-exp-l")!, "path")).d));
  assertAlmostEquals(rExpL, 24, 0.5, `Explicit loose should be 24, got ${rExpL}`);
});
