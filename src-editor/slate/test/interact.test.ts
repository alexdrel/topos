import { assertEquals } from "@std/assert";
import type { Loc } from "../../../src/geo.ts";
import type { EditorModel } from "../model.ts";
import { createInteractionController, type Interaction, type InteractionHost, type PointerInput } from "../interact.ts";

const input: PointerInput = {
  cell: { x: 0, y: 0 },
  stepDelta: { x: 0, y: 0 },
  dragDelta: { x: 0, y: 0 },
  startCell: { x: 0, y: 0 },
  shift: false,
  mod: false,
  alt: false,
  hasMoved: false,
};

function setup() {
  let commits = 0;
  let reverts = 0;
  let renders = 0;
  let cursorUpdates = 0;
  let dirty = false;
  const selections: Array<Parameters<EditorModel["setSelection"]>[0]> = [];
  const model = {
    projection: { offset: { x: 0, y: 0 } },
    beginMapEdit() {
      dirty = false;
    },
    updateMap(fn: (model: EditorModel) => void | boolean) {
      if (fn(model as EditorModel) === false) return false;
      dirty = true;
      return true;
    },
    finishMapEdit() {
      if (dirty) commits++;
      dirty = false;
    },
    cancelMapEdit() {
      dirty = false;
      reverts++;
    },
    setSelection(selection: Parameters<EditorModel["setSelection"]>[0]) {
      selections.push(selection);
    },
  } as unknown as EditorModel;
  const host = {
    model,
    gridEl: {
      getBoundingClientRect: () => ({ left: 100, top: 200 }),
    } as HTMLElement,
    metrics: { charWidth: 1, charHeight: 1 },
    setInlineEditing() {},
    render() {
      renders++;
    },
    updateCursor() {
      cursorUpdates++;
    },
  } satisfies InteractionHost;

  return {
    controller: createInteractionController(host),
    commits: () => commits,
    reverts: () => reverts,
    renders: () => renders,
    cursorUpdates: () => cursorUpdates,
    selections,
  };
}

function mouseEvent(type: string, init: Partial<MouseEvent> = {}): MouseEvent {
  return Object.assign(new Event(type), {
    button: 0,
    clientX: 100,
    clientY: 200,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...init,
  }) as MouseEvent;
}

Deno.test("interaction: mouse-up finishes and commits an interaction", () => {
  const { controller, commits } = setup();
  const interaction: Interaction = {
    onUp(_input, model) {
      model.updateMap(() => {});
    },
  };

  controller.set(interaction);
  controller.dispatch("onUp", { ...input });

  assertEquals(commits(), 1);
  assertEquals(controller.current(), null);
});

Deno.test("interaction: an on-up mutation is not committed twice", () => {
  const { controller, commits } = setup();
  const interaction: Interaction = {
    onMove(_input, model) {
      model.updateMap(() => {});
    },
    onUp(_input, model) {
      model.updateMap(() => {});
    },
  };

  controller.set(interaction);
  controller.dispatch("onMove", { ...input, stepDelta: { x: 1, y: 0 }, dragDelta: { x: 1, y: 0 } });
  controller.dispatch("onUp", { ...input });

  assertEquals(commits(), 1);
});

Deno.test("interaction: cancel rolls back eligible interactions and clears controller state", () => {
  const { controller, reverts, renders, cursorUpdates } = setup();
  controller.set({});

  controller.cancel();

  assertEquals(reverts(), 1);
  assertEquals(controller.current(), null);
  assertEquals(renders(), 2);
  assertEquals(cursorUpdates(), 2);
});

Deno.test("interaction: dispatch ignores absent handlers and stationary moves", () => {
  const { controller } = setup();
  let moves = 0;

  assertEquals(controller.dispatch("onDown", { ...input }), undefined);
  controller.set({
    onMove() {
      moves++;
    },
  });
  assertEquals(controller.dispatch("onMove", { ...input }), undefined);
  assertEquals(moves, 0);
  assertEquals(controller.hasMoved(), false);
});

Deno.test("interaction: move requests rendering and mouse-up returns selection", () => {
  const { controller, selections, renders } = setup();
  controller.set({
    onMove() {
      return true;
    },
    onUp() {
      return [];
    },
  });

  controller.dispatch("onMove", { ...input, stepDelta: { x: 1, y: 0 } });
  controller.dispatch("onUp", { ...input });

  assertEquals(selections, [[]]);
  assertEquals(renders(), 3);
});

Deno.test("interaction: mouse gesture produces pointer deltas and ends on global mouse-up", () => {
  const { controller } = setup();
  const seen: PointerInput[] = [];
  controller.set({
    onDown(pointer) {
      seen.push({ ...pointer });
    },
    onMove(pointer) {
      seen.push({ ...pointer });
    },
    onUp(pointer) {
      seen.push({ ...pointer });
    },
  });

  assertEquals(controller.onMouseDown(mouseEvent("mousedown", { clientX: 105, clientY: 210, shiftKey: true, altKey: true })), true);
  assertEquals(controller.pointerCoords(), { x: 105, y: 210 });
  globalThis.dispatchEvent(mouseEvent("mousemove", { clientX: 108, clientY: 214 }));
  globalThis.dispatchEvent(mouseEvent("mouseup", { clientX: 110, clientY: 216 }));

  assertEquals(seen.map(({ cell, stepDelta, dragDelta, shift, alt, startCell, hasMoved }) => ({ cell, stepDelta, dragDelta, shift, alt, startCell, hasMoved })), [
    { cell: { x: 5, y: 10 }, stepDelta: { x: 5, y: 10 }, dragDelta: { x: 5, y: 10 }, shift: true, alt: true, startCell: { x: 5, y: 10 }, hasMoved: false },
    { cell: { x: 8, y: 14 }, stepDelta: { x: 3, y: 4 }, dragDelta: { x: 3, y: 4 }, shift: false, alt: false, startCell: { x: 5, y: 10 }, hasMoved: false },
    { cell: { x: 10, y: 16 }, stepDelta: { x: 2, y: 2 }, dragDelta: { x: 5, y: 6 }, shift: false, alt: false, startCell: { x: 5, y: 10 }, hasMoved: true },
  ]);
  assertEquals(controller.current(), null);
  assertEquals(controller.hasMoved(), false);
  assertEquals(controller.pointerCoords(), { x: 110, y: 216 });
});

Deno.test("interaction: pointer coordinates keep their projection frame during a drag", () => {
  const { controller } = setup();
  const cells: Loc[] = [];
  controller.set({
    onDown() {},
    onMove(pointer, model) {
      cells.push(pointer.cell);
      model.projection.offset = { x: 100, y: 100 };
    },
  });

  controller.onMouseDown(mouseEvent("mousedown", { clientX: 105, clientY: 210 }));
  globalThis.dispatchEvent(mouseEvent("mousemove", { clientX: 108, clientY: 214 }));
  globalThis.dispatchEvent(mouseEvent("mousemove", { clientX: 109, clientY: 215 }));
  globalThis.dispatchEvent(mouseEvent("mouseup", { clientX: 109, clientY: 215 }));

  assertEquals(cells, [{ x: 8, y: 14 }, { x: 9, y: 15 }]);
});

Deno.test("interaction: mouse start rejects secondary buttons and initializes a supplied interaction", () => {
  const { controller } = setup();
  assertEquals(controller.onMouseDown(mouseEvent("mousedown", { button: 1 })), false);

  let startCell = { x: -1, y: -1 };
  const interaction: Interaction = {
    onDown(pointer) {
      startCell = pointer.startCell;
    },
  };
  controller.start(interaction, mouseEvent("mousedown", { clientX: 107, clientY: 209 }));

  assertEquals(controller.current(), interaction);
  assertEquals(startCell, { x: 7, y: 9 });
  controller.cancel();
});

Deno.test("interaction: active interactions accept mouse-down unless explicitly rejected", () => {
  const { controller } = setup();
  controller.set({});
  assertEquals(controller.onMouseDown(mouseEvent("mousedown")), true);

  controller.cancel();
  controller.set({ onDown: () => false });
  assertEquals(controller.onMouseDown(mouseEvent("mousedown")), false);
});

Deno.test("interaction: inactive mouse-down seeds a subsequently installed drag", () => {
  const { controller } = setup();
  let startCell: Loc | undefined;
  const down = mouseEvent("mousedown", { clientX: 107, clientY: 209 });

  assertEquals(controller.onMouseDown(down), false);
  controller.set({
    onMove(pointer) {
      startCell = pointer.startCell;
    },
  });
  controller.startDrag(down);
  globalThis.dispatchEvent(mouseEvent("mousemove", { clientX: 110, clientY: 212 }));
  globalThis.dispatchEvent(mouseEvent("mouseup", { clientX: 110, clientY: 212 }));

  assertEquals(startCell, { x: 7, y: 9 });
});
