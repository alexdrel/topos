import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { assertStringIncludes } from "../../test/assertions.ts";
import { parseTopos } from "../../topos.ts";
import { COMPENDIUM, renderToSVG } from "../svg.ts";
import { attrs, walk } from "../../jsonml/jsonml.ts";
import { EIDOS_VALUES } from "../../eidos.ts";

test("compendium: authored compendium mode preserves the complete asset registry", () => {
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

test("compendium: checked-in compendium matches the current renderer", async () => {
  const [source, expected] = await Promise.all([
    readFile(new URL("../compendium/compendium.topos", import.meta.url), "utf8"),
    readFile(new URL("../compendium/compendium.svg", import.meta.url), "utf8"),
  ]);
  assertEquals(renderToSVG(parseTopos(source)), expected, "Compendium SVG is stale. Run npm run gen:compendium.");
});

test("compendium: compendium palette is fully authored in Topos", async () => {
  const source = await readFile(new URL("../compendium/compendium.topos", import.meta.url), "utf8");
  const diagram = parseTopos(source);

  assertEquals(Object.keys(diagram.palette), [...EIDOS_VALUES.color]);
  const svg = renderToSVG(diagram);
  assertEquals(svg.match(/id="tp-palette"/g)?.length, 1);
  for (const color of EIDOS_VALUES.color) assertStringIncludes(svg, `--tp-color-${color}:`);
});
