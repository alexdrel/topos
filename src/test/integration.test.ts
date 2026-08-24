// deno-fmt-ignore-file

import { assertEquals } from "@std/assert";
import { parseTopos, splitToposFile } from "../topos.ts";

import { renderToSVG } from "../enamel/svg.ts";
import { renderToText } from "../ink/ast-ink.ts";
import { projectTracesToGrid } from "../ink/ink.ts";
import { MapNode } from "../refine/types.ts";
import { parseDiagram } from "../refine/refine.ts";

const SHOWCASE = await Deno.readTextFile(new URL("../../examples/museum/showcase.topos", import.meta.url));

function collectNodes(root: MapNode): MapNode[] {
  const all: MapNode[] = [];
  const walk = (n: MapNode) => { all.push(n); n.children?.forEach(walk); };
  walk(root);
  return all;
}

Deno.test("Showcase: box inventory", () => {
  const { map } = splitToposFile(SHOWCASE);
  const { root } = parseDiagram(map.content.join("\n"));
  const all = collectNodes(root);
  const boxes = all.filter(n => n.nodeType === "box");
  const _notes = all.filter(n => n.nodeType === "note");
  const _hubs = all.filter(n => n.nodeType === "hub");
  const _inlines = all.filter(n => n.nodeType === "inline");


  // Verify key boxes exist with exact labels (┯ grammar fix cleans labels)
  const boxLabels = new Set(boxes.map(n => n.label).filter(Boolean));
  for (const expected of [
    "TextGrid", "Grammar",                                  // top-level
    "Trace", "perimeterAnt", "arrowMouse", "textTurtle",    // phase 1
    "Refine", "buildNodeTree", "resolveEdges",              // phase 2
    "Ink", "Clean", "Sketch", "JSONML",                     // phase 3
    "SVG", "MonoSketch"                                     // output
  ]) {
    assertEquals(boxLabels.has(expected), true, `Missing box label "${expected}"`);
  }
});

Deno.test("Showcase: border styles detected", () => {
  const { map } = splitToposFile(SHOWCASE);
  const { root } = parseDiagram(map.content.join("\n"));
  const boxes = collectNodes(root).filter(n => n.nodeType === "box");
  const byStyle = new Map<string, string[]>();
  for (const b of boxes) {
    const s = JSON.stringify(b.style);
    const list = byStyle.get(s) ?? [];
    list.push(b.label ?? "(unlabeled)");
    byStyle.set(s, list);
  }
  // All 3 phase containers (Trace/Refine/Ink) should have same style
  const trace = boxes.find(b => b.label?.includes("Trace"));
  const refine = boxes.find(b => b.label?.includes("Refine"));
  const ink = boxes.find(b => b.label?.includes("Ink"));
  if (trace && refine && ink) {
    assertEquals(trace.style, refine.style, "Trace & Refine should match");
    assertEquals(trace.style, ink.style, "Trace & Ink should match");
  }
});

Deno.test("Showcase: renders clean SVG (full file)", () => {
  const annotated = parseTopos(SHOWCASE);
  const svg = renderToSVG(annotated);
  assertEquals(svg.startsWith("<?xml"), true);
  Deno.writeTextFileSync("tmp/showcase-clean.svg", svg);
});

Deno.test("Showcase: ink round-trip", () => {
  const { map } = splitToposFile(SHOWCASE);
  const mapSource = map.content.join("\n");
  const diagram = parseDiagram(mapSource);

  assertEquals(renderToText(diagram).trimEnd(), projectTracesToGrid(diagram).text.trimEnd());
});
