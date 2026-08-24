import { assertEquals } from "@std/assert";
import { DOMParser } from "@xmldom/xmldom";
import { domToJsonMl } from "./dom.ts";
import { serialize, textContent } from "./jsonml.ts";

function parseElement(xml: string): Node {
  return new DOMParser().parseFromString(xml, "application/xml").documentElement;
}

Deno.test("domToJsonMl converts only the supplied subtree", () => {
  const document = new DOMParser().parseFromString("<root><before/><defs id=\"library\"><item>text</item></defs><after/></root>", "application/xml");
  const defs = document.getElementsByTagName("defs").item(0);
  if (!defs) throw new Error("Missing test defs");

  assertEquals(domToJsonMl(defs), ["defs", { id: "library" }, ["item", {}, "text"]]);
});

Deno.test("domToJsonMl preserves comment and CDATA payloads", () => {
  const commentText = "\n  first line\n  second line\n";
  const cdataText = "\n  a > b {\n    color: red;\n  }\n";
  const source = `<root><!--${commentText}--><![CDATA[${cdataText}]]></root>`;
  const jsonml = domToJsonMl(parseElement(source));

  assertEquals(textContent(jsonml[2] as typeof jsonml), commentText);
  assertEquals(textContent(jsonml[3] as typeof jsonml), cdataText);

  const reparsed = parseElement(serialize(jsonml));
  const payloads = Array.from({ length: reparsed.childNodes.length }, (_, i) => reparsed.childNodes.item(i))
    .filter((node) => node?.nodeType === 8 || node?.nodeType === 4)
    .map((node) => node?.nodeValue);
  assertEquals(payloads, [commentText, cdataText]);
});

Deno.test("domToJsonMl ignores indentation and retains blank separators", () => {
  const jsonml = domToJsonMl(parseElement("<root>\n  <one/>\n\n  <two/>\n</root>"));
  assertEquals(jsonml, ["root", {}, ["one", {}], "\n", ["two", {}]]);
});
