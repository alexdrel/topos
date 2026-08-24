import { assertEquals, assertThrows } from "@std/assert";
import { traceMap } from "../../../../src/trace/trace-map.ts";
import { createText, deleteTrace, moveTraces, reconcileLabels, setText } from "../../mutate.ts";
import { findTrace, matchTraceMap } from "../../../../src/trace/test/trace-utils.ts";

Deno.test("trace: move text trace", () => {
  const state = traceMap(`\
A
`);
  const text = findTrace(state, { type: "text", x: 0, y: 0 });

  moveTraces(state, [text], 4, 1);

  matchTraceMap(state, `\

    A`);
});

Deno.test("trace: edit and delete text trace", () => {
  const state = traceMap("Old");
  const text = findTrace(state, { type: "text", x: 0, y: 0 });

  setText(state, text, "Newer");
  matchTraceMap(state, "Newer");

  deleteTrace(state, text);
  matchTraceMap(state, "");
});

Deno.test("trace: text creation and editing reject blank content", () => {
  const state = traceMap("Old");
  const text = findTrace(state, { type: "text", x: 0, y: 0 });

  assertThrows(() => createText(state, { x: 0, y: 1 }, "  \n"), Error, "Text must not be blank");
  assertThrows(() => setText(state, text, "   "), Error, "Text must not be blank");
  matchTraceMap(state, "Old");
});

Deno.test("trace: edit inline trace text", () => {
  const state = traceMap("[A]");
  const inline = findTrace(state, { type: "inline", x: 0, y: 0 });

  setText(state, inline, "[New]");
  matchTraceMap(state, "[New]");
});

Deno.test("trace: text editing detects inline nodes and reconciliation preserves them", () => {
  const state = traceMap("Old");
  const text = findTrace(state, { type: "text", x: 0, y: 0 });

  setText(state, text, "[  New  ]");
  assertEquals({ type: text.type, bracket: text.bracket }, { type: "inline", bracket: "[]" });
  reconcileLabels(state);

  assertEquals({ type: text.type, bracket: text.bracket }, { type: "inline", bracket: "[]" });
  matchTraceMap(state, "[  New  ]");
});

Deno.test("trace: inline editing detects plain text and reconciliation preserves it", () => {
  const state = traceMap("[Old]");
  const inline = findTrace(state, { type: "inline", x: 0, y: 0 });

  setText(state, inline, "New");
  assertEquals({ type: inline.type, bracket: inline.bracket }, { type: "text", bracket: undefined });
  reconcileLabels(state);

  assertEquals({ type: inline.type, bracket: inline.bracket }, { type: "text", bracket: undefined });
  matchTraceMap(state, "New");
});

Deno.test("trace: text creation detects inline nodes and normalizes single-line indentation", () => {
  const state = traceMap("");
  const inline = createText(state, { x: 2, y: 1 }, "  [New]");

  assertEquals({ type: inline.type, bracket: inline.bracket, text: inline.text, x: inline.x, w: inline.w }, {
    type: "inline",
    bracket: "[]",
    text: "[New]",
    x: 4,
    w: 5,
  });
  matchTraceMap(state, `\

    [New]`);
});

Deno.test("trace: create and edit multiline text trace", () => {
  const state = traceMap("");
  const text = createText(state, { x: 0, y: 0 }, "Hello\nWorld!");

  assertEquals(text.w, 6);
  assertEquals(text.h, 2);

  matchTraceMap(state, `\
Hello
World!`);

  setText(state, text, "A\nBC\nDEF");
  assertEquals(text.w, 3);
  assertEquals(text.h, 3);

  matchTraceMap(state, `\
A
BC
DEF`);
});
