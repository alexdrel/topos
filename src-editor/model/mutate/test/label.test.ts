import { assertEquals, assertThrows } from "@std/assert";
import { Dir } from "../../../../src/geo.ts";
import { projectTracesToGrid } from "../../../../src/ink/ink.ts";
import { traceMap } from "../../../../src/trace/trace-map.ts";
import { createLabel, moveTraces, reconcileLabels, resizeBoxTrace, setLabel } from "../../mutate.ts";
import { findTrace, matchTraceMap } from "../../../../src/trace/test/trace-utils.ts";

Deno.test("trace: move box does not move contained label text", () => {
  const state = traceMap(`\
┌─────┐
│  A  │
└─────┘`);
  const box = findTrace(state, { type: "box", x: 0, y: 0 });

  moveTraces(state, [box], 4, 2);

  matchTraceMap(state, `\

   A
    ┌─────┐
    │     │
    └─────┘`);
});

Deno.test("trace: move ceiling label independently from box outline", () => {
  const state = traceMap(`\
┌── Top ──┐
│         │
└─────────┘`);
  const label = findTrace(state, { type: "label", x: 3, y: 0 });

  moveTraces(state, [label], 0, 2);

  matchTraceMap(state, `\
┌─────────┐
│         │
└── Top ──┘`);
});

Deno.test("trace: edit label trace text", () => {
  const state = traceMap(`\
┌─Box─┐
│     │
└─────┘`);
  const label = findTrace(state, { type: "label", x: 2, y: 0 });

  setLabel(state, label, "Tag");
  assertEquals(label.text, "Tag");
  assertThrows(() => setLabel(state, label, "   "), Error, "Label must not be blank");
  assertEquals(label.text, "Tag");
});

Deno.test("trace: break association by moving label away from perimeter", () => {
  const state = traceMap(`\
┌─Top─┐
│     │
└─────┘`);
  const box = findTrace(state, { type: "box", x: 0, y: 0 });
  const label = findTrace(state, { type: "label", x: 2, y: 0 });

  // Move label to x=0, y=4 (completely away from the perimeter)
  moveTraces(state, [label], -2, 4);
  reconcileLabels(state);

  // Now the association should be broken.
  // If we move the box, the label should NOT move.
  moveTraces(state, [box], 5, 0);

  matchTraceMap(state, `\
     ┌─────┐
     │     │
     └─────┘

Top`);
});

Deno.test("trace: associate text to parent box by moving it onto the perimeter", () => {
  const state = traceMap(`\
┌─────┐
│     │
└─────┘

Note`);
  const box = findTrace(state, { type: "box", x: 0, y: 0 });
  const text = findTrace(state, { type: "text", x: 0, y: 4 });

  // Move the text trace to x=2, y=0 (on the box top perimeter)
  moveTraces(state, [text], 2, -4);
  reconcileLabels(state);

  // It should now be associated as a label!
  assertEquals(text.type, "label");
  assertEquals(text.parent, box);
  assertEquals(box.rawLabels, [text]);

  // If we move the box, the associated label should also move!
  moveTraces(state, [box], 3, 1);
  matchTraceMap(state, `\

   ┌─Note┐
   │     │
   └─────┘`);
});

Deno.test("trace: group move does not erroneously associate non-overlapping labels during intermediate steps", () => {
  const state = traceMap(`\
┌─┐
│ │
└─┘


     A`);

  const box = findTrace(state, { type: "box", x: 0, y: 0 });
  const text = findTrace(state, { type: "text", x: 5, y: 5 });

  assertEquals(text.type, "text");
  assertEquals(text.parent, undefined);

  // Move both box and text together
  moveTraces(state, [box, text], 5, 5);

  // The text should still be a separate text trace, NOT associated as a label
  assertEquals(text.type, "text");
  assertEquals(text.parent, undefined);
  assertEquals(text.x, 10);
  assertEquals(text.y, 10);

  matchTraceMap(state, `\
\n\n\n\n\n     ┌─┐
     │ │
     └─┘


          A`);
});

Deno.test("trace: create and set labels preserve text before geometric reconciliation", () => {
  const state = traceMap(`\
┌─────┐
│     │
└─────┘
  A ─────▶ B`);
  const box = findTrace(state, { type: "box", x: 0, y: 0 });
  const line = findTrace(state, { type: "line", x: 4, y: 3, startDir: Dir.W });

  assertThrows(() => createLabel(state, box, " "), Error, "Label must not be blank");

  // 2. Setting a new label on box centers it on the top border
  createLabel(state, box, "Tag");
  const label = box.rawLabels?.[0];
  assertEquals(label?.text, "Tag");
  assertEquals(label?.x, 2);
  assertEquals(label?.y, 0);
  matchTraceMap(state, `\
┌─Tag─┐
│     │
└─────┘
  A ─────▶ B`);

  // 3. Modifying existing label does not reposition it, only updates w/text
  label!.x = 1; // Manually shift it to a valid position
  setLabel(state, label!, "Tags!");
  assertEquals(label?.text, "Tags!");
  assertEquals(label?.x, 1); // Still 1, not repositioned to 2
  matchTraceMap(state, `\
┌Tags!┐
│     │
└─────┘
  A ─────▶ B`);

  // 4. Setting a new label on a line places it at the midpoint
  createLabel(state, line, "Hi");
  const lineLabel = line.rawLabels?.[0];
  assertEquals(lineLabel?.text, "Hi");
  assertEquals(lineLabel?.x, 6);
  assertEquals(lineLabel?.y, 3);
  matchTraceMap(state, `\
┌Tags!┐
│     │
└─────┘
  A ──Hi─▶ B`);

  // 5. Labels may overflow temporarily while the author repairs the geometry
  setLabel(state, lineLabel!, "TooLongLabelText");
  setLabel(state, label!, "AlsoTooLongForBox");
  const detachedLineLabel = line.rawLabels![0];
  const detachedBoxLabel = box.rawLabels![0];
  reconcileLabels(state);
  assertEquals(detachedLineLabel.type, "text");
  assertEquals(detachedLineLabel.parent, undefined);
  assertEquals(detachedBoxLabel.type, "text");
  assertEquals(detachedBoxLabel.parent, undefined);

  // Enlarging the box lets the association assistant promote its text again
  resizeBoxTrace(state, box, { right: 12 });
  reconcileLabels(state);
  assertEquals(detachedBoxLabel.type, "label");
  assertEquals(detachedBoxLabel.parent, box);
  assertThrows(() => setLabel(state, detachedBoxLabel, "Multiline\nLabel"), Error, "Label must be a single line");

});

Deno.test("trace: a new label crosses a vertical line and remains associated", () => {
  const state = traceMap(`\
  │
  │
  │
  │
  │`);
  const line = findTrace(state, { type: "line", x: 2, y: 0, startDir: Dir.N });

  const label = createLabel(state, line, "Hi");
  reconcileLabels(state);

  matchTraceMap(state, `\
  │
  │
  Hi
  │
  │`);
  assertEquals(label.parent, line);

  const reparsed = traceMap(projectTracesToGrid(state).text);
  const reparsedLine = findTrace(reparsed, { type: "line", x: 2, y: 0, startDir: Dir.N });
  assertEquals(reparsedLine.rawLabels?.[0].text, "Hi");
});

Deno.test("trace: a new label uses the longest segment of a mixed line", () => {
  const state = traceMap(`\
──┐
  │
  │
  │
  │
  │`);
  const line = findTrace(state, { type: "line", x: 0, y: 0, startDir: Dir.W });

  const label = createLabel(state, line, "Hi");
  reconcileLabels(state);

  matchTraceMap(state, `\
──┐
  │
  │
  Hi
  │
  │`);
  assertEquals(label.parent, line);

  const reparsed = traceMap(projectTracesToGrid(state).text);
  const reparsedLine = findTrace(reparsed, { type: "line", x: 0, y: 0, startDir: Dir.W });
  assertEquals(reparsedLine.rawLabels?.[0].text, "Hi");
});
