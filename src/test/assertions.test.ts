import { throws } from "node:assert/strict";
import { test } from "node:test";
import { assertAlmostEquals, assertExists, assertStringIncludes, assertThrows } from "./assertions.ts";
import { assertArrayMatch } from "../trace/test/trace-utils.ts";

test("assertions: existence retains falsy values and rejects nullish values", () => {
  for (const value of [false, 0, ""]) assertExists(value);
  throws(() => assertExists(null));
  throws(() => assertExists(undefined));
});

test("assertions: approximate equality respects its tolerance", () => {
  assertAlmostEquals(1, 1 + 1e-8);
  assertAlmostEquals(1, 1.05, 0.1);
  throws(() => assertAlmostEquals(1, 1.05, 0.01));
});

test("assertions: string inclusion treats punctuation literally", () => {
  assertStringIncludes("hello [world]", "[world]");
  throws(() => assertStringIncludes("hello world", "[world]"));
});

test("assertions: thrown errors must match the class and message substring", () => {
  assertThrows(() => { throw new TypeError("invalid input: blank"); }, TypeError, "input: blank");
  throws(() => assertThrows(() => { throw new Error("invalid input"); }, TypeError));
  throws(() => assertThrows(() => { throw new Error("invalid input"); }, Error, "blank"));
  throws(() => assertThrows(() => {}));
});

test("assertions: partial array matching preserves element positions", () => {
  assertArrayMatch([{ id: "a", extra: true }, { id: "b" }], [{ id: "a" }]);
  throws(() => assertArrayMatch([{ id: "a" }, { id: "b" }], [{ id: "b" }]));
  throws(() => assertArrayMatch([], [{ id: "a" }]));
});
