import { assertEquals } from "@std/assert";
import { traceMap } from "../../../../src/trace/trace-map.ts";
import { findTrace, matchTraceMap } from "../../../../src/trace/test/trace-utils.ts";
import { reshapeInlineTrace, resizeInlineTrace } from "../../mutate.ts";

Deno.test("trace: inline resize centers content with authored spaces", () => {
  const state = traceMap(`\
[Spirit]
[Opportunity]`);
  const spirit = findTrace(state, { type: "inline", x: 0, y: 0 });
  const opportunity = findTrace(state, { type: "inline", x: 0, y: 1 });

  assertEquals(resizeInlineTrace(state, spirit, { right: 8 }), true);
  assertEquals(resizeInlineTrace(state, opportunity, { right: 3 }), true);

  matchTraceMap(state, `\
[    Spirit    ]
[  Opportunity ]`);
});

Deno.test("trace: inline resize removes padding and respects the content minimum", () => {
  const state = traceMap("[  Spirit ]");
  const inline = findTrace(state, { type: "inline", x: 0, y: 0 });

  assertEquals(reshapeInlineTrace(state, inline, { x: 3, y: 0, w: 8, h: 1 }), true);
  assertEquals(reshapeInlineTrace(state, inline, { x: 4, y: 0, w: 7, h: 1 }), false);

  matchTraceMap(state, "   [Spirit]");
});
