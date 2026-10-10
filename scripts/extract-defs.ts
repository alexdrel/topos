#!/usr/bin/env node
/**
 * Extract the runtime Enamel library from compendium.svg as one JsonML <defs> tree.
 *
 * Usage:
 *   node scripts/extract-defs.ts [compendium.svg] [compendium.gen.json]
 */

import { DOMParser } from "@xmldom/xmldom";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { domToJsonMl } from "../src/jsonml/dom.ts";
import { attrs, type XmlEl } from "../src/jsonml/jsonml.ts";
import { stringifyJsonMl } from "../src/jsonml/stringify.ts";

const rootDir = join(import.meta.dirname, "..");
const compendiumDir = join(rootDir, "src", "enamel", "compendium");
const inputPath = process.argv[2] || join(compendiumDir, "compendium.svg");
const outPath = process.argv[3] || join(compendiumDir, "compendium.gen.json");

console.log(`\nReading ${inputPath}...`);
const svgText = await readFile(inputPath, "utf8");
const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
const defsElement = document.getElementsByTagName("defs").item(0);
if (!defsElement) throw new Error(`Missing <defs> in ${inputPath}`);
const defs = domToJsonMl(defsElement);
removeGeneratedColorStyles(defs);

const output = `${stringifyJsonMl(defs)}\n`;
await writeFile(outPath, output);

console.log(`Generated ${outPath}`);
console.log(`  ${new TextEncoder().encode(output).length} bytes, ${output.split("\n").length - 1} lines\n`);

function removeGeneratedColorStyles(defs: XmlEl): void {
  for (let i = defs.length - 1; i >= 2; i--) {
    const child = defs[i];
    if (!Array.isArray(child)) continue;
    if (attrs(child as XmlEl).id === "tp-colors") defs.splice(i, 1);
  }
}
