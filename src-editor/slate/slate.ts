import * as store from "./model.ts";
import * as grid from "./grid.ts";
import * as draw from "./draw.ts";
import * as interact from "./interact.ts";
import type { TraceBox } from "../../src/trace/types.ts";
import type { Loc } from "../../src/geo.ts";
import * as selection from "../model/selection.ts";
import { hasQuickInspectorContent, hasQuickInspectorContinuity, QuickInspector } from "./quick-inspector.ts";
import { SlateSurface } from "./surface.ts";
import { SlateInput } from "./input.ts";
import { GlyphPalette } from "./glyph-palette.ts";
import { type CreateKind, CreateMenu } from "./create-menu.ts";
import type { PopupPosition } from "./popup.ts";
import { GridMeasurer } from "./metrics.ts";
import type { SlateContextCommand } from "./context-command.ts";
import { buildSlateStatus, type SlateStatus } from "./status.ts";
import { TraceReplay } from "./replay.ts";

export interface SlateConfig {
  container: HTMLElement;
  model: store.EditorModel;
  onEditLegend?(): void;
  onOpenGuide?(): void;
  onContextMenu?(target: HTMLElement, context: SlateContextMenuContext): void;
  onMessage?(message: SlateMessage): void;
  hideChrome?: boolean;
  nativeClipboard?: boolean;
  rulerGridVisible?: boolean;
  selectionScale?: number;
  fontSizePercent?: number;
}

export interface SlateSettings {
  rulerGridVisible: boolean;
  fontSizePercent: number;
}

export type SlateMessage =
  | { type: "statusUpdate"; status: SlateStatus }
  | { type: "settingsUpdate"; settings: Partial<SlateSettings> };

export interface SlateContextMenuContext {
  native: boolean;
  hasSelection: boolean;
  canToggleContents: boolean;
}

export class Slate implements interact.InteractionHost {
  public surface: SlateSurface;
  public model: store.EditorModel;
  public input: SlateInput;
  private unsubscribe: () => void;
  private quickInspector: QuickInspector | null = null;
  private glyphPalette: GlyphPalette | null = null;
  private createMenu: CreateMenu | null = null;
  private readonly onEditLegend?: () => void;
  public readonly onOpenGuide?: () => void;
  private readonly onContextMenu?: SlateConfig["onContextMenu"];
  private readonly onMessage?: SlateConfig["onMessage"];
  private readonly measurer: GridMeasurer;
  private selectionScaleValue: number;
  private fontSizePercent = 100;
  private inlineEditing = false;
  private rulerGridVisible: boolean;
  private contextMenuTarget?: TraceBox;
  private replay: TraceReplay | null = null;

  constructor(config: SlateConfig) {
    this.surface = new SlateSurface({
      container: config.container,
      hideChrome: config.hideChrome,
    });
    this.setFontSizePercent(config.fontSizePercent ?? 100);
    this.selectionScaleValue = draw.normalizeSelectionScale(config.selectionScale ?? 1);
    this.surface.containerEl.style.setProperty("--slate-selection-scale", String(this.selectionScaleValue));
    // Model (State & Actions)
    this.model = config.model;
    this.onEditLegend = config.onEditLegend;
    this.onOpenGuide = config.onOpenGuide;
    this.onContextMenu = config.onContextMenu;
    this.onMessage = config.onMessage;
    this.rulerGridVisible = config.rulerGridVisible ?? false;
    this.measurer = new GridMeasurer(this.gridEl, () => this.renderAfterMetricsChange());

    this.input = new SlateInput(this);
    // Event Bindings
    this.containerEl.addEventListener("mousedown", this.input.onContextMouseDown, true);
    this.containerEl.addEventListener("mousedown", this.input.onMouseDown);
    this.containerEl.addEventListener("mousemove", this.input.onMouseMove);
    this.surface.hostEl.addEventListener("wheel", this.input.onWheel, { passive: false });
    this.containerEl.addEventListener("dblclick", this.input.onDoubleClick);
    this.containerEl.addEventListener("keydown", this.input.onKeyDown);
    globalThis.addEventListener("blur", this.input.onBlur);

    if (config.nativeClipboard) {
      this.containerEl.addEventListener("copy", (e) => {
        const text = this.model.getClipboardText();
        if (text) {
          e.clipboardData?.setData("text/plain", text);
          e.preventDefault();
        }
      });

      this.containerEl.addEventListener("cut", (e) => {
        const text = this.model.cutClipboardText();
        if (text) {
          e.clipboardData?.setData("text/plain", text);
          e.preventDefault();
        }
      });

      this.containerEl.addEventListener("paste", (e) => {
        const text = e.clipboardData?.getData("text/plain");
        if (text) {
          this.model.pasteText(text);
          e.preventDefault();
        }
      });
    }

    this.unsubscribe = this.model.subscribe(() => {
      if (this.replay) {
        this.replay.dispose();
        this.replay = null;
      }
      this.render();
    });
    if (this.isEmpty()) this.showCreateMenu();
  }

  public get metrics(): grid.GridMetrics {
    return this.measurer.metrics;
  }

  public get containerEl(): HTMLDivElement {
    return this.surface.containerEl;
  }

  public get gridEl(): HTMLPreElement {
    return this.surface.gridEl;
  }

  public get selectionScale(): number {
    return this.selectionScaleValue;
  }

  public get isInlineEditing(): boolean {
    return this.inlineEditing;
  }

  public get selectionContext(): draw.SelectionContext {
    return {
      element: this.gridEl,
      metrics: this.metrics,
      offset: this.model.projection.offset,
      cellAspectInset: Math.max(0, (this.metrics.charHeight - this.metrics.charWidth) / 2),
      config: draw.selectionConfig(this.selectionScaleValue),
    };
  }

  public setSelectionScale(scale: number): void {
    const next = draw.normalizeSelectionScale(scale);
    if (next === this.selectionScaleValue) return;
    this.selectionScaleValue = next;
    this.surface.containerEl.style.setProperty("--slate-selection-scale", String(next));
    this.render();
  }

  public setFontSizePercent(percent: number): void {
    this.fontSizePercent = Math.min(200, Math.max(100, percent));
    this.surface.hostEl.style.setProperty("--slate-theme-font-size", `${this.fontSizePercent}%`);
  }

  public stepFontSize(direction: 1 | -1): void {
    const before = this.fontSizePercent;
    this.setFontSizePercent(before + direction * 10);
    if (this.fontSizePercent !== before) {
      this.onMessage?.({ type: "settingsUpdate", settings: { fontSizePercent: this.fontSizePercent } });
    }
  }

  public setInlineEditing(active: boolean): void {
    if (active === this.inlineEditing) return;
    this.inlineEditing = active;
    this.render();
    if (!active) this.focus();
  }

  public toggleRulerGrid(): void {
    const visible = !this.rulerGridVisible;
    this.setRulerGridVisible(visible);
    this.onMessage?.({ type: "settingsUpdate", settings: { rulerGridVisible: visible } });
  }

  public setRulerGridVisible(visible: boolean): void {
    if (visible === this.rulerGridVisible) return;
    this.rulerGridVisible = visible;
    this.render();
  }

  public activateLegendControl(): void {
    if (!this.model.document.legendSource || (this.model.selection.length === 0 && !this.model.legendSelected)) {
      this.onEditLegend?.();
    } else {
      this.model.legendSelected = !this.model.legendSelected;
    }
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────
  public render() {
    const xmlNodes = this.replay?.overlay(this.metrics) ?? (this.inlineEditing ? [] : draw.drawSelection(this.model.selection, this.selectionContext));
    const interaction = this.input.controller.current();
    if (interaction?.overlayElements) {
      xmlNodes.push(...interaction.overlayElements);
    }

    if (this.quickInspector) {
      const selection = this.model.selection;
      if (hasQuickInspectorContent(selection)) {
        const pos = hasQuickInspectorContinuity(this.quickInspector.selection, selection) ? this.quickInspector.pos : undefined;
        this.showQuickInspector(pos);
      } else {
        this.hideQuickInspector();
      }
    }

    const interacting = interaction !== null && this.input.controller.hasMoved();
    this.surface.renderRulerGrid(this.rulerGridVisible, this.metrics, this.model.projection.offset);
    this.surface.render(this.model.projection.text, this.model.projection.spans, xmlNodes, interacting);
    this.surface.renderLegendControl(
      this.model.selection.length > 0,
      !!this.model.document.legendSource,
      this.model.legendSelected,
    );
    this.surface.renderGuideControl(this.isEmpty(), this.onOpenGuide !== undefined);
    this.onMessage?.({ type: "statusUpdate", status: buildSlateStatus(this.model) });
  }

  private hideQuickInspector() {
    if (this.quickInspector) {
      this.quickInspector.dispose();
      this.quickInspector = null;
    }
  }

  public showQuickInspector(pos?: Loc) {
    const selection = this.model.selection;

    this.closePopups();

    if (!hasQuickInspectorContent(selection)) return;
    const targetPos = pos ?? this.input.controller.pointerCoords() ?? this.selectionCenter(selection);

    this.quickInspector = new QuickInspector(this, [...selection], targetPos);
  }

  private selectionCenter(selection: TraceBox[]): Loc {
    const center = grid.selectionCenterPx(selection, this.metrics, this.model.projection.offset);
    if (!center) return { x: 0, y: 0 };
    return this.surface.toClientPoint(center);
  }

  public toggleQuickInspector() {
    this.quickInspector ? this.hideQuickInspector() : this.showQuickInspector();
  }

  public toggleReplay(): void {
    if (this.replay) {
      this.closeReplay();
      return;
    }
    this.cancelInteraction();
    this.closePopups();
    this.replay = new TraceReplay(this, this.model.projection.text);
    this.render();
  }

  public closeReplay(): void {
    if (!this.replay) return;
    this.replay.dispose();
    this.replay = null;
    this.render();
  }

  public closePopups(): void {
    this.hideQuickInspector();
    this.closeCreateMenu();
    this.closeGlyphPalette();
    this.surface.closeCheatsheet();
    this.closeReplay();
  }

  public openContextMenu(eventTarget: EventTarget | null, traceTarget?: TraceBox): void {
    this.contextMenuTarget = traceTarget;
    this.onContextMenu?.(eventTarget instanceof HTMLElement ? eventTarget : this.containerEl, {
      native: this.inlineEditing,
      hasSelection: this.model.selection.length > 0,
      canToggleContents: !!traceTarget && selection.traceWithContents(this.model.traceMap, traceTarget).length > 1,
    });
  }

  public contextCommand(command: SlateContextCommand): void {
    switch (command) {
      case "style":
        this.showQuickInspector();
        break;
      case "editText":
        if (this.contextMenuTarget) this.input.activateTrace(this.contextMenuTarget);
        break;
      case "duplicateRight":
        this.model.duplicateSelection(1, 0);
        break;
      case "duplicateDown":
        this.model.duplicateSelection(0, 1);
        break;
      case "toggleContents": {
        const target = this.contextMenuTarget;
        if (!target) break;
        const contents = selection.traceWithContents(this.model.traceMap, target).filter((trace) => trace !== target);
        this.model.setSelection(selection.toggleTraceSelection(this.model.selection, contents));
        break;
      }
      case "delete":
        this.model.deleteSelected();
        break;
      case "createText":
        this.startDrawing("text");
        break;
      case "createBox":
        this.startDrawing("box");
        break;
      case "createLine":
        this.startDrawing("line");
        break;
      case "createHub":
        this.startDrawing("hub");
        break;
      default: {
        const unknownCommand: never = command;
        throw new Error(`Unknown Slate context command: ${unknownCommand}`);
      }
    }
  }

  public toggleGlyphPalette(position?: PopupPosition): void {
    if (this.glyphPalette) {
      this.closeGlyphPalette();
      return;
    }
    const anchor = this.popupAnchor();
    this.closePopups();
    const location: { position: PopupPosition } | { anchor: Loc } = position ? { position } : { anchor };
    this.glyphPalette = new GlyphPalette(this, location, (glyph) => {
      this.closeGlyphPalette();
      this.input.startGlyph(glyph);
      this.focus();
    });
  }

  public closeGlyphPalette(): void {
    this.glyphPalette?.dispose();
    this.glyphPalette = null;
  }

  public toggleCreateMenu(pos?: Loc, placement: "center" | "above" | "top-left" = "top-left"): void {
    if (this.createMenu) this.closeCreateMenu();
    else {
      this.showCreateMenu(pos, placement);
    }
  }

  public toggleCheatsheet(): void {
    if (this.surface.cheatsheetOpen) this.surface.closeCheatsheet();
    else {
      this.closePopups();
      this.surface.toggleCheatsheet();
    }
  }

  public closeCreateMenu(): void {
    this.createMenu?.dispose();
    this.createMenu = null;
  }

  private showCreateMenu(pos?: Loc, placement: "center" | "above" | "top-left" = "center"): void {
    const anchor = this.popupAnchor();
    this.closePopups();
    const menuPos = pos ?? anchor;
    this.createMenu = new CreateMenu(this, menuPos, (kind) => this.pickCreateOption(kind), placement);
  }

  private pickCreateOption(kind: CreateKind): void {
    const menuPos = this.createMenu?.position;
    this.closeCreateMenu();
    if (kind === "glyph") {
      this.toggleGlyphPalette(menuPos);
      this.focus();
    } else {
      this.startDrawing(kind);
    }
  }

  private popupAnchor(): Loc {
    if (this.input.pointerPosition) return this.input.pointerPosition;

    const visible = this.surface.visibleRect();
    return this.surface.toClientPoint({ x: visible.x + visible.w / 2, y: visible.y + visible.h / 2 });
  }

  private isEmpty(): boolean {
    return !this.model.traceMap.traces.some((trace) => trace.type !== "label" && trace.type !== "terminus");
  }

  public focus() {
    this.containerEl.focus();
  }

  public refresh(): void {
    if (this.measurer.measure()) this.renderAfterMetricsChange();
    else this.render();
  }

  private renderAfterMetricsChange(): void {
    const reopenInspector = this.quickInspector !== null;
    if (reopenInspector) this.hideQuickInspector();
    this.render();
    if (reopenInspector) this.showQuickInspector(this.selectionCenter(this.model.selection));
  }

  public cancelInteraction(): void {
    this.input.cancel();
  }

  public dispose() {
    this.containerEl.removeEventListener("mousedown", this.input.onMouseDown);
    this.containerEl.removeEventListener("mousedown", this.input.onContextMouseDown, true);
    this.containerEl.removeEventListener("mousemove", this.input.onMouseMove);
    this.surface.hostEl.removeEventListener("wheel", this.input.onWheel);
    this.containerEl.removeEventListener("dblclick", this.input.onDoubleClick);
    this.containerEl.removeEventListener("keydown", this.input.onKeyDown);
    globalThis.removeEventListener("blur", this.input.onBlur);
    this.unsubscribe();
    this.input.dispose();
    this.hideQuickInspector();
    this.closeCreateMenu();
    this.closeGlyphPalette();
    this.replay?.dispose();
    this.measurer.dispose();
    this.surface.dispose();
  }

  public startDrawing(kind: "box" | "line" | "hub" | "text") {
    this.input.startDrawing(kind);
    this.focus();
  }

  public updateCursor(): void {
    this.input.updateCursor();
  }
}
