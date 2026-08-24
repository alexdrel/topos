import { assertEquals, assertThrows } from "@std/assert";
import { assertElMatch, findEl, matchChildEl } from "./assert.ts";
import { attrs, xmlEl } from "./jsonml.ts";

function catalog() {
  return xmlEl(
    "catalog",
    {},
    xmlEl("book", { id: "one", class: "featured hardcover" }, "One"),
    xmlEl("book", { id: "two" }, "Two"),
  );
}

Deno.test("findEl searches by tag and partial attributes", () => {
  assertEquals(attrs(findEl(catalog(), "book", { id: "two" })!).id, "two");
  assertEquals(findEl(catalog(), "author"), undefined);
});

Deno.test("matchChildEl requires one direct match by default", () => {
  assertEquals(attrs(matchChildEl(catalog(), "book", { id: "one" })).id, "one");
  assertThrows(() => matchChildEl(catalog(), "book"), Error, "expected 1 matched child");
});

Deno.test("assertElMatch supports class-token, child-count, and text matching", () => {
  const node = findEl(catalog(), "book", { id: "one" })!;
  assertElMatch(node, "book", { class: "hardcover", $children: 0, $text: "One" });
});
