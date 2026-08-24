import { assertEquals } from "@std/assert";
import { attrs, children, serializeXml, tag, textContent } from "./jsonml.ts";
import { svgEl, svgRoot } from "./svg.ts";

Deno.test("svgEl provides typed SVG construction", () => {
  const group = svgEl(
    "g",
    { id: "shapes" },
    svgEl("rect", { x: 10, y: 20, width: 80, height: 40, rx: 4 }),
    svgEl("circle", { cx: 50, cy: 50, r: 20 }),
  );
  assertEquals(tag(group), "g");
  assertEquals(children(group).length, 2);
  assertEquals(attrs(children(group)[0]).width, 80);
});

Deno.test("svgEl supports text and marker attributes", () => {
  const text = svgEl("text", { x: 50, y: 25, "text-anchor": "middle" }, "Hello");
  const line = svgEl("line", { x1: 0, y1: 0, x2: 100, y2: 0, "marker-end": "url(#arrow)" });
  assertEquals(textContent(text), "Hello");
  assertEquals(attrs(line)["marker-end"], "url(#arrow)");
});

Deno.test("svgRoot supplies the SVG namespace", () => {
  const root = svgRoot(200, 100);
  assertEquals(attrs(root).xmlns, "http://www.w3.org/2000/svg");
  assertEquals(serializeXml(root).includes('xmlns="http://www.w3.org/2000/svg"'), true);
});
