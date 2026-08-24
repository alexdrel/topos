import { assertEquals, assertStringIncludes } from "@std/assert";
import { parseTopos } from "../../topos.ts";
import { buildSvgTree, renderToSVG } from "../svg.ts";
import { tag, attrs, XmlEl } from "../../jsonml/jsonml.ts";
import { matchChildEl } from "../../jsonml/assert.ts";

Deno.test("svg: markdown bold and italic formatting in node labels", () => {
  const input = `\\
┌─────────────────────────┐
│ A **bold** and *italic* │
└─────────────────────────┘
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-node" }, 1);
  const textEl = matchChildEl(nodeGrp, "text", { class: "tpc-label" });

  const ch = textEl.slice(2);
  assertEquals(ch.length, 4);

  assertEquals(ch[0], "A ");

  const boldTspan = ch[1] as XmlEl;
  assertEquals(tag(boldTspan), "tspan");
  assertEquals(attrs(boldTspan)["font-weight"], "bold");
  assertEquals(boldTspan.slice(2)[0], "bold");

  assertEquals(ch[2], " and ");

  const italicTspan = ch[3] as XmlEl;
  assertEquals(tag(italicTspan), "tspan");
  assertEquals(attrs(italicTspan)["font-style"], "italic");
  assertEquals(italicTspan.slice(2)[0], "italic");
});

Deno.test("svg: markdown formatting overridden in legend rules", () => {
  const input = `\\
┌────────────────────────────┐
│    A                       │
└────────────────────────────┘

:legend
A : "New **important** name"
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-node" }, 1);
  const textEl = matchChildEl(nodeGrp, "text", { class: "tpc-label" });

  const ch = textEl.slice(2);
  assertEquals(ch.length, 3);
  assertEquals(ch[0], "New ");

  const boldTspan = ch[1] as XmlEl;
  assertEquals(tag(boldTspan), "tspan");
  assertEquals(attrs(boldTspan)["font-weight"], "bold");
  assertEquals(boldTspan.slice(2)[0], "important");

  assertEquals(ch[2], " name");
});

Deno.test("svg: markdown links render as discoverable SVG anchors", () => {
  const input = `\\
Read [the docs](#docs)

:legend
#docs: href="https://example.com/docs"
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-note" });
  const textEl = matchChildEl(nodeGrp, "text", { class: "tpc-label" });
  const link = matchChildEl(textEl, "a", { class: "tpc-link" });

  assertEquals(attrs(link).href, "https://example.com/docs");
  assertEquals(matchChildEl(link, "tspan", { class: "tpc-link-text" }).slice(2), ["the docs"]);
});

Deno.test("svg: unresolved Markdown link references render as ordinary text", () => {
  const svgTree = buildSvgTree(parseTopos("Read [the docs](#missing)"));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-note" });
  const textEl = matchChildEl(nodeGrp, "text", { class: "tpc-label" });

  assertEquals(textEl.slice(2), ["Read ", "the docs"]);
});

Deno.test("svg: entity href links the whole label without overriding inline links", () => {
  const svgTree = buildSvgTree(parseTopos(`\
Whole label with [specific destination](https://example.com/specific)

:legend
%Whole label%: href="https://example.com/default"
`));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-note" });
  const textEl = matchChildEl(nodeGrp, "text", { class: "tpc-label" });
  const children = textEl.slice(2) as XmlEl[];

  assertEquals(children.map((child) => attrs(child).href), [
    "https://example.com/default",
    "https://example.com/specific",
  ]);
});

Deno.test("svg: exact legend rule links a box label but not its geometry", () => {
  const svgTree = buildSvgTree(parseTopos(`\
┌──────────┐
│          │
│   docs   │
│          │
└──────────┘

:legend
docs: href="https://example.com"
`));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-box" });
  const textEl = matchChildEl(nodeGrp, "text", { class: "tpc-label" });
  const link = matchChildEl(textEl, "a", { class: "tpc-link" });

  assertEquals(attrs(link).href, "https://example.com");
  assertEquals(matchChildEl(link, "tspan", { class: "tpc-link-text" }).slice(2), ["docs"]);
  assertEquals(attrs(matchChildEl(nodeGrp, "rect", { class: "tpc-shape" })).href, undefined);
});

Deno.test("svg: paragraph formatting renders tspan with dx=7", () => {
  const input = `\\
( Paragraph 1 ¶ Paragraph 2 )
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-node" }, 1);
  const textEl = matchChildEl(nodeGrp, "text", { class: "tpc-label" });

  // Multiple lines in note
  const ch = textEl.slice(2);
  assertEquals(ch.length, 2);

  // Line 1: Paragraph 1
  const line1 = ch[0] as XmlEl;
  assertEquals(tag(line1), "tspan");
  assertEquals(line1.slice(2)[0], "Paragraph 1");

  // Line 2: Paragraph 2
  const line2 = ch[1] as XmlEl;
  assertEquals(tag(line2), "tspan");

  const segments = line2.slice(2);
  assertEquals(segments.length, 1);

  const firstSeg = segments[0] as XmlEl;
  assertEquals(tag(firstSeg), "tspan");
  assertEquals(attrs(firstSeg).dx, 10);
  assertEquals(firstSeg.slice(2)[0], "Paragraph 2");
});

Deno.test("svg: leading paragraph formatting renders first line with dx", () => {
  const input = `\\
( ¶ Paragraph 1 ¶ Paragraph 2 )
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-node" }, 1);
  const textEl = matchChildEl(nodeGrp, "text", { class: "tpc-label" });

  const ch = textEl.slice(2);
  assertEquals(ch.length, 2);

  // Line 1: Paragraph 1 should also have dx=7
  const line1 = ch[0] as XmlEl;
  assertEquals(tag(line1), "tspan");
  const line1Segs = line1.slice(2);
  assertEquals(line1Segs.length, 1);
  const firstSeg1 = line1Segs[0] as XmlEl;
  assertEquals(tag(firstSeg1), "tspan");
  assertEquals(attrs(firstSeg1).dx, 10);
  assertEquals(firstSeg1.slice(2)[0], "Paragraph 1");

  // Line 2: Paragraph 2 should also have dx=7
  const line2 = ch[1] as XmlEl;
  assertEquals(tag(line2), "tspan");
  const line2Segs = line2.slice(2);
  assertEquals(line2Segs.length, 1);
  const firstSeg2 = line2Segs[0] as XmlEl;
  assertEquals(tag(firstSeg2), "tspan");
  assertEquals(attrs(firstSeg2).dx, 10);
  assertEquals(firstSeg2.slice(2)[0], "Paragraph 2");
});

Deno.test("svg: bold/italic state persists across ⏎/¶ line breaks", () => {
  const input = `\\
┌──────────────────────────────────────────────┐
│ A **bold ⏎ text** and *italic ¶ paragraph*   │
└──────────────────────────────────────────────┘
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-node" }, 1);
  const noteGrp = matchChildEl(nodeGrp, "g", { class: "tp-note" });
  const textEl = matchChildEl(noteGrp, "text", { class: "tpc-label" });

  // ── Assumption under test: one <tspan x dy> per line, wrapping that
  // line's formatted children — mirrors the single-line test's flat
  // shape, just one level deeper. Adjust the traversal below if your
  // renderer wraps lines differently.
  const lineTspans = textEl.slice(2);
  assertEquals(lineTspans.length, 3);

  // Line 0: "A " + bold-open "bold" (delimiter not yet closed on this line)
  const line0 = (lineTspans[0] as XmlEl).slice(2);
  assertEquals(line0.length, 2);
  assertEquals(line0[0], "A ");
  const bold0 = line0[1] as XmlEl;
  assertEquals(tag(bold0), "tspan");
  assertEquals(attrs(bold0)["font-weight"], "bold");
  assertEquals(bold0.slice(2)[0], "bold");

  // Line 1: "text" (still bold, closes here) + " and " + italic-open "italic"
  const line1 = (lineTspans[1] as XmlEl).slice(2);
  assertEquals(line1.length, 3);
  const bold1 = line1[0] as XmlEl;
  assertEquals(tag(bold1), "tspan");
  assertEquals(attrs(bold1)["font-weight"], "bold");
  assertEquals(bold1.slice(2)[0], "text");

  assertEquals(line1[1], " and ");

  const italic1 = line1[2] as XmlEl;
  assertEquals(tag(italic1), "tspan");
  assertEquals(attrs(italic1)["font-style"], "italic");
  assertEquals(italic1.slice(2)[0], "italic");

  // Line 2: "paragraph" — still italic (closes here), plus paragraph indent
  const line2 = (lineTspans[2] as XmlEl).slice(2);
  assertEquals(line2.length, 1);
  const italic2 = line2[0] as XmlEl;
  assertEquals(tag(italic2), "tspan");
  assertEquals(attrs(italic2)["font-style"], "italic");
  assertEquals(attrs(italic2)["dx"], 10); // paragraph flag from ¶
  assertEquals(italic2.slice(2)[0], "paragraph");
});

Deno.test("svg: per-note font override", () => {
  const input = `\
Note

:legend
Note : font="Courier New"
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const noteGrp = matchChildEl(diagGrp, "g", { class: "tp-note" });
  assertEquals(attrs(noteGrp).style, "--tp-font: Courier New");
});

Deno.test("svg: per-entity font weight override", () => {
  const input = `\
┌───┐       ┌───┐
│ A ├─call──▶ B │
└───┘       └───┘

:legend
A : font-weight=600
[A] -> [B] : font-weight=400
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-box" }, 0);
  const edgeGrp = matchChildEl(diagGrp, "g", { class: "tp-edge" });

  assertEquals(attrs(nodeGrp).style, "--tp-font-weight: 600");
  assertEquals(attrs(edgeGrp).style, "--tp-font-weight: 400");
  assertStringIncludes(renderToSVG(parseTopos(input)), "font-weight: var(--tp-font-weight, var(--tp-diagram-font-weight, 500))");
});

Deno.test("svg: code notes inherit the monospace Eidos class", () => {
  const input = `\
| A  | B |

:legend
%A% : code font="Fira Code"
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const noteGrp = matchChildEl(diagGrp, "g", { class: "tp-note tp-code" });
  const textEl = matchChildEl(noteGrp, "text", { class: "tpc-label" });

  assertEquals(attrs(noteGrp).style, "--tp-font: Fira Code");
  assertEquals(textEl.slice(2)[0], "| A  | B |");
  const svg = renderToSVG(ast);
  assertStringIncludes(svg, ".tp-code .tpc-label { font-family: var(--tp-font, ui-monospace, monospace); }");
  assertStringIncludes(svg, "| A  | B |");
});

Deno.test("svg: literal notes keep their authored text without a monospace class", () => {
  const input = `\
Text  keeps  spaces

:legend
%Text% : text
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const noteGrp = matchChildEl(diagGrp, "g", { class: "tp-note" });
  const textEl = matchChildEl(noteGrp, "text", { class: "tpc-label" });

  assertEquals(attrs(textEl).class, "tp tpc-label");
  assertEquals(textEl.slice(2)[0], "Text  keeps  spaces");
  assertStringIncludes(renderToSVG(ast), "Text  keeps  spaces");
});

Deno.test("svg: per-node-label font override", () => {
  const input = `\
┌─────────────────────────┐
│ Box                     │
└─────────────────────────┘

:legend
Box : font="Fira Code"
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const nodeGrp = matchChildEl(diagGrp, "g", { class: "tp-box" });
  assertEquals(attrs(nodeGrp).style, "--tp-font: Fira Code");
});

Deno.test("svg: edge label font override", () => {
  const input = `\
┌───┐       ┌───┐
│ A ├─call──▶ B │
└───┘       └───┘

:legend
[A] -> [B] : font="'Fira Code', 'Roboto'"
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(diagGrp, "g", { class: "tp-edge" });
  assertEquals(attrs(edge).style, "--tp-font: 'Fira Code', 'Roboto'");
});

Deno.test("svg: node font inheritance in nested layout", () => {
  const input = `\
┌─────────────────────────┐
│ Parent                  │
│  ┌───────────────────┐  │
│  │ Child             │  │
│  └───────────────────┘  │
└─────────────────────────┘

:legend
Parent : font=Impact
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  const parentNodeGrp = matchChildEl(diagGrp, "g", { class: "tp-box" });
  const childNodeGrp = matchChildEl(parentNodeGrp, "g", { class: "tp-box" });

  const childTextEl = matchChildEl(childNodeGrp, "text", { class: "tpc-label" });
  assertEquals(attrs(parentNodeGrp).style, "--tp-font: Impact");
  assertEquals(attrs(childNodeGrp).style, undefined);
  assertEquals(attrs(childTextEl).style, undefined);
});

Deno.test("svg: legend text defaults use diagram font variables", () => {
  const input = `\
Note

:legend font="Fira Code" font-weight=400
[/] : sketch
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const style = attrs(svgTree).style;

  // Root SVG has the diagram-wide fallback font mapping
  assertStringIncludes(String(style ?? ""), "--tp-diagram-font: Fira Code");
  assertStringIncludes(String(style ?? ""), "--tp-diagram-font-weight: 400");

  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  // The root diagram node itself should not have --tp-font, so cursive takes over for sketch
  assertEquals(attrs(diagGrp).style, undefined);
});
