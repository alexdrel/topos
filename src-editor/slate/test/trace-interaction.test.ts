import { assertEquals } from "@std/assert";
import { Dir, type Loc } from "../../../src/geo.ts";
import { findTrace, matchTraceMap } from "../../../src/trace/test/trace-utils.ts";
import type { TraceBox } from "../../../src/trace/types.ts";
import { ToposDocument } from "../../model/document.ts";
import { EditorModel } from "../model.ts";
import type { PointerInput } from "../interact.ts";
import * as interactions from "../trace-interaction.ts";
import { isSelectionArea } from "../../model/selection.ts";

function createModel(source: string): EditorModel {
  return new EditorModel(new ToposDocument(source));
}

function pointerInput(x: number, y: number): PointerInput {
  return {
    cell: { x, y },
    stepDelta: { x: 0, y: 0 },
    dragDelta: { x: 0, y: 0 },
    startCell: { x, y },
    shift: false,
    mod: false,
    alt: false,
    hasMoved: false,
  };
}

Deno.test("trace interaction: clicking a selected line endpoint selects its terminus", () => {
  const model = createModel(`A ───▶ B`);
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });
  const target = line.target!;
  const interaction = interactions.linePointInteraction(line, 1, target);

  const result = interaction.onUp!({
    cell: { x: target.x, y: target.y },
    stepDelta: { x: 0, y: 0 },
    dragDelta: { x: 0, y: 0 },
    startCell: { x: target.x, y: target.y },
    shift: false,
    mod: false,
    alt: false,
    hasMoved: false,
  }, model);

  assertEquals(result, [target]);
});

Deno.test("trace interaction: box and terminus selection constrains endpoint movement to its line", () => {
  const model = createModel(`\
┌───┐
│ A ├──▶ B
└───┘`);
  const box = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });
  const line = findTrace(model.traceMap, { type: "line", x: 4, y: 1, startDir: Dir.None });
  const source = line.source!;
  const interaction = interactions.moveTraceInteraction([box, source], box);

  interaction.onMove!({
    cell: { x: 0, y: 1 },
    stepDelta: { x: 0, y: 1 },
    dragDelta: { x: 0, y: 1 },
    startCell: { x: 0, y: 0 },
    shift: false,
    mod: false,
    alt: false,
    hasMoved: true,
  }, model);
  interaction.onMove!({
    cell: { x: 0, y: 2 },
    stepDelta: { x: 0, y: 1 },
    dragDelta: { x: 0, y: 2 },
    startCell: { x: 0, y: 0 },
    shift: false,
    mod: false,
    alt: false,
    hasMoved: true,
  }, model);

  assertEquals(box.y, 2);
  assertEquals({ x: source.x, y: source.y }, { x: 4, y: 1 });
});

Deno.test("selection move area includes a selected box interior", () => {
  const model = createModel(`\
┌───┐
│   │
└───┘`);
  const box = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });

  assertEquals(isSelectionArea([box], { x: 2, y: 1 }), true);
});

Deno.test("selection move area excludes gaps between selected boxes", () => {
  const model = createModel(`\
┌─┐   ┌─┐
│ │   │ │
└─┘   └─┘`);
  const left = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });
  const right = findTrace(model.traceMap, { type: "box", x: 6, y: 0 });

  assertEquals(isSelectionArea([left, right], { x: 4, y: 1 }), false);
});

Deno.test("selection move area excludes empty space inside a selected line's bounds", () => {
  const model = createModel(`\
A ┐
  │
  └─ B`);
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });

  assertEquals(isSelectionArea([line], { x: 3, y: 1 }), false);
});

Deno.test("move started from forgiving selection area preserves selection without a drag", () => {
  const model = createModel("A ─── B");
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });
  model.setSelection([line, line.source!]);
  const selectionBeforeClick = [...model.selection];

  const result = interactions.moveTraceInteraction([...model.selection]).onUp!(pointerInput(3, 1), model);

  assertEquals(result, undefined);
  assertEquals(model.selection, selectionBeforeClick);
});

Deno.test("trace interaction: a box style selected in QI becomes the creation default", () => {
  const model = createModel(`\
┌───┐
│ A │
└───┘`);
  const box = findTrace(model.traceMap, { type: "box", x: 0, y: 0 });
  model.setSelection([box]);
  model.applyStyle({ weight: "double" });

  interactions.createBoxInteraction().onUp!(pointerInput(0, 4), model);

  matchTraceMap(model.traceMap, `\
╔═══╗
║ A ║
╚═══╝

╔════════╗
║        ║
╚════════╝`);
});

Deno.test("trace interaction: line style and arrowhead selected in QI become creation defaults", () => {
  const model = createModel("A ---> B");
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });
  model.setSelection([line]);
  model.applyStyle({ weight: "double" });
  model.setSelection([line.target!]);
  model.applyTerminusGlyph(">");

  interactions.createLineInteraction().onUp!(pointerInput(0, 2), model);

  matchTraceMap(model.traceMap, `\
A ===> B

=====>`);
});

Deno.test("trace interaction: Alt-drag line creation selects the head terminus", () => {
  const model = createModel("");
  const interaction = interactions.createLineInteraction(true);
  const move = pointerInput(6, 0);
  move.startCell = { x: 0, y: 0 };
  move.stepDelta = { x: 6, y: 0 };
  move.dragDelta = { x: 6, y: 0 };
  move.hasMoved = true;
  move.alt = true;

  interaction.onMove!(move, model);
  const result = interaction.onUp!(move, model);
  const [head] = result ?? [];

  assertEquals(head?.type, "terminus");
  assertEquals(head?.parent?.type, "line");
  assertEquals(head?.parent?.target, head);
});

Deno.test("trace interaction: a hub glyph selected in QI becomes the creation default", () => {
  const model = createModel("●");
  const hub = findTrace(model.traceMap, { type: "hub", x: 0, y: 0 });
  model.setSelection([hub]);
  model.applyHubGlyph("◎");

  interactions.createHubInteraction().onUp!(pointerInput(3, 0), model);

  matchTraceMap(model.traceMap, "◎  ◎");
});

Deno.test("trace interaction: hub tool follows a drag", () => {
  const model = createModel("");
  const interaction = interactions.createHubInteraction();
  const drag = pointerInput(4, 2);
  drag.startCell = { x: 0, y: 0 };
  drag.stepDelta = { x: 4, y: 2 };
  drag.hasMoved = true;

  const [draft] = interaction.onMove!(drag, model) as TraceBox[];
  assertEquals({ type: draft?.type, x: draft?.x, y: draft?.y }, { type: "hub", x: 4, y: 2 });
  const [hub] = interaction.onUp!(drag, model) ?? [];

  assertEquals({ type: hub?.type, x: hub?.x, y: hub?.y }, { type: "hub", x: 4, y: 2 });
});

Deno.test("trace interaction: box tool maintains an always-valid draft", () => {
  const model = createModel("");
  const create = interactions.createBoxInteraction();
  model.beginMapEdit();
  const drag = pointerInput(4, 2);
  drag.startCell = { x: 0, y: 0 };
  drag.hasMoved = true;
  let [draft] = create.onMove!(drag, model) as TraceBox[];
  assertEquals(draft.type, "box");
  assertEquals({ x: draft.x, y: draft.y, w: draft.w, h: draft.h }, { x: 0, y: 0, w: 5, h: 3 });

  const thin = pointerInput(5, 0);
  thin.startCell = { x: 0, y: 0 };
  [draft] = create.onMove!(thin, model) as TraceBox[];
  assertEquals({ w: draft.w, h: draft.h }, { w: 6, h: 2 });

  const farther = pointerInput(5, 3);
  farther.startCell = { x: 0, y: 0 };
  create.onMove!(farther, model);
  const [box] = create.onUp!(farther, model) ?? [];
  model.finishMapEdit();

  assertEquals({ w: box?.w, h: box?.h }, { w: 6, h: 4 });
});

Deno.test("trace interaction: structure drag switches among valid hubs, lines, and boxes", () => {
  const model = createModel("");
  const create = interactions.createStructureInteraction(() => []);
  const move = (input: PointerInput) => (create.onMove!(input, model) as TraceBox[])[0];

  const horizontal = pointerInput(4, 0);
  horizontal.startCell = { x: 0, y: 0 };
  horizontal.dragDelta = { x: 4, y: 0 };
  let draft = move(horizontal);
  assertEquals(draft.type, "line");
  assertEquals(draft.path?.length, 5);

  const returned = pointerInput(0, 0);
  draft = move(returned);
  assertEquals(draft.type, "hub");
  assertEquals(model.traceMap.traces.length, 1);

  draft = move(horizontal);
  assertEquals(draft.type, "line");

  const box = pointerInput(4, 2);
  box.startCell = { x: 0, y: 0 };
  box.dragDelta = { x: 4, y: 2 };
  draft = move(box);
  assertEquals(draft.type, "box");
  assertEquals({ w: draft.w, h: draft.h }, { w: 5, h: 3 });

  const vertical = pointerInput(0, 3);
  vertical.startCell = { x: 0, y: 0 };
  vertical.dragDelta = { x: 0, y: 3 };
  draft = move(vertical);
  assertEquals(draft.type, "line");
  assertEquals(model.traceMap.traces.filter((trace) => trace.type === "box").length, 0);
  assertEquals(model.traceMap.traces.filter((trace) => trace.type === "hub").length, 0);

  draft = move(returned);
  assertEquals(draft.type, "hub");

  move(horizontal);
  draft = move(vertical);
  assertEquals(draft.path?.length, 4);
});

Deno.test("trace interaction: dragging an inline handle rewrites centered padding", () => {
  const model = createModel("[Spirit]");
  const inline = findTrace(model.traceMap, { type: "inline", x: 0, y: 0 });
  const resize = interactions.resizeTraceInteraction(inline, "e");
  const drag = pointerInput(15, 0);
  drag.hasMoved = true;

  resize.onMove!(drag, model);
  resize.onMove!(drag, model);

  assertEquals(model.projection.text, "[    Spirit    ]");
});

Deno.test("trace interaction: dragging a grid row handle resizes all selected cells", () => {
  const model = createModel(`\
┌─────┬─────┐
│     │     │
│     │     │
├─────┼─────┤
│     │     │
│     │     │
└─────┴─────┘`);
  const topRow = model.traceMap.traces.filter((trace) => trace.type === "grid-cell" && trace.y === 0);
  const resize = interactions.resizeGridCellsInteraction(topRow, "s");
  const drag = pointerInput(6, 4);
  drag.hasMoved = true;

  resize.onMove!(drag, model);

  matchTraceMap(model.traceMap, `\
┌─────┬─────┐
│     │     │
│     │     │
│     │     │
├─────┼─────┤
│     │     │
└─────┴─────┘`);
});

Deno.test("trace interaction: text tool starts editing without creating a draft", () => {
  const model = createModel("");
  let editCell: Loc | undefined;

  const interaction = interactions.createTextInteraction((cell) => editCell = cell);
  assertEquals(interaction.onDown, undefined);
  const result = interaction.onUp!(pointerInput(3, 2), model);

  assertEquals(result, undefined);
  assertEquals(editCell, { x: 3, y: 2 });
  assertEquals(model.traceMap.traces, []);
});

Deno.test("trace interaction: glyph tool creates selected text on mouse-up", () => {
  const model = createModel("");

  const [glyph] = interactions.createGlyphInteraction("●").onUp!(pointerInput(3, 2), model) ?? [];

  assertEquals({ type: glyph?.type, text: glyph?.text, x: glyph?.x, y: glyph?.y }, {
    type: "text",
    text: "●",
    x: 3,
    y: 2,
  });
});

Deno.test("trace interaction: gesture click creates a hub while tool click creates a line", () => {
  const hubModel = createModel("");
  const hubClick = pointerInput(2, 1);
  const [hub] = interactions.createLineInteraction(true).onUp!(hubClick, hubModel) ?? [];
  assertEquals(hub?.type, "hub");

  const lineModel = createModel("");
  const toolClick = pointerInput(2, 1);
  const [line] = interactions.createLineInteraction().onUp!(toolClick, lineModel) ?? [];
  assertEquals(line?.type, "line");
});

Deno.test("trace interaction: moving a trace commits once and clicking selects the hit trace", () => {
  const model = createModel("A");
  const text = findTrace(model.traceMap, { type: "text", x: 0, y: 0 });
  const interaction = interactions.moveTraceInteraction([text], text);
  const drag = pointerInput(2, 1);
  drag.stepDelta = { x: 2, y: 1 };
  drag.dragDelta = { x: 2, y: 1 };
  drag.hasMoved = true;

  model.beginMapEdit();
  interaction.onMove!(drag, model);
  interaction.onUp!(drag, model);
  model.finishMapEdit();
  assertEquals({ x: text.x, y: text.y }, { x: 2, y: 1 });

  assertEquals(interactions.moveTraceInteraction([text], text).onUp!(pointerInput(2, 1), model), [text]);
});

Deno.test("trace interaction: partial selection can expand the map left and up", () => {
  const model = createModel("A    B");
  const left = findTrace(model.traceMap, { type: "text", x: 0, y: 0 });
  model.setSelection([left]);
  const interaction = interactions.moveTraceInteraction([left], left);
  const outside = pointerInput(-4, -3);
  outside.stepDelta = outside.dragDelta = { x: -4, y: -3 };

  interaction.onMove!(outside, model);

  assertEquals({ x: left.x, y: left.y }, { x: -4, y: -3 });
});

Deno.test("trace interaction: moving beyond a tear follows both drag axes", () => {
  const vertical = createModel(`\
A

B`);
  const down = pointerInput(0, 3);
  down.startCell = { x: 0, y: 1 };
  down.stepDelta = down.dragDelta = { x: 0, y: 2 };
  down.hasMoved = true;
  interactions.spaceTearInteraction({ charWidth: 10, charHeight: 20 }, () => ({ x: 0, y: 0 })).onMove!(down, vertical);
  matchTraceMap(vertical.traceMap, `\
A



B`);

  const horizontal = createModel("A   B");
  const right = pointerInput(4, 0);
  right.startCell = { x: 2, y: 0 };
  right.stepDelta = right.dragDelta = { x: 2, y: 0 };
  right.hasMoved = true;
  interactions.spaceTearInteraction({ charWidth: 10, charHeight: 20 }, () => ({ x: 0, y: 0 })).onMove!(right, horizontal);
  matchTraceMap(horizontal.traceMap, "A     B");

  const diagonal = createModel(`\
    R

D   B`);
  const across = pointerInput(4, 3);
  across.startCell = { x: 2, y: 1 };
  across.stepDelta = across.dragDelta = { x: 2, y: 2 };
  across.hasMoved = true;
  const tear = interactions.spaceTearInteraction(
    { charWidth: 10, charHeight: 20 },
    () => ({ x: 0, y: 0 }),
  );
  tear.onMove!(across, diagonal);
  assertEquals(tear.overlayElements?.map((element) => element[1]), [
    { x: 30, y: "calc(-1 * var(--slate-padding))", width: 20, height: "calc(100% + 2 * var(--slate-padding))", "data-role": "tear-positive" },
    { x: "calc(-1 * var(--slate-padding))", y: 40, width: "calc(30px + var(--slate-padding))", height: 40, "data-role": "tear-positive" },
    { x: 50, y: 40, width: "calc(100% + var(--slate-padding) - 50px)", height: 40, "data-role": "tear-positive" },
  ]);
  matchTraceMap(diagonal.traceMap, `\
      R



D     B`);

  const edge = createModel("A");
  const fromPadding = pointerInput(0, 0);
  fromPadding.startCell = { x: -1, y: 0 };
  fromPadding.hasMoved = true;
  const edgeTear = interactions.spaceTearInteraction({ charWidth: 10, charHeight: 20 }, () => ({ x: 0, y: 0 }));
  edgeTear.onMove!(fromPadding, edge);
  assertEquals(edgeTear.overlayElements?.[0][1], {
    x: "calc(-1 * var(--slate-padding))",
    y: "calc(-1 * var(--slate-padding))",
    width: "calc(10px + var(--slate-padding))",
    height: "calc(100% + 2 * var(--slate-padding))",
    "data-role": "tear-positive",
  });
  matchTraceMap(edge.traceMap, " A");

  const offset = createModel("A");
  const offsetText = findTrace(offset.traceMap, { type: "text", x: 0, y: 0 });
  offset.setSelection([offsetText]);
  offset.nudgeSelection(-4, 0);
  const pastVisualZero = pointerInput(-10, 0);
  pastVisualZero.startCell = { x: -5, y: 0 };
  pastVisualZero.hasMoved = true;
  interactions.spaceTearInteraction({ charWidth: 10, charHeight: 20 }, () => offset.projection.offset).onMove!(pastVisualZero, offset);
  assertEquals(offsetText.x, -4);
});

Deno.test("trace interaction: marquee renders, selects, adds, subtracts, and handles plain clicks", () => {
  const model = createModel("A   B");
  const left = findTrace(model.traceMap, { type: "text", x: 0, y: 0 });
  const right = findTrace(model.traceMap, { type: "text", x: 4, y: 0 });
  let clicked: Loc | undefined;
  const marquee = interactions.marqueeInteraction((cell) => clicked = cell, { charWidth: 10, charHeight: 20 }, () => ({ x: 0, y: 0 }));
  assertEquals(marquee.overlayElements, undefined);

  const move = pointerInput(1, 0);
  move.startCell = { x: 0, y: 0 };
  move.hasMoved = true;
  assertEquals(marquee.onMove!(move, model), true);
  assertEquals(marquee.overlayElements?.[0][1]["data-role"], "marquee");
  assertEquals(marquee.overlayElements?.[0][1]["data-operation"], "replace");
  assertEquals(marquee.onUp!(move, model), [left]);

  model.setSelection([left]);
  const additive = pointerInput(4, 0);
  additive.startCell = { x: 4, y: 0 };
  additive.hasMoved = true;
  additive.shift = true;
  marquee.onMove!(additive, model);
  assertEquals(marquee.overlayElements?.[0][1]["data-operation"], "add");
  assertEquals(marquee.onUp!(additive, model), [left, right]);

  model.setSelection([left, right]);
  const subtractive = { ...move, shift: true, alt: true };
  marquee.onMove!(subtractive, model);
  assertEquals(marquee.overlayElements?.[0][1]["data-operation"], "subtract");
  assertEquals(marquee.onUp!(subtractive, model), [right]);

  const click = pointerInput(7, 3);
  marquee.onUp!(click, model);
  assertEquals(clicked, { x: 7, y: 3 });

  click.shift = true;
  clicked = undefined;
  marquee.onUp!(click, model);
  assertEquals(clicked, undefined);
});

Deno.test("trace interaction: moving line vertices commits endpoint and turn edits", () => {
  const model = createModel(`\
A ───┐
     │
     ▼`);
  const line = findTrace(model.traceMap, { type: "line", x: 2, y: 0, startDir: Dir.W });

  const endMove = pointerInput(7, 2);
  endMove.hasMoved = true;
  const endpoint = interactions.linePointInteraction(line, 2);
  model.beginMapEdit();
  endpoint.onMove!(endMove, model);
  endpoint.onUp!(endMove, model);
  model.finishMapEdit();
  assertEquals({ x: line.target?.x, y: line.target?.y }, { x: 7, y: 2 });

  const turnMove = pointerInput(4, 1);
  turnMove.hasMoved = true;
  const turn = interactions.linePointInteraction(line, 1);
  model.beginMapEdit();
  turn.onMove!(turnMove, model);
  turn.onUp!(turnMove, model);
  assertEquals(model.finishMapEdit(), true);
});
