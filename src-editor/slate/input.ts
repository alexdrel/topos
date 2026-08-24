import type { Loc } from "../../src/geo.ts";
import { contains } from "../../src/geo.ts";
import { isBordered, type TraceBox } from "../../src/trace/types.ts";
import * as selection from "../model/selection.ts";
import * as dom from "./dom.ts";
import * as grid from "./grid.ts";
import { startInlineEditor } from "./inline-edit.ts";
import * as interact from "./interact.ts";
import type { Slate } from "./slate.ts";
import { detectSelectionStyles } from "./style.ts";
import * as int from "./trace-interaction.ts";

const KEYBOARD_GEOMETRY_IDLE_MS = 3000;
type ResizeHit = { handle: grid.ResizeHandle; traces: TraceBox[] };

export class SlateInput {
  public controller: interact.InteractionController;
  public pointerPosition: Loc | null = null;

  private keyboardGeometryActive = false;
  private keyboardGeometryTimer?: ReturnType<typeof setTimeout>;
  private lastWheelZoomAt = 0;

  constructor(private slate: Slate) {
    this.controller = interact.createInteractionController(slate);
    this.slate.surface.chrome?.root.addEventListener("mousedown", this.onChromeMouseDown);
    this.slate.surface.chrome?.root.addEventListener("click", this.onChromeClick);
  }

  private readonly onChromeMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.slate.focus();
  };

  private readonly onChromeClick = (event: MouseEvent): void => {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    if (target.closest(".slate-guide-btn")) this.slate.onOpenGuide?.();
    else if (target.closest(".slate-help-btn")) this.slate.toggleCheatsheet();
    else if (target.closest(".slate-create-btn")) {
      const rect = target.closest(".slate-create-btn")!.getBoundingClientRect();
      this.slate.toggleCreateMenu({ x: rect.left + rect.width / 2, y: rect.top }, "above");
    } else if (target === this.slate.surface.chrome?.cheatsheet) this.slate.surface.closeCheatsheet();
    else if (target.closest(".slate-legend-tab-btn")) this.slate.activateLegendControl();
  };

  public readonly onContextMouseDown = (event: MouseEvent): void => {
    if (event.button !== 2 || !this.slate.isInlineEditing) return;
    if (event.target === document.activeElement) this.slate.openContextMenu(event.target);
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  public readonly onMouseDown = (event: MouseEvent): void => {
    if (this.slate.isInlineEditing) return;
    this.pointerPosition = { x: event.clientX, y: event.clientY };
    this.slate.closeCreateMenu();
    this.slate.closeGlyphPalette();
    const pointer = grid.pointerFromEvent(event, this.slate.gridEl, this.slate.metrics, this.slate.model.projection.offset);
    const { cell } = pointer;
    if (event.button === 0 || event.button === 2) this.slate.model.pasteAnchor = cell;
    if (event.button === 2) {
      const hit = grid.hitTestTraces(this.slate.model.traceMap.traces, cell, pointer.point);
      const selectedBox = this.slate.model.selection.find((trace) => trace.type === "box" && contains(trace, cell));
      const contextTarget = hit ?? selectedBox;
      if (hit && !this.slate.model.selection.includes(hit)) this.slate.model.setSelection([hit]);
      else if (!hit && !selection.isSelectionArea(this.slate.model.selection, cell)) this.slate.model.setSelection(null);
      this.slate.openContextMenu(event.target, contextTarget);
      return;
    }
    if (event.button !== 0) return;
    this.commitKeyboardGeometry();

    if (this.controller.onMouseDown(event)) return;

    const mod = dom.isModKey(event);
    if (mod && !event.shiftKey && !event.altKey) {
      this.controller.start(int.createStructureInteraction((clickCell) => this.contentsSelectionToggle(clickCell, pointer.point)), event);
    } else if (!this.tryResizeOrLineHandle(event)) {
      const hit = grid.hitTestTraces(this.slate.model.traceMap.traces, cell, pointer.point);

      if (mod && event.shiftKey && !event.altKey && !hit) {
        this.controller.set(int.spaceTearInteraction(
          this.slate.metrics,
          () => this.slate.model.projection.offset,
        ));
      } else if (event.shiftKey && event.altKey && !hit) {
        this.controller.set(int.marqueeInteraction(
          () => this.slate.model.setSelection(null),
          this.slate.metrics,
          () => this.slate.model.projection.offset,
        ));
      } else if (event.altKey) {
        this.controller.start(int.createLineInteraction(true), event);
      } else if (hit) {
        this.updateSelectionTraceHit(event, hit);
      } else if (!event.shiftKey && !mod && selection.isSelectionArea(this.slate.model.selection, cell)) {
        this.controller.set(int.moveTraceInteraction([...this.slate.model.selection]));
      } else {
        this.controller.set(int.marqueeInteraction(
          () => this.slate.model.setSelection(null),
          this.slate.metrics,
          () => this.slate.model.projection.offset,
        ));
      }
    }

    if (this.controller.current()) this.controller.startDrag(event);
  };

  public readonly onMouseMove = (event: MouseEvent): void => {
    this.pointerPosition = { x: event.clientX, y: event.clientY };
    if (!this.controller.current()) this.updateCursor(event);
  };

  public readonly onWheel = (event: WheelEvent): void => {
    if (!dom.isModKey(event) || event.deltaY === 0) return;
    event.preventDefault();
    this.slate.focus();
    const now = performance.now();
    if (now - this.lastWheelZoomAt < 80) return;
    this.lastWheelZoomAt = now;
    this.slate.stepFontSize(event.deltaY < 0 ? 1 : -1);
  };

  public readonly onDoubleClick = (event: MouseEvent): void => {
    if (this.slate.surface.cheatsheetOpen) return;

    const pointer = grid.pointerFromEvent(event, this.slate.gridEl, this.slate.metrics, this.slate.model.projection.offset);
    const { cell } = pointer;
    this.slate.model.pasteAnchor = cell;
    const hit = grid.hitTestTraces(this.slate.model.traceMap.traces, cell, pointer.point);
    if (!hit || hit.type === "grid-cell") {
      this.slate.model.setSelection(null);
      startInlineEditor(this.slate, cell);
    } else {
      this.activateTrace(hit);
    }
  };

  public readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "?" && event.target === this.slate.containerEl) {
      event.preventDefault();
      this.commitKeyboardGeometry();
      this.slate.toggleCheatsheet();
      return;
    }
    if (event.key === "+" && event.target === this.slate.containerEl) {
      event.preventDefault();
      this.commitKeyboardGeometry();
      this.slate.toggleCreateMenu();
      return;
    }
    if (this.slate.surface.cheatsheetOpen) {
      if (event.key === "Escape" || event.key === "Enter" || event.code === "Space") {
        event.preventDefault();
        this.slate.surface.closeCheatsheet();
      }
      return;
    }
    if (event.target !== this.slate.containerEl) return;

    const mod = dom.isModKey(event);
    const key = event.key.toLowerCase();
    const arrow = dom.arrowDelta(event.key);
    const keyboardGeometry = arrow !== null && !(mod && event.shiftKey && !event.altKey);

    if (event.key === "Escape" && this.keyboardGeometryActive) {
      event.preventDefault();
      this.cancelKeyboardGeometry();
      this.slate.model.setSelection(null);
      return;
    }

    if (!mod && event.key === "Enter" && this.keyboardGeometryActive) {
      event.preventDefault();
      this.commitKeyboardGeometry();
      this.slate.model.setSelection(null);
      return;
    }

    if (!keyboardGeometry) this.commitKeyboardGeometry();

    if (!mod && event.altKey && event.code === "KeyG") {
      event.preventDefault();
      this.slate.toggleRulerGrid();
      return;
    }

    if (mod && event.code === "KeyA") {
      event.preventDefault();
      this.slate.model.selectAll(!event.altKey);
      return;
    }

    if (mod && event.shiftKey && key === "enter") {
      event.preventDefault();
      event.stopPropagation();
      this.slate.model.retrace();
      return;
    }

    if (mod && !event.shiftKey && !event.altKey && (key === "d" || key === "]")) {
      event.preventDefault();
      const delta = key === "d" ? { x: 0, y: 1 } : { x: 1, y: 0 };
      this.slate.model.duplicateSelection(delta.x, delta.y);
      return;
    }

    if (mod && event.shiftKey && !event.altKey && arrow) {
      event.preventDefault();
      this.slate.model.duplicateSelection(arrow.x, arrow.y);
      return;
    }

    if (!mod && event.key === "Enter") {
      event.preventDefault();
      const trace = this.slate.model.singleSelection;
      if (trace) this.activateTrace(trace);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (this.controller.current()) this.controller.cancel();
      if (event.shiftKey) this.slate.toggleGlyphPalette();
      else if (this.slate.model.selection.length > 0) this.slate.toggleQuickInspector();
      else this.slate.toggleCreateMenu();
      return;
    }

    if (event.altKey && this.slate.model.selection.length > 0) {
      const code = event.code;
      if (code === "KeyA") {
        event.preventDefault();
        const styles = detectSelectionStyles(this.slate.model.selection);
        const nextFamily = styles.family.has("unicode") ? "ascii" : "unicode";
        this.slate.model.applyStyle({ family: nextFamily });
        return;
      }
      if (code === "KeyR") {
        event.preventDefault();
        const styles = detectSelectionStyles(this.slate.model.selection);
        const nextCorner = styles.corner.has("rounded") ? "sharp" : "rounded";
        this.slate.model.applyStyle({ corner: nextCorner });
        return;
      }
      if (code === "KeyF") {
        event.preventDefault();
        this.slate.model.reverseSelectionLines();
        return;
      }
      if (code === "KeyB" && !mod) {
        event.preventDefault();
        this.slate.model.enboxSelection();
        return;
      }
      if (code === "KeyI" && !mod) {
        event.preventDefault();
        this.slate.model.cycleSelectedInline(event.shiftKey);
        return;
      }
      if (code === "KeyS" && !mod) {
        event.preventDefault();
        this.slate.model.cycleSelectedBoxStack(event.shiftKey);
        return;
      }
    }

    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    const trace = this.slate.model.singleSelection;
    if (isPrintable && trace) {
      event.preventDefault();
      startInlineEditor(this.slate, trace, event.key);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.slate.closeCreateMenu();
      this.slate.closeGlyphPalette();
      this.slate.cancelInteraction();
      this.slate.model.setSelection(null);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.slate.model.deleteSelected();
    } else if (arrow) {
      event.preventDefault();
      this.mutateKeyboardGeometry(() =>
        event.shiftKey ? this.slate.model.resizeSelection(arrow.x, arrow.y) : this.slate.model.nudgeSelection(arrow.x, arrow.y)
      );
    }
  };

  public readonly onBlur = (): void => this.commitKeyboardGeometry();

  public updateCursor(event?: MouseEvent): void {
    const interaction = this.controller.current();
    if (interaction) {
      this.slate.containerEl.style.cursor = interaction.cursor ?? "crosshair";
      return;
    }

    const trace = this.slate.model.singleSelection;
    const resize = event ? this.detectResizeHandle(event) : null;
    const lineHandle = event && trace ? this.detectLineHandle(trace, event) : null;
    this.slate.containerEl.style.cursor = (resize && grid.HANDLE_CURSORS[resize.handle]) || (lineHandle !== null && "move") || "default";
  }

  public startDrawing(kind: "box" | "line" | "hub" | "text"): void {
    if (kind === "box") this.controller.set(int.createBoxInteraction());
    else if (kind === "line") this.controller.set(int.createLineInteraction());
    else if (kind === "hub") this.controller.set(int.createHubInteraction());
    else this.controller.set(int.createTextInteraction((cell) => startInlineEditor(this.slate, cell)));
  }

  public startGlyph(glyph: string): void {
    this.controller.set(int.createGlyphInteraction(glyph));
  }

  public activateTrace(trace: TraceBox): void {
    if (trace.type === "terminus" && trace.parent?.type === "line") {
      this.slate.model.setSelection([trace.parent]);
    } else {
      this.slate.model.setSelection([trace]);
      startInlineEditor(this.slate, trace);
    }
  }

  public cancel(): void {
    this.cancelKeyboardGeometry();
    this.controller.cancel();
  }

  public dispose(): void {
    this.commitKeyboardGeometry();
    this.controller.cancel();
    this.slate.surface.chrome?.root.removeEventListener("mousedown", this.onChromeMouseDown);
    this.slate.surface.chrome?.root.removeEventListener("click", this.onChromeClick);
  }

  private detectResizeHandle(event: MouseEvent): ResizeHit | null {
    const traces = this.slate.model.selection;
    const trace = this.slate.model.singleSelection;
    if (trace && (isBordered(trace) || trace.type === "inline")) {
      const handles = trace.type === "inline" ? grid.INLINE_RESIZE_HANDLES : grid.RESIZE_HANDLES;
      const handle = grid.hitTestResizeHandle(trace, event, this.slate.selectionContext, handles);
      return handle ? { handle, traces } : null;
    }
    const rect = selection.gridCellSelectionRect(traces);
    const handle = rect && grid.hitTestResizeHandle(rect, event, this.slate.selectionContext);
    return handle ? { handle, traces } : null;
  }

  private detectLineHandle(trace: TraceBox | null, event: MouseEvent): grid.LineHandleHit | null {
    if (!trace || trace.type !== "line") return null;
    return grid.hitTestLineHandle(trace, event, this.slate.selectionContext);
  }

  private tryResizeOrLineHandle(event: MouseEvent): boolean {
    const trace = this.slate.model.singleSelection;
    const resize = this.detectResizeHandle(event);
    if (resize) {
      this.controller.set(
        resize.traces.length === 1
          ? int.resizeTraceInteraction(resize.traces[0], resize.handle)
          : int.resizeGridCellsInteraction([...resize.traces], resize.handle),
      );
      return true;
    }

    const lineHandle = this.detectLineHandle(trace, event);
    if (lineHandle && trace) {
      this.controller.set(int.linePointInteraction(trace, lineHandle.pointIndex, lineHandle.terminus));
      return true;
    }

    return false;
  }

  private updateSelectionTraceHit(event: MouseEvent, hit: TraceBox): void {
    let nextSelection = [...this.slate.model.selection];
    const mod = dom.isModKey(event);

    if (mod) {
      const targets = selection.traceWithContents(this.slate.model.traceMap, hit);
      nextSelection = event.shiftKey ? selection.toggleTraceSelection(nextSelection, targets) : [...new Set([...nextSelection, ...targets])];
    } else if (event.shiftKey) {
      nextSelection = nextSelection.includes(hit) ? nextSelection.filter((trace) => trace !== hit) : [...nextSelection, hit];
    } else if (!nextSelection.includes(hit)) {
      nextSelection = [hit];
    }

    const legendSelected = (mod || event.shiftKey) && this.slate.model.legendSelected;
    this.slate.model.setSelection(nextSelection.length ? nextSelection : null, legendSelected);
    if (nextSelection.length > 0) this.controller.set(int.moveTraceInteraction(nextSelection, hit));
  }

  private contentsSelectionToggle(cell: Loc, point: Loc): TraceBox[] | undefined {
    const hit = grid.hitTestTraces(this.slate.model.traceMap.traces, cell, point);
    return selection.contentsSelectionToggle(this.slate.model.traceMap, this.slate.model.selection, cell, hit);
  }

  private mutateKeyboardGeometry(mutation: () => boolean): void {
    this.clearKeyboardGeometryTimer();
    const starting = !this.keyboardGeometryActive;
    if (starting) this.slate.model.beginMapEdit();

    if (mutation()) this.keyboardGeometryActive = true;
    else if (starting) this.slate.model.cancelMapEdit();

    if (this.keyboardGeometryActive) {
      this.keyboardGeometryTimer = setTimeout(() => this.commitKeyboardGeometry(), KEYBOARD_GEOMETRY_IDLE_MS);
    }
  }

  private clearKeyboardGeometryTimer(): void {
    if (this.keyboardGeometryTimer === undefined) return;
    clearTimeout(this.keyboardGeometryTimer);
    this.keyboardGeometryTimer = undefined;
  }

  private commitKeyboardGeometry(): void {
    this.clearKeyboardGeometryTimer();
    if (this.keyboardGeometryActive) this.slate.model.finishMapEdit();
    this.keyboardGeometryActive = false;
  }

  private cancelKeyboardGeometry(): void {
    this.clearKeyboardGeometryTimer();
    if (this.keyboardGeometryActive) this.slate.model.cancelMapEdit();
    this.keyboardGeometryActive = false;
  }
}
