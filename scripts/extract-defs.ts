#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Extract the runtime Enamel library from compendium.svg as one JsonML <defs> tree.
 *
 * Usage:
 *   deno run -A scripts/extract-filters.ts [compendium.svg] [compendium.gen.json]
 */

import { DOMParser } from "@xmldom/xmldom";
import { dirname, fromFileUrl, join } from "@std/path";
import { domToJsonMl } from "../src/jsonml/dom.ts";
import { attrs, type XmlEl } from "../src/jsonml/jsonml.ts";
import { stringifyJsonMl } from "../src/jsonml/stringify.ts";

const scriptDir = dirname(fromFileUrl(import.meta.url));
const rootDir = join(scriptDir, "..");
const compendiumDir = join(rootDir, "src", "enamel", "compendium");
const inputPath = Deno.args[0] || join(compendiumDir, "compendium.svg");
const outPath = Deno.args[1] || join(compendiumDir, "compendium.gen.json");

console.log(`\nReading ${inputPath}...`);
const svgText = await Deno.readTextFile(inputPath);
const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
const defsElement = document.getElementsByTagName("defs").item(0);
if (!defsElement) throw new Error(`Missing <defs> in ${inputPath}`);
const defs = domToJsonMl(defsElement);
removeGeneratedColorStyles(defs);

const output = `${stringifyJsonMl(defs)}\n`;
await Deno.writeTextFile(outPath, output);

console.log(`Generated ${outPath}`);
console.log(`  ${new TextEncoder().encode(output).length} bytes, ${output.split("\n").length - 1} lines\n`);

function removeGeneratedColorStyles(defs: XmlEl): void {
  for (let i = defs.length - 1; i >= 2; i--) {
    const child = defs[i];
    if (!Array.isArray(child)) continue;
    if (attrs(child as XmlEl).id === "tp-colors") defs.splice(i, 1);
  }
}
