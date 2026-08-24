import type { Loc } from "../../src/geo.ts";
import type { TraceBox } from "../../src/trace/types.ts";
import type { XmlEl } from "../../src/jsonml/jsonml.ts";
import type { EditorModel } from "./model.ts";
import { cellFromEvent, type GridMetrics } from "./grid.ts";
import { isModKey } from "./dom.ts";

export interface PointerInput {
  cell: Loc;
  stepDelta: Loc;
  dragDelta: Loc;
  shift: boolean;
  mod: boolean;
  alt: boolean;
  startCell: Loc;
  hasMoved: boolean;
}

export interface Interaction {
  cursor?: string;
  overlayElements?: XmlEl[];
  onDown?(input: PointerInput, model: EditorModel): false | void;
  onMove?(input: PointerInput, model: EditorModel): true | TraceBox[] | void;
  onUp?(input: PointerInput, model: EditorModel): TraceBox[] | void;
}

export interface InteractionHost {
  model: EditorModel;
  gridEl: HTMLElement;
  readonly metrics: GridMetrics;
  setInlineEditing(active: boolean): void;
  render(): void;
  updateCursor(): void;
}

export interface InteractionController {
  current(): Interaction | null;
  hasMoved(): boolean;
  pointerCoords(): Loc | null;
  set(interaction: Interaction | null): void;
  cancel(): void;
  dispatch(method: InteractionMethod, input: PointerInput): boolean | TraceBox[] | void;
  startDrag(event: MouseEvent): void;
  onMouseDown(event: MouseEvent): boolean;
  start(interaction: Interaction, event: MouseEvent): void;
}

type InteractionMethod = "onDown" | "onMove" | "onUp";

export function createInteractionController(host: InteractionHost): InteractionController {
  let current: Interaction | null = null;
  let lastCell: Loc = { x: 0, y: 0 };
  let startCell: Loc = { x: 0, y: 0 };
  let hasMoved = false;
  let dragActive = false;
  let dragOffset: Loc | null = null;
  let pointerCoords: Loc | null = null;

  function set(interaction: Interaction | null) {
    current = interaction;
    hasMoved = false;
    startCell = lastCell;
    host.updateCursor();
    host.render();
  }

  function finish() {
    host.model.finishMapEdit();
    current = null;
    hasMoved = false;
    host.updateCursor();
    host.render();
    endDrag();
  }

  function cancel() {
    host.model.cancelMapEdit();
    set(null);
    endDrag();
  }

  function makePointerInput(event: MouseEvent): PointerInput {
    const cell = cellFromEvent(event, host.gridEl, host.metrics, dragOffset ?? host.model.projection.offset);
    return {
      cell,
      stepDelta: { x: cell.x - lastCell.x, y: cell.y - lastCell.y },
      dragDelta: { x: cell.x - startCell.x, y: cell.y - startCell.y },
      shift: event.shiftKey,
      mod: isModKey(event),
      alt: event.altKey,
      startCell,
      hasMoved,
    };
  }

  function dispatch(method: InteractionMethod, input: PointerInput): boolean | TraceBox[] | void {
    if (!current) return undefined;
    const handler = current[method];

    if (method === "onDown") {
      host.model.beginMapEdit();
      startCell = input.cell;
      input.startCell = startCell;
    }

    if (method === "onMove") {
      if (input.stepDelta.x === 0 && input.stepDelta.y === 0) return undefined;
      hasMoved = true;
    }

    const result = handler?.(input, host.model);
    if (method === "onMove") {
      host.updateCursor();
      if (result === true) host.render();
      else if (Array.isArray(result)) host.model.setSelection(result);
    } else if (method === "onUp") {
      if (Array.isArray(result)) host.model.setSelection(result);
      finish();
    }
    return result;
  }

  function rememberCell(input: PointerInput) {
    lastCell = input.cell;
  }

  function startDrag(event: MouseEvent) {
    if (dragActive) return;
    pointerCoords = { x: event.clientX, y: event.clientY };
    host.model.beginMapEdit();
    dragActive = true;
    dragOffset = { ...host.model.projection.offset };
    globalThis.addEventListener("mousemove", onGlobalMouseMove);
    globalThis.addEventListener("mouseup", onGlobalMouseUp);
  }

  function endDrag() {
    if (!dragActive) return;
    dragActive = false;
    dragOffset = null;
    globalThis.removeEventListener("mousemove", onGlobalMouseMove);
    globalThis.removeEventListener("mouseup", onGlobalMouseUp);
  }

  function onGlobalMouseMove(event: MouseEvent) {
    const input = makePointerInput(event);
    dispatch("onMove", input);
    rememberCell(input);
  }

  function onGlobalMouseUp(event: MouseEvent) {
    pointerCoords = { x: event.clientX, y: event.clientY };
    const input = makePointerInput(event);
    dispatch("onUp", input);
    rememberCell(input);
    endDrag();
  }

  function onMouseDown(event: MouseEvent): boolean {
    if (event.button !== 0) return false;
    pointerCoords = { x: event.clientX, y: event.clientY };
    const input = makePointerInput(event);
    rememberCell(input);
    if (!current) return false;

    const downResult = dispatch("onDown", input);
    if (downResult === false) return false;
    if (current) startDrag(event);
    return true;
  }

  function start(interaction: Interaction, event: MouseEvent) {
    set(interaction);
    const input = makePointerInput(event);
    rememberCell(input);
    dispatch("onDown", input);
  }

  return {
    current: () => current,
    hasMoved: () => hasMoved,
    pointerCoords: () => pointerCoords,
    set,
    cancel,
    dispatch,
    startDrag,
    onMouseDown,
    start,
  };
}
