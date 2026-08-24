import { assertEquals } from "@std/assert";
import { ToposDocument } from "../../model/document.ts";
import { EditorModel } from "../../model/model.ts";
import { EditorHistory } from "../history.ts";
import { findTrace } from "../../../src/trace/test/trace-utils.ts";

Deno.test("editor host history returns complete source through host synchronization", () => {
  const model = new EditorModel(new ToposDocument("A"));
  const history = new EditorHistory(model);

  model.applySource("B\n:legend\n[B]: blue");
  assertEquals(history.canUndo, true);

  history.undo();
  assertEquals(model.document.source, "A");
  assertEquals(history.canRedo, true);

  history.redo();
  assertEquals(model.document.source, "B\n:legend\n[B]: blue");
});

Deno.test("editor host history records source edits and discards redo", () => {
  const model = new EditorModel(new ToposDocument("A"));
  const history = new EditorHistory(model);

  history.updateSource("B");
  history.commitSource();
  history.updateSource("C");
  history.commitSource();
  history.undo();
  history.updateSource("D");
  history.commitSource();

  assertEquals(model.document.source, "D");
  assertEquals(history.canRedo, false);
});

Deno.test("editor host undo restores the selection stored with its source", () => {
  const model = new EditorModel(new ToposDocument("A"));
  const history = new EditorHistory(model);
  const selected = findTrace(model.traceMap, { type: "text", x: 0, y: 0 });
  model.setSelection([selected]);

  model.deleteSelected();
  assertEquals(model.selection, []);

  history.undo();
  assertEquals(model.document.source, "A");
  assertEquals(model.selection.length, 1);
  assertEquals(model.selection[0].text, "A");
  assertEquals(model.traceMap.traces.includes(model.selection[0]), true);
});

Deno.test("editor host batches live source updates until commit", () => {
  const model = new EditorModel(new ToposDocument("A"));
  const history = new EditorHistory(model);

  history.updateSource("B");
  history.updateSource("BC");
  history.updateSource("BCD");
  assertEquals(history.canUndo, false);

  history.commitSource();
  history.undo();
  assertEquals(model.document.source, "A");
});

Deno.test("editor host history ignores unavailable moves and bounds its entries", () => {
  const model = new EditorModel(new ToposDocument("A"));
  const history = new EditorHistory(model, 2);

  history.undo();
  history.redo();
  history.commitSource();
  assertEquals(history.canUndo, false);

  history.updateSource("B");
  history.commitSource();
  history.updateSource("C");
  history.commitSource();

  history.undo();
  history.undo();
  assertEquals(model.document.source, "B");

  history.redo();
  history.redo();
  assertEquals(model.document.source, "C");
});
