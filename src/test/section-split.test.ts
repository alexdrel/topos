import { assertEquals } from "@std/assert";
import { parseTopos, splitToposFile } from "../topos.ts";

Deno.test("splitToposFile strips named :map header", () => {
  const input = `\
:map main flow
┌───┐
│ A │
└───┘`;
  const { map, legend } = splitToposFile(input);
  assertEquals(map, { header: ":map main flow", content: ["┌───┐", "│ A │", "└───┘"] });
  assertEquals(legend, undefined);
});

Deno.test("splitToposFile supports named :legend header", () => {
  const input = `\
:map main
(A)──>(B)
:legend semantics
[A]: #a@svc
[B]: #b@svc`;
  const { map, legend } = splitToposFile(input);
  assertEquals(map, { header: ":map main", content: ["(A)──>(B)"] });
  assertEquals(legend, { header: ":legend semantics", content: ["[A]: #a@svc", "[B]: #b@svc"] });
});

Deno.test("splitToposFile parses a quoted map title and legend parameters", () => {
  const input = `\
:map "Platform map"
(A)
:legend theme=dark bg="deep blue"
[A]: green`;
  const sections = splitToposFile(input);
  assertEquals(sections.title, "Platform map");
  assertEquals(sections.parameters, { theme: "dark", bg: "deep blue" });

  const diagram = parseTopos(input);
  assertEquals(diagram.root.text, "Platform map");
  assertEquals(diagram.parameters, { theme: "dark", bg: "deep blue" });
});

Deno.test("splitToposFile accepts a quoted title on either section header", () => {
  const legendTitle = parseTopos(`\
:map
(A)
:legend "Legend title" theme=dark`);
  assertEquals(legendTitle.root.text, "Legend title");

  const laterTitle = parseTopos(`\
:map "Map title"
(A)
:legend "Later title"`);
  assertEquals(laterTitle.root.text, "Later title");
});

Deno.test("splitToposFile keeps map unchanged when no section headers are present", () => {
  const input = `\
┌───┐
│ A │
└───┘`;
  const { map, legend } = splitToposFile(input);
  assertEquals(map, { header: "", content: input.split("\n") });
  assertEquals(legend, undefined);
});

Deno.test("splitToposFile preserves a final empty line", () => {
  assertEquals(splitToposFile(":map").map, { header: ":map", content: [] });
  assertEquals(splitToposFile(":map\n").map, { header: ":map", content: [""] });
});

Deno.test("splitToposFile recognizes directives only in strict order at column zero", () => {
  const leadingBlank = splitToposFile("\n:map\n(A)");
  assertEquals(leadingBlank.map, { header: "", content: ["", ":map", "(A)"] });

  const repeated = splitToposFile(":map\n(A)\n:map\n(B)\n:legend\n[A]: blue\n:map\nignored");
  assertEquals(repeated.map, { header: ":map", content: ["(A)", ":map", "(B)"] });
  assertEquals(repeated.legend, { header: ":legend", content: ["[A]: blue", ":map", "ignored"] });
});
