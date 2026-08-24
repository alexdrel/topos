import { assertEquals } from "@std/assert";
import { traceMap } from "../../../../src/trace/trace-map.ts";
import { createHub, createLabel, createText, deleteTrace, reconcileLabels, setHubTraceGlyph, setLabel } from "../../mutate.ts";
import { findTrace, matchTraceMap } from "../../../../src/trace/test/trace-utils.ts";

Deno.test("trace: hub glyph and label mutations", () => {
  const state = traceMap(`\
  ◎ Top
`);
  const hub = findTrace(state, { type: "hub", x: 2, y: 0 });
  const label = findTrace(state, { type: "label", x: 4, y: 0 });

  assertEquals(hub.text, "◎");
  assertEquals(label.text, "Top");
  assertEquals(label.parent, hub);

  // 1. Change hub glyph
  setHubTraceGlyph(state, hub, "◇");
  assertEquals(hub.text, "◇");
  matchTraceMap(state, `\
  ◇ Top`);

  // 2. Change hub label
  setLabel(state, hub.rawLabels![0], "Bottom");
  assertEquals(label.text, "Bottom");
  matchTraceMap(state, `\
  ◇ Bottom`);

  // 3. Reconcile label association: move label too far, it becomes a regular text trace
  label.x = 10;
  reconcileLabels(state);
  assertEquals(label.type, "text");
  assertEquals(label.parent, undefined);
  assertEquals(hub.rawLabels?.length, 0);

  // 4. Move text back close to hub: it reconciles back to a label
  label.x = 4;
  reconcileLabels(state);
  assertEquals(label.type, "label");
  assertEquals(label.parent, hub);

  // 5. Delete hub trace: child label trace is also deleted
  deleteTrace(state, hub);
  assertEquals(state.traces.includes(hub), false);
  assertEquals(state.traces.includes(label), false);
  matchTraceMap(state, "");
});

Deno.test("trace: left-labeled hub mutations and roundtrips", () => {
  const state = traceMap(`\
   Bottom ◎
`);
  const hub = findTrace(state, { type: "hub", x: 10, y: 0 });
  const label = findTrace(state, { type: "label", x: 3, y: 0 });

  assertEquals(hub.text, "◎");
  assertEquals(label.text, "Bottom");
  assertEquals(label.parent, hub);

  // 1. Change hub glyph
  setHubTraceGlyph(state, hub, "◇");
  assertEquals(hub.text, "◇");
  matchTraceMap(state, `\
   Bottom ◇`);

  // 2. Change hub label
  setLabel(state, hub.rawLabels![0], "Top");
  assertEquals(label.text, "Top");
  matchTraceMap(state, `\
      Top ◇`);
});

Deno.test("trace: create hub trace with label", () => {
  const state = traceMap("");
  const hub = createHub(state, { x: 2, y: 1 }, "◎");
  createLabel(state, hub, "Server");
  matchTraceMap(state, `
  ◎ Server`);
});

Deno.test("trace: reconcile label with a pathless hub", () => {
  const state = traceMap("");
  const hub = createHub(state, { x: 2, y: 1 }, "◎");
  const text = createText(state, { x: 4, y: 1 }, "Server");

  reconcileLabels(state);

  assertEquals(text.type, "label");
  assertEquals(text.parent, hub);
});
