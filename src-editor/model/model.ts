import { isAttachment, isBordered, supportsLabel, type TraceBox, type TraceMap } from "../../src/trace/types.ts";
import { DEFAULT_PEN, PenStyle } from "../../src/style.ts";
import { reconcileLabels } from "./mutate.ts";
import { normalizeTraceSelection } from "./selection.ts";
import * as mut from "./mutate.ts";
import { type ProjectionResult, projectTracesToGrid } from "../../src/ink/ink.ts";
import { traceMap } from "../../src/trace/trace-map.ts";
import { boundingRect, type Loc } from "../../src/geo.ts";
import { DEFAULT_STACK } from "../../src/stacked-box.ts";
import { type TextLines, ToposDocument } from "./document.ts";

import { collectTraceClipboardSelection, insertTraceText, traceSelectionBounds, traceSelectionToText } from "./clipboard.ts";

export interface TraceModelState {
  traceMap: TraceMap;
  selection: TraceBox[];
  legendSelected: boolean;
  documentSelected: boolean;
}

type Listener = (model: EditorModel, event?: { commit: boolean }) => void;
const DUPLICATE_GAP: Loc = { x: 2, y: 1 };
const STACK_LAYOUTS = [[1, 1], [2, 1], [-1, 1], [-2, 1], [-1, -1], [-2, -1], [1, -1], [2, -1]] as const;

export class EditorModel {
  private state: TraceModelState;
  projection!: ProjectionResult;

  private listeners = new Set<Listener>();
  private mapStates = new Map<string, TraceModelState>();
  private mapEditBackup?: TraceModelState;
  private mapEditDirty = false;
  public pasteAnchor: Loc | null = null;
  private duplicatePattern?: {
    direction: Loc;
    source: Loc;
    selection: TraceBox[];
  };

  public defaultBoxStyle: PenStyle = { ...DEFAULT_PEN };
  public defaultLineStyle: PenStyle = { ...DEFAULT_PEN };
  public defaultArrowhead = "▶";
  public defaultHubGlyph = "●";
  public readonly document: ToposDocument;

  constructor(document = new ToposDocument()) {
    this.document = document;
    this.state = {
      traceMap: traceMap(""),
      selection: [],
      legendSelected: false,
      documentSelected: false,
    };
    this.installMapSource(document.mapSource, false);
    this.updateProjection();
    this.rememberSourceState();
  }

  get selection(): TraceBox[] {
    return this.state.selection;
  }
  set selection(val: TraceBox[]) {
    this.setSelection(val);
  }

  get traceMap(): TraceMap {
    return this.state.traceMap;
  }
  get singleSelection(): TraceBox | null {
    return this.state.selection.length === 1 ? this.state.selection[0] : null;
  }
  get legendSelected(): boolean {
    return this.state.legendSelected;
  }
  set legendSelected(selected: boolean) {
    this.state.legendSelected = selected;
    this.state.documentSelected = false;
    this.emit({ commit: false });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this);
    return () => this.listeners.delete(listener);
  }

  private updateProjection(skipDocumentSync = false): void {
    this.projection = projectTracesToGrid(this.state.traceMap);
    if (!skipDocumentSync) this.document.setMapProjection(this.projection);
  }

  private emit(event?: { commit: boolean }): void {
    for (const listener of this.listeners) listener(this, event);
  }

  private rememberSourceState(): void {
    const mapSource = this.document.mapSource;
    this.mapStates.delete(mapSource);
    this.mapStates.set(mapSource, structuredClone(this.state));
    if (this.mapStates.size > 100) {
      this.mapStates.delete(this.mapStates.keys().next().value!);
    }
  }

  private refreshRememberedSourceState(): void {
    const mapSource = this.document.mapSource;
    if (!this.mapStates.has(mapSource)) return;
    this.mapStates.delete(mapSource);
    this.mapStates.set(mapSource, structuredClone(this.state));
  }

  private restoreSourceState(): boolean {
    const state = this.mapStates.get(this.document.mapSource);
    if (!state) return false;
    this.state = structuredClone(state);
    return true;
  }

  private installMapSource(source: string, preserveSelection: boolean): void {
    const nextTraceMap = traceMap(source);
    const nextSelection = preserveSelection
      ? this.state.selection.map((trace) =>
        nextTraceMap.traces.find((candidate) => candidate.x === trace.x && candidate.y === trace.y && candidate.type === trace.type)
      ).filter((trace): trace is TraceBox => !!trace)
      : [];

    this.state = {
      traceMap: nextTraceMap,
      selection: normalizeTraceSelection(nextSelection),
      legendSelected: preserveSelection && !!this.document.legendSource && this.state.legendSelected,
      documentSelected: preserveSelection && this.state.documentSelected,
    };
  }

  beginMapEdit(): void {
    if (this.mapEditBackup) return;
    this.refreshRememberedSourceState();
    this.mapEditBackup = structuredClone(this.state);
    this.mapEditDirty = false;
  }

  updateMap(fn: (model: EditorModel) => void | boolean, commit = false): boolean {
    if (commit) this.refreshRememberedSourceState();
    if (fn(this) === false) return false;
    if (commit) reconcileLabels(this.state.traceMap);
    this.updateProjection();
    if (!commit) this.mapEditDirty = true;
    else this.rememberSourceState();
    this.emit({ commit });
    return true;
  }

  command(fn: (model: EditorModel) => void | boolean): boolean {
    if (this.mapEditBackup) return false;
    return this.updateMap(fn, true);
  }

  finishMapEdit(): boolean {
    if (!this.mapEditBackup) return false;
    if (!this.mapEditDirty) {
      this.mapEditBackup = undefined;
      return false;
    }
    reconcileLabels(this.state.traceMap);
    this.mapEditBackup = undefined;
    this.updateProjection();
    this.rememberSourceState();
    this.emit({ commit: true });
    return true;
  }

  cancelMapEdit(): void {
    if (!this.mapEditBackup) return;
    this.state = this.mapEditBackup;
    this.mapEditBackup = undefined;
    this.updateProjection();
    this.emit({ commit: false });
  }

  setSelection(selection: TraceBox[] | null, legendSelected = false, documentSelected = false): void {
    this.state.legendSelected = legendSelected;
    this.state.documentSelected = documentSelected;
    const next = normalizeTraceSelection(selection ?? []);
    this.state.selection = next;
    this.emit({ commit: false });
  }

  /**
   * Installs source owned by an external text host. VS Code uses this for every
   * document update, including host undo/redo. `www/slate.html` mirrors that
   * behavior with a browser-side source history.
   */
  syncDocumentSource(source: string): void {
    if (this.document.matchesSource(source)) return;
    this.cancelMapEdit();
    this.rememberSourceState();
    this.document.load(source);
    if (!this.restoreSourceState()) {
      this.installMapSource(this.document.mapSource, true);
      this.rememberSourceState();
    }
    this.updateProjection(true);
    if (!this.document.legendSource) this.state.legendSelected = false;
    this.emit({ commit: false });
  }

  applySource(source: string): boolean {
    return this.command((model) => {
      model.document.load(source);
      model.installMapSource(model.document.mapSource, false);
    });
  }

  /**
   * Updates the full web editor's dedicated Legend pane. This is not used by
   * the VS Code webview or `www/slate.html`, which edit host-owned source and
   * synchronize it through `syncDocumentSource()`. The pane previews with
   * `commit = false`, then passes `true` on blur; the emitted commit event is
   * what `EditorHistory` records.
   */
  updateLegendSource(source: TextLines, commit = false): boolean {
    const changed = this.document.setLegendSource(source);
    if (changed) {
      if (!source.text) this.state.legendSelected = false;
    }
    if (commit) this.rememberSourceState();
    if (changed || commit) this.emit({ commit });
    return changed;
  }

  retrace(): void {
    this.command((model) => model.installMapSource(model.projection.text, false));
  }

  // ─── Document Operations ────────────────────────────────────────────────────
  nudgeSelection(dx: number, dy: number): boolean {
    if (this.state.selection.length === 0) return false;
    return this.updateMap((m) => {
      const termini = m.selection.filter((t) => t.type === "terminus");
      const bodies = m.selection.filter((t) => t.type !== "terminus");
      // Move regular traces
      if (bodies.length) mut.moveTraces(m.traceMap, bodies, dx, dy);
      // Extend lines via their terminus endpoints
      for (const term of termini) {
        // if line is also selected, we don't need to extend it
        if (!term.parent || bodies.includes(term.parent)) continue;
        mut.setTerminusLocation(m.traceMap, term, { x: term.x + dx, y: term.y + dy });
      }
    });
  }

  resizeSelection(dw: number, dh: number): boolean {
    if (this.state.selection.length === 0) return false;
    return this.updateMap((model) => {
      const boxes = model.selection.filter(isBordered);
      let changed = mut.resizeBoxTraces(model.traceMap, boxes, { right: dw, bottom: dh });
      for (const trace of model.selection) {
        if (trace.type === "inline") changed = mut.resizeInlineTrace(model.traceMap, trace, { right: dw }) || changed;
      }
      return changed;
    });
  }

  deleteSelected(): void {
    const deleteSelection = (model: EditorModel) => {
      if (model.selection.length === 0 && !model.legendSelected) return false;
      const deleteLegend = model.legendSelected;
      for (const t of model.selection) {
        if (t.type === "terminus") {
          mut.setTerminusGlyph(model.traceMap, t, "");
        } else {
          mut.deleteTrace(model.traceMap, t);
        }
      }
      model.selection = [];
      if (deleteLegend) model.document.setLegendSource(null);
      model.state.legendSelected = false;
    };
    this.command(deleteSelection);
  }

  selectAll(document = true): boolean {
    const traces = this.state.traceMap.traces.filter((trace) => !isAttachment(trace));
    this.setSelection(traces.length ? traces : null, document && !!this.document.legendSource, document);
    return traces.length > 0 || this.state.legendSelected;
  }

  isAllSelected(): boolean {
    const selectable = this.state.traceMap.traces.filter((trace) => !isAttachment(trace));
    return selectable.length > 0 && selectable.every((trace) => this.state.selection.includes(trace));
  }

  applyLabel(text: string, editedTrace?: TraceBox): void {
    this.command((m) => {
      const target = editedTrace ?? m.singleSelection;
      if (!target) return;

      if (target.type === "text" || target.type === "inline") {
        if (text.trim()) mut.setText(m.traceMap, target, text);
        else {
          mut.deleteTrace(m.traceMap, target);
          m.state.selection = m.state.selection.filter((trace) => trace !== target);
        }
      } else if (target.type === "label") {
        if (text.trim()) mut.setLabel(m.traceMap, target, text);
        else mut.deleteTrace(m.traceMap, target);
      } else if (supportsLabel(target)) {
        const label = target.rawLabels?.[0];
        if (label && text.trim()) mut.setLabel(m.traceMap, label, text);
        else if (label) mut.deleteTrace(m.traceMap, label);
        else if (text.trim()) mut.createLabel(m.traceMap, target, text);
      }
    });
  }

  applyStyle(style: Partial<PenStyle>): void {
    this.mapSelectionCommand((model, trace) => {
      mut.setTraceStyle(model.traceMap, trace, style);
      if (trace.type === "box" && trace.style) {
        model.defaultBoxStyle = { ...trace.style };
      } else if (trace.type === "line" && trace.style) {
        model.defaultLineStyle = { ...trace.style };
      }
    });
  }

  reverseSelectionLines(): void {
    this.mapSelectionCommand((model, trace) => mut.reverseLineTrace(model.traceMap, trace));
  }

  cycleSelectedBoxStack(layout = false): void {
    const box = this.singleSelection;
    if (box?.type !== "box") return;
    let stack = box.stack;
    if (layout && stack) {
      const currentStack = stack;
      const current = STACK_LAYOUTS.findIndex(([dx, dy]) => dx === currentStack.dx && dy === currentStack.dy);
      const [dx, dy] = STACK_LAYOUTS[(current + 1) % STACK_LAYOUTS.length];
      this.command((model) => mut.setBoxStack(model.traceMap, box, { ...currentStack, dx, dy }, true));
      return;
    }
    if (!stack || stack.layers !== 2 && stack.layers !== 3) stack = { ...(stack ?? DEFAULT_STACK), layers: 3 };
    else if (stack.layers === 3) stack = { ...stack, layers: 2 };
    else stack = undefined;
    this.command((model) => mut.setBoxStack(model.traceMap, box, stack));
  }

  enboxSelection(): void {
    const selected = collectTraceClipboardSelection(this.traceMap, this.selection).filter((trace) => trace.type !== "terminus");
    const bounds = boundingRect(selected);
    if (!bounds) return;
    let box: TraceBox | undefined;
    if (
      this.command((model) => {
        box = mut.createBox(model.traceMap, { x: bounds.x - 2, y: bounds.y - 1, w: bounds.w + 4, h: bounds.h + 2 });
        mut.setTraceStyle(model.traceMap, box, model.defaultBoxStyle);
      })
    ) this.setSelection([box!]);
  }

  cycleSelectedInline(brackets = false): void {
    const trace = this.singleSelection;
    if (trace) {
      this.command((model) => brackets && trace.type !== "text" ? mut.cycleInlineBracket(model.traceMap, trace) : mut.toggleInlineNote(model.traceMap, trace));
    }
  }

  applyHubGlyph(glyph: string): void {
    this.mapSelectionCommand((model, trace) => {
      mut.setHubTraceGlyph(model.traceMap, trace, glyph);
      model.defaultHubGlyph = glyph;
    });
  }

  applyTerminusGlyph(glyph: string): void {
    this.mapSelectionCommand((model, trace) => {
      mut.setTerminusGlyph(model.traceMap, trace, glyph);
      model.defaultArrowhead = glyph;
    });
  }

  getClipboardText(): string {
    if (this.state.documentSelected) return this.document.source;
    const map = traceSelectionToText(this.state.traceMap, this.state.selection);
    if (!this.state.legendSelected) return map;
    return map ? `${map}\n${this.document.legendSource}` : this.document.legendSource;
  }

  cutClipboardText(): string {
    const text = this.getClipboardText();
    if (!text) return "";
    this.deleteSelected();
    return text;
  }

  pasteText(text: string): boolean {
    return this.command((model) => {
      const before = model.document.source;
      const pastedDocument = new ToposDocument(text);
      model.document.mergeLegendSource(pastedDocument.legendSource);
      const pasted = model.insertMapText(pastedDocument.mapSource);
      return pasted || model.document.source !== before;
    });
  }

  private insertMapText(text: string, loc = this.pasteAnchor): boolean {
    if (!loc) {
      const rect = traceSelectionBounds(this.traceMap, this.selection);
      loc = rect ? { x: rect.x + rect.w + 2, y: rect.y } : { x: 0, y: 0 };
    }
    const pasted = insertTraceText(this.traceMap, text, loc);
    if (pasted.length === 0) return false;
    this.selection = pasted;
    return true;
  }

  private mapSelectionCommand(fn: (model: EditorModel, trace: TraceBox) => void): boolean {
    if (this.selection.length === 0) return false;
    return this.command((model) => {
      for (const trace of model.selection) fn(model, trace);
    });
  }

  duplicateSelection(dx: number, dy: number): void {
    this.command((m) => {
      const rect = traceSelectionBounds(m.traceMap, m.selection);
      if (!rect) return false;
      const text = traceSelectionToText(m.traceMap, m.selection);

      const pattern = this.duplicatePattern;
      const repeatsPattern = pattern?.selection === m.selection && pattern.direction.x === dx && pattern.direction.y === dy;
      const step = repeatsPattern
        ? { x: rect.x - pattern.source.x, y: rect.y - pattern.source.y }
        : { x: dx * (rect.w + DUPLICATE_GAP.x), y: dy * (rect.h + DUPLICATE_GAP.y) };
      const loc = { x: rect.x + step.x, y: rect.y + step.y };

      if (!m.insertMapText(text, loc)) return false;
      m.duplicatePattern = {
        direction: { x: dx, y: dy },
        source: { x: rect.x, y: rect.y },
        selection: m.selection,
      };
    });
  }
}
