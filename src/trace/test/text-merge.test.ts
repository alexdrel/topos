import { assertEquals } from "@std/assert";
import { assertArrayMatch } from "./trace-utils.ts";
import { flushPendingWrites, testTraceMap, testCompleted } from "../../test/test-utils.ts";

Deno.test.afterEach(flushPendingWrites);

Deno.test("Merge: 3-line paragraph", (t) => {
  const diagram = `
┌──────────────────────┐
│   This is a          │
│   long paragraph     │
│   with three lines   │
└──────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 24, h: 5 },
    { type: "text", x: 4, y: 2, w: 16, h: 3, text: "This is a\nlong paragraph\nwith three lines" }
  ]);
  testCompleted(t);
});

Deno.test("Merge: List with Wrapping", (t) => {
  const diagram = `
┌──────────────────────┐
│    Item 1 is long    │
│   and wraps here     │
│    Item 2            │
└──────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 24, h: 5 },
    { type: "text", x: 4, y: 2, h: 3, text: " Item 1 is long\nand wraps here\n Item 2" }
  ]);
  testCompleted(t);
});

Deno.test("Merge: User Bullet List", (t) => {
  const diagram = `
┌──────────────────────┐
│ - note 1             │
│ - note 2             │
│ - long note          │
│   that continues     │
└──────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 24, h: 6 },
    { type: "text", x: 2, y: 2, h: 4, text: "- note 1\n- note 2\n- long note\n  that continues" }
  ]);
  testCompleted(t);
});



Deno.test("Merge: List with Wrapping", (t) => {
  const diagram = `
┌──────────────────────┐
│    Item 1 is long    │
│   and wraps here     │
│    Item 2            │
└──────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 24, h: 5 },
    { type: "text", x: 4, y: 2, h: 3, text: " Item 1 is long\nand wraps here\n Item 2" }
  ]);
  testCompleted(t);
});

Deno.test("Merge: User Bullet List", (t) => {
  const diagram = `
┌──────────────────────┐
│ - note 1             │
│ - note 2             │
│ - long note          │
│   that continues     │
└──────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 24, h: 6 },
    { type: "text", x: 2, y: 2, h: 4, text: "- note 1\n- note 2\n- long note\n  that continues" }
  ]);
  testCompleted(t);
});

Deno.test("Merge: # prevents merge", (t) => {
  const diagram = `
┌────────────────────────────┐
│ # Centered Title           │
│ ## Centered Subtitle       │
│ ## Centered Body text line │
└────────────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, h: 5 },
    { type: "text", x: 2, y: 2, text: "# Centered Title" },
    { type: "text", x: 2, y: 3, text: "## Centered Subtitle" },
    { type: "text", x: 2, y: 4, text: "## Centered Body text line" },
  ]);
  testCompleted(t);
});

Deno.test("Merge: # prevents merge for child only", (t) => {
  const diagram = `
┌────────────────────────────┐
│ # Centered Title           │
│ ## Centered Subtitle       │
│  Centered Body text line   │
└────────────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, h: 5 },
    { type: "text", x: 2, y: 2, text: "# Centered Title" },
    { type: "text", x: 2, y: 3, h: 2, text: "## Centered Subtitle\n Centered Body text line" },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Misaligned lines do not merge", (t) => {
  const diagram = `
┌───────────────────────────┐
│ Paragraph line one        │
│     Shifted by 4 spaces   │
└───────────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1 },
    { type: "text", text: "Paragraph line one" },
    { type: "text", text: "Shifted by 4 spaces" },
  ]);
  testCompleted(t);
});

Deno.test("Merge: padding of positive and negative parent offset shift", (t) => {
  const diagram = `
┌───────────────────────────┐
│   Line one                │
│     Line two (shift +2)   │
│ Line three (shift -2) ⏎   │
└───────────────────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "box", x: 0, y: 1, w: 29, h: 5 },
    { type: "text", x: 2, y: 2, w: 23, h: 3, text: "  Line one\n    Line two (shift +2)\nLine three (shift -2) ⏎" }
  ]);
  testCompleted(t);
});

Deno.test("Merge: Markdown table into single text note", (t) => {
  const diagram = `\
| Form                | Meaning                                                |
| ------------------- | ------------------------------------------------------ |
| *                   | Any entity                                             |
| /                   | Root diagram                                           |
| Database            | Entity with label Database                             |
| #mc                 | Entity with id mc (explicit #id sigil)                 |
| .class              | Class membership                                       |
| [Mission Control]   | Entity with id Mission Control (brackets for spaces)   |
`;
  const traces = testTraceMap(t, diagram);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 80, h: 8, text: diagram.trimEnd() },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Cascading multi-column text merge", (t) => {
  const diagram = `\
Col1           Col2           Col3           Col4 Extended Text Line Extra        Col5 Extended Text Line Extra
------------------                                                                                             Col6
------------------------------
-------------------------------------------------------------------
---------------------------------------------------------------------------
---------------------------------------------------------------------------------
`;
  const traces = testTraceMap(t, diagram);
  assertEquals(traces.length, 1);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 115, h: 6, text: diagram.trimEnd() },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Simple fence block", (t) => {
  const diagram = `\
\`\`\`
line one
  line two
\`\`\`
`;
  const traces = testTraceMap(t, diagram);
  assertEquals(traces.length, 1);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, h: 4, text: "```\nline one\n  line two\n```" },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Fence block preserves empty lines", (t) => {
  const diagram = `\
\`\`\`
line one

line three
\`\`\`
`;
  const traces = testTraceMap(t, diagram);
  assertEquals(traces.length, 1);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, h: 5, text: "```\nline one\n\nline three\n```" },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Fence blocks do not merge with each other", (t) => {
  const diagram = `\
\`\`\`   ~~~~
A      B
\`\`\`   ~~~~
`;
  const traces = testTraceMap(t, diagram);
  assertEquals(traces.length, 2);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, h: 3 },
    { type: "text", x: 6, y: 0, h: 3 },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Longer fence allows more indent", (t) => {
  const diagram = `\
~~~~~~
      indented 6
~~~~~~
`;
  const traces = testTraceMap(t, diagram);
  assertEquals(traces.length, 1);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, h: 3, text: "~~~~~~\n      indented 6\n~~~~~~" },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Shorter nested fence is content of longer outer fence", (t) => {
  const diagram = `\
~~~~~
outer
~~~
inner
~~~
~~~~~
`;
  const traces = testTraceMap(t, diagram);
  assertEquals(traces.length, 1);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, w: 5, h: 6, text: diagram.trimEnd() },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Code blocks", (t) => {
  const diagram = `\
~~~~
 <li>
     <div class="cheatsheet-keys">                                                         \`\`\`
         <kbd>B</kbd> / <kbd>T</kbd> / <kbd>L</kbd> / <kbd>H</kbd>                            <li>
     </div>                                                                                       <div class="cheatsheet-keys">
     <div class="cheatsheet-desc">Create Box / Text / Line / Hub</div>                                <kbd>⌘/Ctrl</kbd>+<kbd>E</kbd>
 </li>                                                                                            </div>
~~~~                                                                                              <div class="cheatsheet-desc">Open Source</div>
                                                                                              </li>
                                                                                           \`\`\`
`;
  const traces = testTraceMap(t, diagram);
  assertEquals(traces.length, 2);
  assertArrayMatch(traces, [
    { type: "text", x: 0, y: 0, h: 8 },
    { type: "text", x: 91, y: 2, h: 8 },
  ]);
  testCompleted(t);
});

Deno.test("Merge: Code blocks in boxes", (t) => {
  const diagram = `\
 ┌───────────────┐   ┌────────────┐
 │ ~~~           │   │~~~~~       │
 │    aaaaa      │   │      AAA   │
 │      □ LLLL  1├───▶            │
 │ bbbb          │   │           B│
 │ ~~~           │   │~~~~~       │
 └───────────────┘   └────────────┘
`;
  const traces = testTraceMap(t, diagram);
  assertEquals(traces.length, 5);
  assertArrayMatch(traces, [
    // 2 boxes
    { type: "box", x: 1, y: 0, w: 17, h: 7 },
    { type: "box", x: 21, y: 0, w: 14, h: 7 },
    // 1 line
    { type: "line" },
    // 2 texts
    { type: "text", x: 3, y: 1, w: 14, h: 5, text: "~~~\n   aaaaa\n     □ LLLL  1\nbbbb\n~~~" },
    { type: "text", text: "~~~~~\n      AAA\n\n           B\n~~~~~" },
  ]);
  testCompleted(t);
});
