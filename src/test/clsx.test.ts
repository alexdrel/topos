import { test } from "node:test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { appendClsx, clsx, clsxSet } from "../clsx.ts";

test("clsx: joins primitives and skips falsy", () => {
  assertEquals(clsx("a", "", null, undefined, false, "b"), "a b");
});

test("clsx: supports nested iterables", () => {
  assertEquals(clsx("a", ["b", ["c"]], new Set(["d", "e"])), "a b c d e");
});

test("clsx: supports dictionary flags", () => {
  assertEquals(
    clsx("base", { active: true, hidden: false }, { rounded: 1, dashed: 0 }),
    "base active rounded",
  );
});

test("clsxSet / appendClsx: produce deduped set output", () => {
  const classes = clsxSet("a", ["a", "b"]);
  appendClsx(classes, { c: true, b: true }, "d");
  assertEquals([...classes], ["a", "b", "c", "d"]);
});
