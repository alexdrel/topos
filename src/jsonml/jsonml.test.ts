import { assertEquals } from "@std/assert";
import { DOMParser } from "@xmldom/xmldom";
import * as j from "./jsonml.ts";

Deno.test("JsonML construction and accessors", () => {
  const catalog = j.xmlEl("catalog", { id: "books" }, j.xmlEl("book", { id: "one" }, "One"));
  assertEquals(j.tag(catalog), "catalog");
  assertEquals(j.attrs(catalog), { id: "books" });
  assertEquals(j.tag(j.children(catalog)[0]), "book");
  assertEquals(j.textContent(catalog), "One");
});

Deno.test("serialize: empty and text elements", () => {
  assertEquals(j.serialize(j.xmlEl("item", { id: 1 })), '<item id="1"/>');
  assertEquals(j.serialize(j.xmlEl("item", {}, "One")), "<item>One</item>");
});

Deno.test("serialize: boolean attributes remain valid XML", () => {
  assertEquals(j.serialize(j.xmlEl("item", { enabled: true, hidden: false, missing: undefined })), '<item enabled="true"/>');
});

Deno.test("serialize: nested elements are indented", () => {
  const list = j.xmlEl("list", {}, j.xmlEl("item", {}, "One"), j.xmlEl("item", {}, "Two"));
  assertEquals(j.serialize(list), "<list>\n  <item>One</item>\n  <item>Two</item>\n</list>");
});

Deno.test("serialize: whitespace children create visual separation", () => {
  const list = j.xmlEl("list", {}, j.xmlEl("item", {}, "One"), "\n", j.xmlEl("item", {}, "Two"));
  assertEquals(j.serialize(list), "<list>\n  <item>One</item>\n\n  <item>Two</item>\n</list>");
});

Deno.test("serialize: mixed character and element content stays inline", () => {
  const paragraph = j.xmlEl("p", {}, "Hello ", j.xmlEl("em", {}, "world"), ".");
  assertEquals(j.serialize(paragraph), "<p>Hello <em>world</em>.</p>");
});

Deno.test("serialize: comments", () => {
  assertEquals(j.serialize(j.xmlComment(" section ")), "<!-- section -->");
});

Deno.test("serialize: comments may be split into diff-friendly lines", () => {
  const comment = j.xmlEl("$comment", {}, "first line\n", "second line");
  assertEquals(j.serialize(comment), "<!--first line\nsecond line-->");
});

Deno.test("serialize: CDATA", () => {
  const style = j.xmlEl("style", {}, j.xmlCdata("a > b { color: red; }"));
  assertEquals(j.serialize(style), "<style>\n  <![CDATA[a > b { color: red; }]]>\n</style>");
});

Deno.test("serialize: CDATA may be split into diff-friendly lines", () => {
  const style = j.xmlEl("style", {}, ["$cdata", {}, "a {\n", "  color: red;\n", "}"]);
  assertEquals(j.serialize(style), "<style>\n  <![CDATA[a {\n  color: red;\n}]]>\n</style>");
});

Deno.test("serialize: comment and CDATA payloads round-trip exactly", () => {
  const commentText = "\n  first line\n  second line\n";
  const cdataText = "\n  a > b {\n    color: red;\n  }\n";
  const xml = j.serialize(j.xmlEl("root", {}, j.xmlComment(commentText), j.xmlCdata(cdataText)));
  const root = new DOMParser().parseFromString(xml, "application/xml").documentElement;
  const payloads = Array.from({ length: root.childNodes.length }, (_, i) => root.childNodes.item(i))
    .filter((node) => node?.nodeType === 8 || node?.nodeType === 4)
    .map((node) => node?.nodeValue);

  assertEquals(payloads, [commentText, cdataText]);
});

Deno.test("escapeAttr escapes only XML attribute delimiters", () => {
  assertEquals(j.escapeAttr(`a & b < "c" > d`), "a &amp; b &lt; &quot;c&quot; > d");
});

Deno.test("escapeText escapes character data without rewriting plain greater-than signs", () => {
  assertEquals(j.escapeText("a & b < c > d"), "a &amp; b &lt; c > d");
  assertEquals(j.escapeText("a ]]> b"), "a ]]&gt; b");
});

Deno.test("walk and indexById traverse in document order", () => {
  const catalog = j.xmlEl("catalog", { id: "root" }, j.xmlEl("book", { id: "one" }), j.xmlEl("book", { id: "two" }));
  const visited: string[] = [];
  j.walk(catalog, (node) => visited.push(String(j.attrs(node).id)));
  assertEquals(visited, ["root", "one", "two"]);
  assertEquals(j.indexById(catalog).get("two"), j.children(catalog)[1]);
});

Deno.test("serializeXml optionally adds the XML declaration", () => {
  const root = j.xmlEl("root");
  assertEquals(j.serializeXml(root), '<?xml version="1.0" encoding="UTF-8"?>\n<root/>');
  assertEquals(j.serializeXml(root, false), "<root/>");
});
