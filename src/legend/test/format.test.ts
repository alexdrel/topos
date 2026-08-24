import { assertEquals } from "@std/assert";
import { parseCodeText, parseLiteralText, parseText } from "../format.ts";
import { fencedTextContent } from "../../sigil.ts";

Deno.test("formatted text renders visible spaces as em spaces", () => {
  assertEquals(parseText("A␠B"), [[{ text: "A B", bold: false, italic: false, strike: false, code: false }]]);
});

Deno.test("formatted text renders visible NBSP glyphs as non-breaking spaces", () => {
  assertEquals(parseText("A⍽B"), [[{ text: "A B", bold: false, italic: false, strike: false, code: false }]]);
});

Deno.test("formatted text parses Markdown links into segments", () => {
  assertEquals(parseText("Read [the docs](https://example.com/docs) now"), [[
    { text: "Read ", bold: false, italic: false, strike: false, code: false },
    { text: "the docs", href: "https://example.com/docs", bold: false, italic: false, strike: false, code: false },
    { text: " now", bold: false, italic: false, strike: false, code: false },
  ]]);
});

Deno.test("formatted text keeps hash destinations as unresolved link references", () => {
  assertEquals(parseText("Read [the docs](#docs)"), [[
    { text: "Read ", bold: false, italic: false, strike: false, code: false },
    { text: "the docs", linkRef: "docs", bold: false, italic: false, strike: false, code: false },
  ]]);
});

Deno.test("formatted text leaves incomplete Markdown links literal", () => {
  assertEquals(parseText("Read [the docs](later"), [[
    { text: "Read [the docs](later", bold: false, italic: false, strike: false, code: false },
  ]]);
});

Deno.test("formatted text ignores a paragraph marker without a following paragraph", () => {
  assertEquals(parseText("Very Long Component\nDescriptive Name ¶"), [[
    {
      text: "Very Long Component Descriptive Name",
      bold: false,
      italic: false,
      strike: false,
      code: false,
    },
  ]]);
});

Deno.test("code text preserves physical lines and does not parse markdown", () => {
  assertEquals(parseCodeText("A  *literal*\n  B"), [
    [{ text: "A  *literal*", code: true }],
    [{ text: "  B", code: true }],
  ]);
});

Deno.test("fenced code text hides delimiters", () => {
  const text = "~~~~\n  A  B\n~~~~";
  assertEquals(parseCodeText(fencedTextContent(text)!), [
    [],
    [{ text: "  A  B", code: true }],
    [],
  ]);
});

Deno.test("literal text preserves Markdown punctuation without interpreting it", () => {
  assertEquals(parseLiteralText(" A  *literal*\n  and `ticks` "), [
    [{ text: " A  *literal*" }],
    [{ text: "  and `ticks` " }],
  ]);
});
