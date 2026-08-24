import { assertEquals } from "@std/assert";
import { Dir } from "../../../src/geo.ts";
import { findTrace } from "../../../src/trace/test/trace-utils.ts";
import { EditorModel } from "../model.ts";
import { ToposDocument } from "../document.ts";
import { createBox, moveTraces } from "../mutate.ts";
import { traceSelectionBounds } from "../clipboard.ts";

function createModel(source: string): EditorModel {
  return new EditorModel(new ToposDocument(source));
}

Deno.test("trace model: commit reconciles labels", () => {
  const model = createModel(`\
┌─Top─┐
│     │
└─────┘`);
  const label = model.traceMap.traces.find((trace) => trace.type === "label")!;

  model.beginMapEdit();
  model.updateMap((m) => {
    moveTraces(m.traceMap, [label], 0, 4);
  });
  assertEquals(label.type, "label");

  model.finishMapEdit();
  assertEquals(label.type, "text");
});

Deno.test("trace model: keyboard nudge bends a selected terminus immediately", () => {
  const model = createModel("A ---> B");
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });
  model.setSelection([line.source!]);

  model.nudgeSelection(0, 1);

  assertEquals({ x: line.source!.x, y: line.source!.y }, { x: 2, y: 1 });
});

Deno.test("trace model: reverses selected lines", () => {
  const model = createModel("A ───▶ B");
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });
  model.setSelection([line]);

  model.reverseSelectionLines();

  assertEquals(model.projection.text, "A ◀─── B");
  assertEquals(model.selection, [line]);
});

Deno.test("trace model: cycles selected box through three, two, and one layer", () => {
  const source = `\
┌─────┐
│  A  │
└─────┘`;
  const stacked = `\
┌─────┐
│  A  ├┐
└┬────┘├┐
 └┬────┘│
  └─────┘`;
  const model = createModel(source);
  const box = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });
  model.setSelection([box]);

  model.cycleSelectedBoxStack();
  assertEquals(model.projection.text, stacked);
  assertEquals(box.stack, { layers: 3, dx: 1, dy: 1 });

  model.cycleSelectedBoxStack();
  assertEquals(box.stack, { layers: 2, dx: 1, dy: 1 });

  model.cycleSelectedBoxStack();
  assertEquals(model.projection.text, source);
  assertEquals(box.stack, undefined);
});

Deno.test("trace model: boxes multiple selected traces", () => {
  const model = createModel("One     Two");
  const one = findTrace(model.traceMap, { type: "text", x: 0, y: 0 });
  const two = findTrace(model.traceMap, { type: "text", x: 8, y: 0 });
  model.setSelection([one, two]);

  model.enboxSelection();

  assertEquals(model.projection.text, `\
┌─────────────┐
│ One     Two │
└─────────────┘`);
  assertEquals([one.type, two.type], ["text", "text"]);
  assertEquals(model.selection[0].type, "box");
});

Deno.test("trace model: boxing a selection ignores termini", () => {
  const model = createModel("A ───▶ B");
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });
  model.setSelection([line.target!]);

  model.enboxSelection();

  assertEquals(model.projection.text, "A ───▶ B");
});

Deno.test("trace model: toggles notes and inlines and cycles brackets", () => {
  const model = createModel("Note");
  const note = findTrace(model.traceMap, { type: "text", x: 0, y: 0 });
  model.setSelection([note]);

  model.cycleSelectedInline(true);
  assertEquals(model.projection.text, "[Note]");
  assertEquals({ type: note.type, bracket: note.bracket }, { type: "inline", bracket: "[]" });

  model.cycleSelectedInline(true);
  assertEquals(model.projection.text, "(Note)");

  model.cycleSelectedInline();
  assertEquals(model.projection.text, "Note");
  assertEquals({ type: note.type, bracket: note.bracket, x: note.x }, { type: "text", bracket: undefined, x: 0 });
});

Deno.test("trace model: cycles stack direction and horizontal spread", () => {
  const model = createModel(`\
┌─────┐
│  A  ├┐
└┬────┘├┐
 └┬────┘│
  └─────┘`);
  const box = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });
  model.setSelection([box]);
  model.cycleSelectedBoxStack();
  assertEquals(box.stack?.layers, 2);

  const layouts: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) {
    model.cycleSelectedBoxStack(true);
    layouts.push([box.stack!.dx, box.stack!.dy]);
    assertEquals([box.x, box.y], [0, 0]);
  }

  assertEquals(layouts, [[2, 1], [-1, 1], [-2, 1], [-1, -1], [-2, -1], [1, -1], [2, -1], [1, 1]]);
});

Deno.test("trace model: transient keyboard geometry emits one commit", () => {
  const model = createModel("A");
  const commits: boolean[] = [];
  model.subscribe((_model, event) => {
    if (event) commits.push(event.commit);
  });
  model.setSelection([findTrace(model.traceMap, { type: "text", x: 0, y: 0 })]);

  model.beginMapEdit();
  model.nudgeSelection(1, 0);
  model.nudgeSelection(1, 0);
  model.nudgeSelection(0, 1);
  assertEquals({ x: model.selection[0].x, y: model.selection[0].y }, { x: 2, y: 1 });

  model.finishMapEdit();
  assertEquals(commits.filter(Boolean).length, 1);
});

Deno.test("trace model: transient keyboard geometry can revert without a checkpoint", () => {
  const model = createModel("A");
  model.setSelection([findTrace(model.traceMap, { type: "text", x: 0, y: 0 })]);

  model.beginMapEdit();
  model.nudgeSelection(2, 1);
  model.cancelMapEdit();

  assertEquals(model.projection.text, "A");
  assertEquals(model.selection.length, 1);
});

Deno.test("trace model: transient map updates preserve the committed undo selection", () => {
  const source = "A   B";
  const model = createModel(source);
  model.setSelection([findTrace(model.traceMap, { type: "text", x: 0, y: 0 })]);

  model.beginMapEdit();
  for (let i = 0; i < 110; i++) model.nudgeSelection(0, 1);
  model.finishMapEdit();
  model.syncDocumentSource(source);

  assertEquals(model.selection.length, 1);
  assertEquals({ text: model.selection[0].text, x: model.selection[0].x, y: model.selection[0].y }, { text: "A", x: 0, y: 0 });
});

Deno.test("trace model: nudge and resize share one keyboard edit", () => {
  const source = `\
┌───┐
│ A │
└───┘`;
  const model = createModel(source);
  model.setSelection([findTrace(model.traceMap, { type: "box", x: 0, y: 0 })]);

  model.beginMapEdit();
  model.nudgeSelection(1, 0);
  model.resizeSelection(1, 0);
  model.finishMapEdit();

  assertEquals(model.projection.text === source, false);
});

Deno.test("trace model: resize continues past boxes already at minimum size", () => {
  const model = createModel(`\
┌┐  ┌─┐
└┘  └─┘`);
  const boxes = model.traceMap.traces.filter((trace) => trace.type === "box");
  model.setSelection(boxes);

  assertEquals(model.resizeSelection(-1, 0), true);
  assertEquals(boxes.map((box) => box.w), [2, 2]);
});

Deno.test("trace model: resize ignores non-boxes in a mixed selection", () => {
  const model = createModel(`\
┌─┐
└─┘

A --> B`);
  const box = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 3, startDir: Dir.W });
  const lineWidth = line.w;
  model.setSelection([box, line]);

  assertEquals(model.resizeSelection(1, 0), true);
  assertEquals(box.w, 4);
  assertEquals(line.w, lineWidth);
});

Deno.test("trace model: resizing selected cells moves a shared boundary once", () => {
  const model = createModel(`\
┌─────┬─────┐
│  A  │  B  │
└─────┴─────┘`);
  const cells = model.traceMap.traces.filter((trace) => trace.type === "grid-cell");
  model.setSelection(cells);

  assertEquals(model.resizeSelection(1, 0), true);
  assertEquals(cells.map((cell) => ({ x: cell.x, w: cell.w })), [{ x: 0, w: 8 }, { x: 7, w: 7 }]);
});

Deno.test("trace model: styling a selected grid parent changes its outer frame", () => {
  const model = createModel(`\
┌─────┬─────┐
│  A  │  B  │
└─────┴─────┘`);
  model.setSelection([findTrace(model.traceMap, { type: "box", x: 0, y: 0 })]);

  model.applyStyle({ weight: "bold" });

  assertEquals(model.projection.text, `\
┏━━━━━┯━━━━━┓
┃  A  │  B  ┃
┗━━━━━┷━━━━━┛`);
});

Deno.test("trace model: keyboard resize centers inline content", () => {
  const model = createModel("[Spirit]");
  model.setSelection([findTrace(model.traceMap, { type: "inline", x: 0, y: 0 })]);

  assertEquals(model.resizeSelection(2, 0), true);
  assertEquals(model.projection.text, "[ Spirit ]");
  assertEquals(model.resizeSelection(0, 1), false);
});

Deno.test("trace model: subscribers distinguish transient and committed changes", () => {
  const model = createModel("A");
  const events: Array<boolean | undefined> = [];
  const unsubscribe = model.subscribe((_model, event) => events.push(event?.commit));

  model.setSelection([findTrace(model.traceMap, { type: "text", x: 0, y: 0 })]);
  model.applySource("B");
  unsubscribe();
  model.applySource("C");

  assertEquals(events, [undefined, false, true]);
});

Deno.test("trace model: labels can be created, edited, and removed through their owner", () => {
  const model = createModel(`\
┌───────┐
│       │
└───────┘`);
  const box = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });
  model.setSelection([box]);

  model.applyLabel("One");
  assertEquals(box.rawLabels?.[0].text, "One");

  model.applyLabel("Two");
  assertEquals(box.rawLabels?.[0].text, "Two");

  model.applyLabel("");
  assertEquals(box.rawLabels, []);
});

Deno.test("trace model: attached labels can be edited and removed directly", () => {
  const model = createModel(`\
┌─Top─┐
│     │
└─────┘`);
  const label = findTrace(model.traceMap, { type: "label", x: 2, y: 0 });
  model.setSelection([label]);

  model.applyLabel("New");
  assertEquals(label.text, "New");

  model.applyLabel("");
  assertEquals(model.traceMap.traces.includes(label), false);
});

Deno.test("trace model: applyLabel edits standalone text", () => {
  const model = createModel("A");
  model.setSelection([findTrace(model.traceMap, { type: "text", x: 0, y: 0 })]);

  model.applyLabel("B");

  assertEquals(model.projection.text, "B");
});

Deno.test("trace model: text editing reconciles inline node types on commit", () => {
  const model = createModel("Old");
  const trace = findTrace(model.traceMap, { type: "text", x: 0, y: 0 });

  model.applyLabel("[New]", trace);
  assertEquals({ type: trace.type, bracket: trace.bracket }, { type: "inline", bracket: "[]" });

  model.applyLabel("New", trace);
  assertEquals({ type: trace.type, bracket: trace.bracket }, { type: "text", bracket: undefined });
});

Deno.test("trace model: deleting a selected terminus clears its glyph but preserves the line", () => {
  const model = createModel("A ---> B");
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });
  model.setSelection([line.target!]);

  model.deleteSelected();

  assertEquals(line.target!.text, "");
  assertEquals(model.traceMap.traces.includes(line), true);
  assertEquals(model.selection, []);
});

Deno.test("trace model: deleting an open terminus resets it to a normal wire", () => {
  const model = createModel("╶──╴");
  const line = findTrace(model.traceMap, { type: "line", x: 0, y: 0, startDir: Dir.None });
  model.setSelection([line.source!]);

  model.deleteSelected();

  assertEquals(line.source!.dir, Dir.None);
  assertEquals(line.source!.recoilDir, Dir.W);
  assertEquals(model.projection.text, "───╴");
});

Deno.test("trace model: paste uses its anchor or places content after the selection", () => {
  const anchored = createModel("");
  anchored.pasteAnchor = { x: 4, y: 2 };
  assertEquals(anchored.pasteText("A"), true);
  findTrace(anchored.traceMap, { type: "text", x: 4, y: 2 });

  const relative = createModel("A");
  relative.setSelection([findTrace(relative.traceMap, { type: "text", x: 0, y: 0 })]);
  assertEquals(relative.pasteText("B"), true);
  findTrace(relative.traceMap, { type: "text", x: 3, y: 0 });

  assertEquals(relative.pasteText("   "), false);
});

Deno.test("trace model: applying source replaces the document", () => {
  const model = createModel("A");

  model.applySource("B");
  assertEquals(model.projection.text, "B");
});

Deno.test("trace model: syncing source changes preserves selection", () => {
  const model = createModel("A");
  model.setSelection([findTrace(model.traceMap, { type: "text", x: 0, y: 0 })]);

  model.syncDocumentSource("B");
  assertEquals(model.selection.length, 1);
  assertEquals(model.selection[0].text, "B");

  model.syncDocumentSource("A");
  assertEquals(model.projection.text, "A");
  assertEquals(model.selection.length, 1);
  assertEquals(model.selection[0].text, "A");
});

Deno.test("trace model: syncing map source preserves legend selection", () => {
  const model = createModel("A\n:legend\n[A]: blue");
  model.selectAll();

  model.syncDocumentSource("B\n:legend\n[B]: blue");

  assertEquals(model.legendSelected, true);

  model.syncDocumentSource("C");

  assertEquals(model.legendSelected, false);
});

Deno.test("trace model: setting legend selection notifies subscribers", () => {
  const model = createModel("A\n:legend\n[A]: blue");
  const events: Array<boolean | undefined> = [];
  model.subscribe((_model, event) => events.push(event?.commit));

  model.legendSelected = true;

  assertEquals(model.legendSelected, true);
  assertEquals(events, [undefined, false]);
});

Deno.test("trace model: document selection copies authored map content", () => {
  const source = `\
┌───┐
│ A │
└───┘`;
  const model = createModel(source);

  model.selectAll();

  assertEquals(model.getClipboardText(), source);
});

Deno.test("trace model: select all includes the complete document", () => {
  const source = `\
┌───┐
│ A │
└───┘
:legend
[A]: blue`;
  const document = new ToposDocument(source);
  const model = new EditorModel(document);

  model.selectAll();

  assertEquals(model.legendSelected, true);
  assertEquals(model.getClipboardText(), source);
});

Deno.test("trace model: trace selection excludes offsets and legend", () => {
  const document = new ToposDocument(`\

  ┌───┐
  │ A │
  └───┘
:legend
[A]: blue`);
  const model = new EditorModel(document);

  model.selectAll(false);
  assertEquals(model.legendSelected, false);
  assertEquals(model.getClipboardText(), `┌───┐\n│ A │\n└───┘`);

  model.selectAll();
  model.setSelection([...model.selection]);
  assertEquals(model.legendSelected, false);
  assertEquals(model.getClipboardText(), `┌───┐\n│ A │\n└───┘`);
});

Deno.test("trace model: cutting document selection removes map and legend together", () => {
  const source = `\
┌───┐
│ A │
└───┘
:legend
[A]: blue`;
  const document = new ToposDocument(source);
  const model = new EditorModel(document);
  model.selectAll();

  assertEquals(model.cutClipboardText(), source);
  assertEquals(model.projection.text, "");
  assertEquals(document.source, "");
  assertEquals(model.legendSelected, false);

});

Deno.test("editor model: legend editing previews live and emits one commit", () => {
  const source = `\
A
:legend
[A]: blue`;
  const document = new ToposDocument(source);
  const model = new EditorModel(document);
  const events: Array<boolean | undefined> = [];
  model.subscribe((_model, event) => events.push(event?.commit));

  model.updateLegendSource({ text: ":legend\n[A]: red", lines: [":legend", "[A]: red"] });
  model.updateLegendSource({ text: ":legend\n[A]: green", lines: [":legend", "[A]: green"] });

  assertEquals(document.legendSource, ":legend\n[A]: green");
  model.updateLegendSource({ text: ":legend\n[A]: green", lines: [":legend", "[A]: green"] }, true);

  assertEquals(events, [undefined, false, false, true]);
});

Deno.test("trace model: cutting all traces returns projected map content", () => {
  const model = createModel(`\
┌───┐
│ A │
└───┘`);
  model.selectAll();

  assertEquals(model.cutClipboardText(), `┌───┐\n│ A │\n└───┘`);
});

Deno.test("trace model: deleting a selected box grid removes its cells", () => {
  const model = createModel(`\
┌─────────┬─────────┐
│  Box A  │  Box B  │
├─────────┼─────────┤
│  Box C  │  Box D  │
└─────────┴─────────┘`);

  model.selectAll(false);

  assertEquals(model.selection.map(({ type }) => type), ["box", "text", "text", "text", "text"]);
  assertEquals(model.isAllSelected(), true);

  model.deleteSelected();

  assertEquals(model.traceMap.traces, []);
  assertEquals(model.projection.text, "");
});

Deno.test("trace model: duplicate repeats the adjusted group displacement", () => {
  const model = createModel(`\
┌─┐  ┌──┐
│A│  │ B│
└─┘  └──┘`);
  model.selectAll();

  model.duplicateSelection(1, 0);
  model.nudgeSelection(3, 2);
  model.finishMapEdit();
  assertEquals(traceSelectionBounds(model.traceMap, model.selection), { x: 14, y: 2, w: 9, h: 3 });

  model.duplicateSelection(1, 0);
  assertEquals(traceSelectionBounds(model.traceMap, model.selection), { x: 28, y: 4, w: 9, h: 3 });
});

Deno.test("trace model: duplicate places selection in cardinal directions", () => {
  const cases = [
    { delta: { x: -1, y: 0 }, expected: { x: -7, y: 0, w: 5, h: 3 } },
    { delta: { x: 1, y: 0 }, expected: { x: 7, y: 0, w: 5, h: 3 } },
    { delta: { x: 0, y: -1 }, expected: { x: 0, y: -4, w: 5, h: 3 } },
    { delta: { x: 0, y: 1 }, expected: { x: 0, y: 4, w: 5, h: 3 } },
  ];

  for (const { delta, expected } of cases) {
    const model = createModel(`\
┌───┐
│ A │
└───┘`);
    model.selectAll();
    model.duplicateSelection(delta.x, delta.y);
    assertEquals(traceSelectionBounds(model.traceMap, model.selection), expected);
  }
});

Deno.test("trace model: retrace rebuilds the model from its projected text", () => {
  const model = createModel(`\
┌───┐
│ A │
└───┘`);
  const originalBox = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });

  model.retrace();

  const retracedBox = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });
  assertEquals(retracedBox === originalBox, false);
  assertEquals(model.projection.text, `┌───┐\n│ A │\n└───┘`);
});

Deno.test("trace model: retrace collapses overlapping boxes to parser output", () => {
  const model = createModel("");
  model.command((m) => {
    createBox(m.traceMap, { x: 0, y: 0, w: 7, h: 3 });
    const overlapping = createBox(m.traceMap, { x: 8, y: 0, w: 7, h: 3 });
    moveTraces(m.traceMap, [overlapping], -4, 1);
    m.selection = [overlapping];
  });
  assertEquals(model.traceMap.traces.filter((trace) => trace.type === "box").length, 2);
  model.setSelection(null);

  model.retrace();

  assertEquals(model.traceMap.traces.filter((trace) => trace.type === "box").length, 1);
  assertEquals(model.selection.length, 0);
});
