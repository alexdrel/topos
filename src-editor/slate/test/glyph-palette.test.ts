import { assertEquals } from "@std/assert";
import { GLYPHS, Trait } from "../../../src/grammar.ts";
import { GlyphPalette } from "../glyph-palette.ts";

Deno.test("glyph palette includes Topos text controls", () => {
  const items = GlyphPalette.groups.flatMap((group) => group.options);

  assertEquals(items.some((item) => item.display === "␣" && item.value === " " && item.title === "Space"), true);
  assertEquals(items.some((item) => item.display === "⏎" && item.value === "⏎"), true);
  assertEquals(items.some((item) => item.display === "↵" && item.value === "↵"), true);
  assertEquals(items.some((item) => item.display === "¶" && item.value === "¶"), true);
  assertEquals(items.some((item) => item.display === "␠" && item.value === "␠"), true);
  assertEquals(items.some((item) => item.display === "⍽" && item.value === "⍽"), true);
  for (const glyph of ["•", "✓", "✗", "…"]) {
    assertEquals(items.some((item) => item.display === glyph && item.value === glyph), true);
  }
});

Deno.test("glyph palette keeps every non-ASCII grammar glyph", () => {
  const values = new Set(GlyphPalette.groups.flatMap((group) => group.options.map((item) => item.value)));
  const expected = Object.entries(GLYPHS)
    .filter(([char, spec]) => char !== "" && char !== " " && char !== "@@" && spec.family !== "ascii" && !(spec.trait & Trait.Brace))
    .map(([char]) => char);

  assertEquals(expected.filter((char) => !values.has(char)), []);
});
