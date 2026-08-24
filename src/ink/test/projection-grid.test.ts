import { assertEquals } from "@std/assert";
import { ProjectionGrid } from "../projection-grid.ts";
import { Dir } from "../../geo.ts";

// ─── glyphFor() reverse lookup ────────────────────────────────────────────────
const grid = new ProjectionGrid(1, 1, 0, 0);

Deno.test("glyphFor: basic uniform single-weight", () => {
  assertEquals(grid.glyphFor({ mask: Dir.E | Dir.W, weight: { [Dir.E]: "single", [Dir.W]: "single" } }), "─");
  assertEquals(grid.glyphFor({ mask: Dir.N | Dir.S, weight: { [Dir.N]: "single", [Dir.S]: "single" } }), "│");
  assertEquals(grid.glyphFor({ mask: Dir.All, weight: { [Dir.N]: "single", [Dir.E]: "single", [Dir.S]: "single", [Dir.W]: "single" } }), "┼");
  assertEquals(grid.glyphFor({ mask: Dir.S | Dir.E, weight: { [Dir.S]: "single", [Dir.E]: "single" } }), "┌");
  assertEquals(grid.glyphFor({ mask: Dir.N | Dir.W, weight: { [Dir.N]: "single", [Dir.W]: "single" } }), "┘");
});

Deno.test("glyphFor: basic uniform bold-weight", () => {
  assertEquals(grid.glyphFor({ mask: Dir.E | Dir.W, weight: { [Dir.E]: "bold", [Dir.W]: "bold" } }), "━");
  assertEquals(grid.glyphFor({ mask: Dir.N | Dir.S, weight: { [Dir.N]: "bold", [Dir.S]: "bold" } }), "┃");
  assertEquals(grid.glyphFor({ mask: Dir.All, weight: { [Dir.N]: "bold", [Dir.E]: "bold", [Dir.S]: "bold", [Dir.W]: "bold" } }), "╋");
  assertEquals(grid.glyphFor({ mask: Dir.S | Dir.E, weight: { [Dir.S]: "bold", [Dir.E]: "bold" } }), "┏");
});

Deno.test("glyphFor: basic uniform double-weight", () => {
  assertEquals(grid.glyphFor({ mask: Dir.E | Dir.W, weight: { [Dir.E]: "double", [Dir.W]: "double" } }), "═");
  assertEquals(grid.glyphFor({ mask: Dir.N | Dir.S, weight: { [Dir.N]: "double", [Dir.S]: "double" } }), "║");
  assertEquals(grid.glyphFor({ mask: Dir.All, weight: { [Dir.N]: "double", [Dir.E]: "double", [Dir.S]: "double", [Dir.W]: "double" } }), "╬");
  assertEquals(grid.glyphFor({ mask: Dir.S | Dir.E, weight: { [Dir.S]: "double", [Dir.E]: "double" } }), "╔");
});

Deno.test("glyphFor: mixed bold-horizontal / single-vertical cross", () => {
  const dw = { [Dir.E]: "bold", [Dir.W]: "bold", [Dir.N]: "single", [Dir.S]: "single" } as const;
  assertEquals(grid.glyphFor({ mask: Dir.All, weight: dw }), "┿");
});

Deno.test("glyphFor: mixed bold-vertical / single-horizontal cross", () => {
  const dw = { [Dir.N]: "bold", [Dir.S]: "bold", [Dir.E]: "single", [Dir.W]: "single" } as const;
  assertEquals(grid.glyphFor({ mask: Dir.All, weight: dw }), "╂");
});

Deno.test("glyphFor: mixed bold-horizontal T-down junction", () => {
  const dw = { [Dir.E]: "bold", [Dir.W]: "bold", [Dir.S]: "single" } as const;
  assertEquals(grid.glyphFor({ mask: Dir.S | Dir.E | Dir.W, weight: dw }), "┯");
});

Deno.test("glyphFor: mixed double-horizontal T-down junction", () => {
  const dw = { [Dir.E]: "double", [Dir.W]: "double", [Dir.S]: "single" } as const;
  assertEquals(grid.glyphFor({ mask: Dir.S | Dir.E | Dir.W, weight: dw }), "╤");
});

Deno.test("glyphFor: rounded corner family", () => {
  assertEquals(grid.glyphFor({ mask: Dir.S | Dir.E, weight: { [Dir.S]: "single", [Dir.E]: "single" }, family: "unicode", corner: "rounded" }), "╭");
  assertEquals(grid.glyphFor({ mask: Dir.N | Dir.W, weight: { [Dir.N]: "single", [Dir.W]: "single" }, family: "unicode", corner: "rounded" }), "╯");
  assertEquals(grid.glyphFor({ mask: Dir.S | Dir.W, weight: { [Dir.S]: "single", [Dir.W]: "single" }, family: "unicode", corner: "rounded" }), "╮");
});
