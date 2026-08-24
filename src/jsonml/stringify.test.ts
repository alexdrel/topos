import { assertEquals } from "@std/assert";
import { stringifyJsonMl } from "./stringify.ts";
import { xmlEl } from "./jsonml.ts";

Deno.test("stringifyJsonMl formats nested elements", () => {
  const jsonml = xmlEl("root", { id: "one" }, xmlEl("child", {}, "text"));
  assertEquals(stringifyJsonMl(jsonml), '["root",{"id":"one"},\n  ["child",{},"text"]\n]');
});

Deno.test("stringifyJsonMl keeps whitespace on the preceding line", () => {
  const jsonml = xmlEl("root", {}, xmlEl("one"), "\n", xmlEl("two"));
  assertEquals(stringifyJsonMl(jsonml), '["root",{},\n  ["one",{}],"\\n",\n  ["two",{}]\n]');
});

Deno.test("stringifyJsonMl keeps multiline payloads diff-friendly", () => {
  const jsonml = xmlEl("style", {}, xmlEl("$cdata", {}, "first\n", "second"));
  assertEquals(stringifyJsonMl(jsonml), '["style",{},\n  ["$cdata",{},\n    "first\\n",\n    "second"\n  ]\n]');
});
