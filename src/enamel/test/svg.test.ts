import { assertEquals, assertStringIncludes } from "@std/assert";
import { Node, parseTopos } from "../../topos.ts";

import { buildSvgTree, COMPENDIUM, renderToSVG } from "../svg.ts";
import { CHAR_HEIGHT, CHAR_WIDTH, nodeToRectPx } from "../geometry.ts";
import { STACK_DX, STACK_DY } from "../stacked-box.ts";
import { matchChildEl } from "../../jsonml/assert.ts";
import { attrs, walk } from "../../jsonml/jsonml.ts";
import { EIDOS_VALUES } from "../../eidos.ts";
import type { StringParameters } from "../../topos.ts";
import type { RenderOptions } from "../../render.ts";

function renderOptions(
  parameters: StringParameters,
  override = true,
  transparent = true,
): RenderOptions {
  return { parameters: { theme: "light", ...parameters }, override, transparent };
}

function viewBox(svgTree: ReturnType<typeof buildSvgTree>): number[] {
  return String(attrs(svgTree).viewBox).split(/\s+/).map(Number);
}

/**
 * 1. Fundamental Hierarchy & XML Compliance
 */
Deno.test("svg: hierarchy and XML standalone validity", () => {
  const input = `\
┌───────┐
│ RootA │
└───────┘`;
  const ast = parseTopos(input);

  const svgStr = renderToSVG(ast);
  assertEquals(svgStr.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), true, "Missing XML declaration");
  assertEquals(svgStr.includes('<style id="tp-base">'), true, "Missing base style");

  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  matchChildEl(diagGrp, "g", { class: "tp-node tp-box" });
});

Deno.test("svg: XML declaration can be omitted for embedding", () => {
  const svg = renderToSVG(parseTopos("(A)"), {
    parameters: { theme: "light" },
    override: false,
    transparent: true,
    xmlDeclaration: false,
  });

  assertEquals(svg.startsWith("<svg"), true);
  assertEquals(svg.includes("<?xml"), false);
});

Deno.test("svg: authored compendium mode preserves the complete asset registry", () => {
  const svg = renderToSVG(parseTopos(`\
:map compendium=true
(catalogue)`));

  walk(COMPENDIUM, (node) => {
    const id = attrs(node).id;
    if (typeof id === "string") assertStringIncludes(svg, `id="${id}"`);
  });
  assertStringIncludes(svg, 'id="tp-color-template"');
  assertStringIncludes(svg, 'id="tp-colors"');
  assertStringIncludes(svg, ".tp-color-red");
  assertStringIncludes(svg, ".tp-color-purple");
});

Deno.test("svg: normal rendering instantiates styles only for used colors", () => {
  const svg = renderToSVG(parseTopos(`\
[A]

:legend
A: red`));

  assertStringIncludes(svg, 'id="tp-palette"');
  assertStringIncludes(svg, 'id="tp-colors"');
  assertStringIncludes(svg, ".tp-color-red {");
  assertStringIncludes(svg, "var(--tp-color-red)");
  assertEquals(svg.includes('id="tp-color-template"'), false);
  assertEquals(svg.includes(".tp-color-blue"), false);
  assertEquals(svg.includes("COLOR"), false);
});

Deno.test("svg: black and white are regular palette colors", () => {
  const svg = renderToSVG(parseTopos(`\
[Black] [White]

:legend
Black: black
White: white`));

  assertStringIncludes(svg, ".tp-color-black");
  assertStringIncludes(svg, "var(--tp-color-black)");
  assertStringIncludes(svg, ".tp-color-white");
  assertStringIncludes(svg, "var(--tp-color-white)");
});

Deno.test("svg: document palette overrides built-in colors", () => {
  const svg = renderToSVG(parseTopos(`\
[Blue] [Red]

:legend
Blue: blue soft
Red: red
/blue: #0057b8
/red: #c62828`));

  assertStringIncludes(svg, 'id="tp-palette"');
  assertEquals(svg.match(/id="tp-palette"/g)?.length, 1);
  assertStringIncludes(svg, "--tp-color-blue: #0057b8");
  assertStringIncludes(svg, "--tp-color-red: #c62828");
});

Deno.test("svg: compendium palette is fully authored in Topos", async () => {
  const source = await Deno.readTextFile(new URL("../compendium/compendium.topos", import.meta.url));
  const diagram = parseTopos(source);

  assertEquals(Object.keys(diagram.palette), [...EIDOS_VALUES.color]);
  const svg = renderToSVG(diagram);
  assertEquals(svg.match(/id="tp-palette"/g)?.length, 1);
  for (const color of EIDOS_VALUES.color) assertStringIncludes(svg, `--tp-color-${color}:`);
});

Deno.test("svg: generated color styles preserve scope precedence across colors", () => {
  const svg = renderToSVG(parseTopos(`\
[AA]

:legend
AA: label=red stroke=blue,solid fill=purple,heavy`));

  assertEquals(svg.indexOf(".tp-stroke-blue") < svg.indexOf(".tp-label-red"), true);
  assertEquals(svg.indexOf(".tp-fill-purple") < svg.indexOf(".tp-fill-heavy"), true);
});

/**
 * 2. Styling: Palettes & Assets
 */
Deno.test("svg: styling (palettes, hatch, shadow)", () => {
  const input = `\
╔═══╗
║ A ║
╚═══╝

:legend
[A]: red hatch shadow
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  matchChildEl(diagGrp, "g", { class: "tp-node tp-color-red tp-hatch tp-shadow" });

  const svgStr = renderToSVG(ast);
  assertEquals(!!svgStr.match(/id="tpc-pat-hatch-\d+"/), true, "Local pattern missing");
  assertEquals(svgStr.includes('id="tpc-flt-shadow"'), true, "Filter shadow missing");
});

/**
 * 3. Node and Edge Styles (Bold, Dotted, Dashed)
 */
Deno.test("svg: node and edge styles (bold, dotted, dashed)", () => {
  const input = `\
┏━━━━━━┓ ┌╌╌╌╌╌┐ ┌┈┈┈┈┈┐
┃ BOLD ┃ ┆DSHD ┆ ┊DOTD ┊
┗━━━━━━┛ └╌╌╌╌╌┘ └┈┈┈┈┈┘

A ┄┄▶ B
C ┈┈▶ D
E ━━▶ F
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  matchChildEl(diagGrp, "g", { class: "tp-node tp-box tp-bold" });
  matchChildEl(diagGrp, "g", { class: "tp-node tp-box tp-dashed" });
  matchChildEl(diagGrp, "g", { class: "tp-node tp-box tp-dotted" });

  matchChildEl(diagGrp, "g", { class: "tp-edge tp-dashed" });
  matchChildEl(diagGrp, "g", { class: "tp-edge tp-dotted" });
  matchChildEl(diagGrp, "g", { class: "tp-edge tp-bold" });
});

/**
 * 4. Geometry & Conversion logic
 */
Deno.test("svg: nodeToRectPx stack offset conversion", () => {
  const node = {
    x: 10,
    y: 10,
    w: 10,
    h: 10,
    nodeType: "box",
    stack: { dx: 1, dy: -2, layers: 3 },
    children: [],
    edges: [],
    links: [],
  } as Node;
  const facePx = nodeToRectPx(node, 2);
  const layer0Px = nodeToRectPx(node, 0);

  assertEquals(layer0Px.x, facePx.x + (2 - 0) * 1 * STACK_DX);
  assertEquals(layer0Px.y, facePx.y + (2 - 0) * -2 * STACK_DY);
});

/**
 * 5. Legend control over hub nodes and arrow families
 */
Deno.test("svg: legend control over hub nodes and arrow families", () => {
  const input = `\
A ───●──▶ B

:legend
<*>: circle-dot
<*> -> B: head=triangle tail=triangle-hollow
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });

  // 1. Hub node shape should use symbol hub-circle-dot
  const hubNodeGrp = matchChildEl(root, "g", { class: "tp-node tp-hub" });
  matchChildEl(hubNodeGrp, "use", { href: "#tpc-hub-circle-dot" });

  // 2. Edge should resolve marker arrowhead-triangle and arrowhead-triangle-hollow
  const svgStr = renderToSVG(ast);
  assertEquals(svgStr.includes("url(#tpc-arr-triangle)"), true, "Missing arrowhead-triangle reference");
  assertEquals(svgStr.includes("url(#tpc-arr-triangle-hollow)"), true, "Missing arrowhead-triangle-hollow reference");
});

Deno.test("svg: resolves double-arrow and hexagon markers", () => {
  const input = `
A ──▶ B

C ──▶ D

:legend
A -> B: head=double-arrow
C -> D: head=hexagon
`;
  const ast = parseTopos(input);
  const svgStr = renderToSVG(ast);
  assertEquals(svgStr.includes("url(#tpc-arr-double-arrow)"), true, "Missing double-arrow marker");
  assertEquals(svgStr.includes("url(#tpc-arr-hexagon)"), true, "Missing hexagon marker");
});

Deno.test("svg: port nodes (hubs on border) are positioned on parent box boundary", () => {
  const input = `
┌───┐
◎ A │
└───┘
`;
  const ast = parseTopos(input);
  const parentBox = ast.nodes.find(n => n.nodeType === "box")!;
  const hubNode = ast.nodes.find(n => n.nodeType === "hub")!;

  const parentPx = nodeToRectPx(parentBox);
  const hubPx = nodeToRectPx(hubNode);

  const hubCenter = hubPx.x + hubPx.w / 2;
  assertEquals(hubCenter, parentPx.x);
});

Deno.test("svg: legend header canvas custom paper, ink, and viewport parameters", () => {
  const input = `
A ──▶ B

:legend bg=#fdf6e3 ink=#073642 w=50 h=30
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast, renderOptions({}, false, false));

  const attrs = svgTree[1] as Record<string, string>;
  assertEquals(attrs.style?.includes("background: #fdf6e3"), true, "Missing background override");
  assertEquals(attrs.style?.includes("--tp-paper: #fdf6e3"), true, "Missing paper variable override from bg");
  assertEquals(attrs.style?.includes("--tp-ink: #073642"), true, "Missing ink/color variable override");

  const expectedW = 50 * CHAR_WIDTH;
  const expectedH = 30 * CHAR_HEIGHT;
  assertEquals(Number(attrs.width), expectedW);
  assertEquals(Number(attrs.height), expectedH);
});

Deno.test("svg: explicit padding frames content instead of authored whitespace", () => {
  const ast = parseTopos(`\
    [A]

:legend padx=2 pady=1
`);
  const svgTree = buildSvgTree(ast);
  const node = ast.nodes[0];

  assertEquals(viewBox(svgTree), [
    (node.x - 2) * CHAR_WIDTH,
    (node.y - 1) * CHAR_HEIGHT,
    (node.w + 4) * CHAR_WIDTH,
    (node.h + 2) * CHAR_HEIGHT,
  ]);
});

Deno.test("svg: fixed viewport replaces the right and bottom limits", () => {
  const ast = parseTopos("    [A]");
  const node = ast.nodes[0];
  const root = ast.root;

  const fixed = buildSvgTree(ast, renderOptions({ w: "20", h: "9" }));
  assertEquals(viewBox(fixed), [
    root.x * CHAR_WIDTH - 24,
    root.y * CHAR_HEIGHT - 24,
    20 * CHAR_WIDTH,
    9 * CHAR_HEIGHT,
  ]);

  const cropped = buildSvgTree(ast, renderOptions({ w: "2", h: "1" }));
  assertEquals(viewBox(cropped), [
    root.x * CHAR_WIDTH - 24,
    root.y * CHAR_HEIGHT - 24,
    2 * CHAR_WIDTH,
    CHAR_HEIGHT,
  ]);

  const anchored = buildSvgTree(ast, renderOptions({ w: "20", h: "9", padx: "3", pady: "2" }));
  assertEquals(viewBox(anchored), [
    (node.x - 3) * CHAR_WIDTH,
    (node.y - 2) * CHAR_HEIGHT,
    20 * CHAR_WIDTH,
    9 * CHAR_HEIGHT,
  ]);

  const mixed = buildSvgTree(ast, renderOptions({ w: "20", pady: "2" }));
  assertEquals(viewBox(mixed), [
    root.x * CHAR_WIDTH - 24,
    (node.y - 2) * CHAR_HEIGHT,
    20 * CHAR_WIDTH,
    (node.h + 4) * CHAR_HEIGHT,
  ]);
});

Deno.test("svg: scale and width control intrinsic size without changing the viewBox", () => {
  const ast = parseTopos("[A]");
  const normal = buildSvgTree(ast);
  const scaled = buildSvgTree(parseTopos("[A]\n:legend scale=2"));
  const fixed = buildSvgTree(ast, renderOptions({ scale: "10", width: "600" }));
  const normalAttrs = attrs(normal);
  const scaledAttrs = attrs(scaled);
  const fixedAttrs = attrs(fixed);

  assertEquals(scaledAttrs.viewBox, normalAttrs.viewBox);
  assertEquals(Number(scaledAttrs.width), Number(normalAttrs.width) * 2);
  assertEquals(Number(scaledAttrs.height), Number(normalAttrs.height) * 2);

  assertEquals(fixedAttrs.viewBox, normalAttrs.viewBox);
  assertEquals(Number(fixedAttrs.width), 600);
  assertEquals(Number(fixedAttrs.height), 600 * Number(normalAttrs.height) / Number(normalAttrs.width));
});

Deno.test("svg: title reuses available top rows and expands upward only when needed", () => {
  const crowded = buildSvgTree(parseTopos(`\
:map "Title"
[A]
`));
  assertEquals(viewBox(crowded)[1], -3 * CHAR_HEIGHT);

  const partlySpaced = buildSvgTree(parseTopos(`\
:map "Title"

[A]
`));
  assertEquals(viewBox(partlySpaced)[1], -2 * CHAR_HEIGHT);

  const spacedAst = parseTopos(`\
:map "Title"


[A]
`);
  const spaced = buildSvgTree(spacedAst);
  assertEquals(viewBox(spaced)[1], -CHAR_HEIGHT);
  assertEquals(Number(attrs(spaced).height), (spacedAst.root.h + 2) * CHAR_HEIGHT);

  const tight = buildSvgTree(parseTopos(`\
:map "Title"
[A]
:legend pady=0
`));
  assertEquals(viewBox(tight)[1], -2 * CHAR_HEIGHT);
  assertEquals(viewBox(tight)[3], 3 * CHAR_HEIGHT);
});

Deno.test("svg: legend header paper parameter", () => {
  const input = `
A ──▶ B

:legend paper=#ff00ff ink=#00ff00
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);

  const attrs = svgTree[1] as Record<string, string>;
  assertStringIncludes(attrs.style, "--tp-paper: #ff00ff", "Missing paper override");
  assertStringIncludes(attrs.style, "background: #ff00ff", "Standalone render paints resolved paper");
  assertStringIncludes(attrs.style, "--tp-ink: #00ff00", "Missing ink override");
});

Deno.test("svg: legend header theme parameter", () => {
  // Test theme=light
  const inputLight = `
A ──▶ B

:legend theme=light
`;
  const astLight = parseTopos(inputLight);
  const attrsLight = buildSvgTree(astLight)[1] as Record<string, string>;
  assertStringIncludes(attrsLight.style, "--tp-paper: #fdfaf6", "Missing canonical light paper");
  assertStringIncludes(attrsLight.style, "--tp-ink: #111111", "Missing canonical light ink");
  assertStringIncludes(attrsLight.style, "background: #fdfaf6", "Standalone render is opaque");

  // Test theme=dark
  const inputDark = `
A ──▶ B

:legend theme=dark
`;
  const astDark = parseTopos(inputDark);
  const attrsDark = buildSvgTree(astDark)[1] as Record<string, string>;
  assertStringIncludes(attrsDark.style, "--tp-paper: #1a1a1a", "Missing canonical dark paper");
  assertStringIncludes(attrsDark.style, "--tp-ink: #ffffff", "Missing canonical dark ink");
  assertStringIncludes(attrsDark.style, "background: #1a1a1a", "Standalone render is opaque");
});

Deno.test("svg: options overrides", () => {
  const input = `
A ──▶ B
`;
  // Test size override
  const astSize = parseTopos(input);
  const svgTreeSize = buildSvgTree(astSize, renderOptions({ w: "10", h: "20" }));
  const attrsSize = svgTreeSize[1] as Record<string, string>;
  const expectedW = 10 * CHAR_WIDTH;
  const expectedH = 20 * CHAR_HEIGHT;
  assertEquals(Number(attrsSize.width), expectedW);
  assertEquals(Number(attrsSize.height), expectedH);

  // Test color overrides
  const astColors = parseTopos(input);
  const svgTreeColors = buildSvgTree(
    astColors,
    renderOptions({ bg: "red", ink: "blue", paper: "green" }, true, false),
  );
  const attrsColors = svgTreeColors[1] as Record<string, string>;
  assertStringIncludes(attrsColors.style, "background: red", "Missing bg override");
  assertStringIncludes(attrsColors.style, "--tp-ink: blue", "Missing ink override");
  assertStringIncludes(attrsColors.style, "--tp-paper: green", "Missing paper override");
});

Deno.test("svg: explicit overrides beat authored parameters", () => {
  const ast = parseTopos(`\
:map "Authored title"
(A)
:legend theme=dark font="IBM Plex Sans"`);
  const tree = buildSvgTree(ast, renderOptions({ theme: "light", title: "Export title" }));
  const attrs = tree[1] as Record<string, string>;
  assertStringIncludes(attrs.style, "--tp-paper: #fdfaf6");
  assertStringIncludes(attrs.style, "--tp-diagram-font: IBM Plex Sans");
  assertStringIncludes(renderToSVG(ast, renderOptions({ title: "Export title" })), "Export title");
});

Deno.test("svg: ambient surface is below authored parameters and explicit overrides", () => {
  const ast = parseTopos(`\
(A)
:legend theme=dark ink=yellow`);
  const host = { bg: "transparent", paper: "#002b36", ink: "#839496" };

  const authored = buildSvgTree(ast, renderOptions(host, false))[1] as Record<string, string>;
  assertStringIncludes(authored.style, "--tp-paper: #1a1a1a");
  assertStringIncludes(authored.style, "--tp-ink: yellow");
  assertEquals(authored.style?.includes("background:"), false);

  const forced = buildSvgTree(ast, renderOptions({ theme: "light" }))[1] as Record<string, string>;
  assertStringIncludes(forced.style, "--tp-paper: #fdfaf6");
  assertStringIncludes(forced.style, "--tp-ink: #111111");
});

Deno.test("svg: partial authored parameters extend the ambient host surface", () => {
  const ast = parseTopos(`\
(A)
:legend ink=yellow`);
  const attrs = buildSvgTree(
    ast,
    renderOptions({ bg: "transparent", paper: "#002b36", ink: "#839496" }, false),
  )[1] as Record<string, string>;

  assertStringIncludes(attrs.style, "--tp-paper: #002b36");
  assertStringIncludes(attrs.style, "--tp-ink: yellow");
  assertEquals(attrs.style?.includes("background:"), false);
});

Deno.test("svg: root legend properties do not configure the renderer", () => {
  const ast = parseTopos(`\
(A)
:legend
/: theme=dark bg=red`);
  const attrs = buildSvgTree(ast)[1] as Record<string, string>;
  assertStringIncludes(attrs.style, "--tp-paper: #fdfaf6");
  assertEquals(attrs.style?.includes("background: red"), false);
});
