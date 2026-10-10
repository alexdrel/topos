import { test } from "node:test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { parseHeaderTail, stripSigils } from "../sigil.ts";

test("header parameters: scale and width are preserved", () => {
  assertEquals(parseHeaderTail("scale=2 width=1200").parameters, {
    scale: "2",
    width: "1200",
  });
});

test("header parameters allow whitespace after equals", () => {
  assertEquals(parseHeaderTail('bg = #EEE title = "Deep blue"').parameters, {
    bg: "#EEE",
    title: "Deep blue",
  });
});

test("sigils: strips annotation clusters at text boundaries", () => {
  assertEquals(stripSigils("#id.red @type Text .soft"), "Text");
  assertEquals(stripSigils(".red"), "");
});

test("sigils: preserves annotation-like words inside prose", () => {
  assertEquals(stripSigils("This explains .red syntax in prose"), "This explains .red syntax in prose");
  assertEquals(stripSigils("Names like svc.core and R2.A stay intact"), "Names like svc.core and R2.A stay intact");
});
