import { assertEquals } from "@std/assert";
import { Dir } from "../../../src/geo.ts";
import { traceMap } from "../../../src/trace/trace-map.ts";
import { insertTraceText, traceSelectionToText } from "../clipboard.ts";
import { expandTraceSelection, normalizeTraceSelection } from "../selection.ts";
import { findTrace, matchTraceMap } from "../../../src/trace/test/trace-utils.ts";

Deno.test("trace clipboard: selected traces render to cropped plain text", () => {
  const state = traceMap(`\
┌─────┐
│  A  │
└─────┘

B ───▶ C`);
  const box = findTrace(state, { type: "box", x: 0, y: 0 });
  const text = findTrace(state, { type: "text", x: 3, y: 1 });

  assertEquals(traceSelectionToText(state, [box, text]), `\
┌─────┐
│  A  │
└─────┘`);
});

Deno.test("trace clipboard: paste parses plain text and selects inserted trace objects", () => {
  const state = traceMap(`\
┌─────┐
│  A  │
└─────┘`);
  const box = findTrace(state, { type: "box", x: 0, y: 0 });
  const text = findTrace(state, { type: "text", x: 3, y: 1 });
  const copied = traceSelectionToText(state, [box, text]);

  const pasted = insertTraceText(state, copied, { x: 9, y: 0 });

  assertEquals(pasted.length, 2);
  assertEquals(pasted.every((trace) => state.traces.includes(trace)), true);
  matchTraceMap(state, `\
┌─────┐  ┌─────┐
│  A  │  │  A  │
└─────┘  └─────┘`);
});

Deno.test("trace clipboard: pasted box grid moves as one hierarchy", () => {
  const state = traceMap("");
  const grid = `\
┌─────────┬─────────┐
│  Box A  │  Box B  │
├─────────┼─────────┤
│  Box C  │  Box D  │
└─────────┴─────────┘`;

  insertTraceText(state, grid, { x: 2, y: 1 });

  matchTraceMap(state, `\

  ┌─────────┬─────────┐
  │  Box A  │  Box B  │
  ├─────────┼─────────┤
  │  Box C  │  Box D  │
  └─────────┴─────────┘`);
});

Deno.test("trace clipboard: marquee-selected box grid includes its cells", () => {
  const grid = `\
┌─────────┬─────────┐
│  Box A  │  Box B  │
├─────────┼─────────┤
│  Box C  │  Box D  │
└─────────┴─────────┘`;
  const state = traceMap(grid);

  assertEquals(normalizeTraceSelection(state.traces).map(({ type }) => type), ["box", "text", "text", "text", "text"]);
  assertEquals(expandTraceSelection(state, normalizeTraceSelection(state.traces)).length, state.traces.length);
  assertEquals(traceSelectionToText(state, state.traces), grid);
});

Deno.test("trace clipboard: line labels round-trip through plain text paste", () => {
  const state = traceMap(`A ──Hi──▶ B`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.W });
  const copied = traceSelectionToText(state, [line]);

  assertEquals(copied, `──Hi──▶`);

  const pasted = insertTraceText(state, copied, { x: 0, y: 2 });
  const pastedLine = pasted.find((trace) => trace.type === "line");
  const pastedLabel = pasted.find((trace) => trace.type === "label");

  assertEquals(pastedLine?.rawLabels, pastedLabel ? [pastedLabel] : undefined);
  assertEquals(pastedLabel?.parent, pastedLine);
  matchTraceMap(state, `\
A ──Hi──▶ B

──Hi──▶`);
});

Deno.test("trace clipboard: selected termini render as spatial plain text", () => {
  const state = traceMap(`\
A ───▶ B

C ───▷ D`);
  const lines = state.traces.filter((trace) => trace.type === "line");
  const top = lines[0].target!;
  const bottom = lines[1].target!;

  assertEquals(traceSelectionToText(state, [top]), "▶");
  assertEquals(traceSelectionToText(state, [top, bottom]), "▶\n\n▷");

  const pasted = insertTraceText(state, traceSelectionToText(state, [top]), { x: 10, y: 0 });
  assertEquals(pasted.map(({ type, text }) => ({ type, text })), [{ type: "text", text: "▶" }]);
});
