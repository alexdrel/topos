import type { Slate } from "./slate.ts";
import { Dir, getDirection, Loc, opposite } from "../../src/geo.ts";
import { getArrowOptions, getHubGlyphs, spec } from "../../src/grammar.ts";
import { htmlEl, mount } from "./dom.ts";
import type { XmlEl } from "../../src/jsonml/jsonml.ts";
import { detectSelectionStyles, getValState } from "./style.ts";
import type { TraceBox } from "../../src/trace/types.ts";
import { PenStyle } from "../../src/style.ts";
import { clsx } from "../../src/clsx.ts";
import { positionPopup } from "./popup.ts";
import { OPEN_TERMINUS_GLYPH } from "../model/mutate.ts";

export function hasQuickInspectorContent(selection: TraceBox[]): boolean {
  return selection.some((trace) => trace.style !== undefined || trace.type === "hub" || trace.type === "terminus");
}

export function hasQuickInspectorContinuity(previous: TraceBox[], next: TraceBox[]): boolean {
  return next.some((trace) =>
    previous.some((candidate) =>
      trace === candidate ||
      trace.parent === candidate ||
      candidate.parent === trace ||
      (trace.parent !== undefined && trace.parent === candidate.parent)
    )
  );
}

function terminusDirection(terminus: TraceBox): Dir {
  const direction = terminus.recoilDir ?? terminus.dir;
  if (direction !== undefined && direction !== Dir.None) return opposite(direction);
  const { parent } = terminus;
  const path = parent?.path;
  if (!path || path.length < 2) return Dir.None;
  return parent.source === terminus ? getDirection(path[0], path[1]) : getDirection(path.at(-1)!, path.at(-2)!);
}

export function buildQuickInspectorNode(selection: TraceBox[]): XmlEl {
  const styles = detectSelectionStyles(selection);
  const styleable = selection.filter((trace) => trace.style !== undefined);
  const hubs = selection.filter((trace) => trace.type === "hub");
  const termini = selection.filter((trace) => trace.type === "terminus");

  const groups: XmlEl[] = [];

  if (styleable.length > 0) {
    const isUnanimousAscii = styles.family.size === 1 && styles.family.has("ascii");

    const styleBtn = <K extends keyof PenStyle>(prop: K, val: PenStyle[K], title: string, symbol: string, extraDisabled = false) =>
      htmlEl("button", {
        type: "button",
        class: clsx("qi-btn", getValState(styles[prop], val)),
        disabled: extraDisabled,
        title,
        "data-action": "style",
        "data-prop": prop,
        "data-value": val,
      }, symbol);

    groups.push(
      htmlEl("div", { class: "qi-group" }, styleBtn("family", "ascii", "ASCII style (+)", "+"), styleBtn("family", "unicode", "Unicode style (┼)", "┼")),
      htmlEl(
        "div",
        { class: "qi-group" },
        styleBtn("corner", "sharp", "Sharp Corners (┌)", "┌", isUnanimousAscii),
        styleBtn("corner", "rounded", "Rounded Corners (╭)", "╭", isUnanimousAscii),
      ),
      htmlEl(
        "div",
        { class: "qi-group" },
        styleBtn("weight", "single", "Thin", "─"),
        styleBtn("weight", "bold", "Bold", "━", isUnanimousAscii),
        styleBtn("weight", "double", "Double", "═"),
        styleBtn("weight", "dashed", "Dashed", "┄", isUnanimousAscii),
        styleBtn("weight", "dotted", "Dotted", "┈", isUnanimousAscii),
      ),
    );
  } else if (hubs.length > 0) {
    const hubTexts = new Set(hubs.map((trace) => trace.text ?? ""));
    const buttons = getHubGlyphs().map((glyph) =>
      htmlEl("button", {
        type: "button",
        class: clsx("qi-btn", getValState(hubTexts, glyph)),
        title: `Pick ${glyph}`,
        "data-action": "hub",
        "data-glyph": glyph,
      }, glyph)
    );
    groups.push(htmlEl("div", { class: "qi-group" }, ...buttons));
  } else if (termini.length > 0) {
    const dir = terminusDirection(termini[0]);
    const termMarkers = new Set(termini.map((trace) => trace.text === undefined ? OPEN_TERMINUS_GLYPH : spec(trace.text).marker));
    const arrows = ["", ...getArrowOptions(dir), OPEN_TERMINUS_GLYPH];
    const buttons = arrows.map((arrow) =>
      htmlEl("button", {
        type: "button",
        class: clsx("qi-btn", getValState(termMarkers, arrow === OPEN_TERMINUS_GLYPH ? arrow : spec(arrow).marker)),
        title: arrow === OPEN_TERMINUS_GLYPH ? "No connection" : arrow ? `Pick ${arrow}` : "None",
        "data-action": "terminus",
        "data-glyph": arrow,
      }, arrow || "·")
    );
    groups.push(htmlEl("div", { class: "qi-group" }, ...buttons));
  }

  const content = styleable.length > 0
    ? [htmlEl("div", { class: "slate-quick-title" }, "Style"), htmlEl("div", { class: "slate-quick-controls" }, ...groups)]
    : groups;
  return htmlEl("div", { class: clsx("quick-inspector", styleable.length > 0 && "slate-style-inspector") }, ...content);
}

export class QuickInspector {
  private node: XmlEl;
  private domEl: HTMLElement;

  constructor(
    private editor: Slate,
    public selection: TraceBox[],
    public pos: Loc,
  ) {
    this.node = buildQuickInspectorNode(selection);
    this.domEl = mount(this.node) as HTMLElement;

    this.positionInspector(pos);

    // Stop mousedown from closing selection on grid
    this.domEl.addEventListener("mousedown", (e) => e.stopPropagation());
    // Keep Slate's canvas shortcuts from consuming native button activation.
    this.domEl.addEventListener("keydown", (e) => e.stopPropagation());

    this.bindClickHandlers();

    // Click outside handler
    document.addEventListener("click", this.handleDocumentClick);
  }

  private positionInspector(pos: Loc) {
    this.editor.surface.appendViewportElement(this.domEl);
    positionPopup(this.editor, this.domEl, pos, {
      placement: "above",
      gap: 12,
      flipBelow: true,
    });
  }

  private handleDocumentClick = (e: MouseEvent) => {
    // Keep visible on clicks inside the toolbar or inside the canvas/grid
    const isInsideInspector = this.domEl.contains(e.target as Node);
    const isInsideEditor = this.editor.containerEl.contains(e.target as Node);
    if (!isInsideInspector && !isInsideEditor) {
      this.editor.toggleQuickInspector();
    }
  };

  private bindClickHandlers() {
    this.domEl.querySelectorAll("[data-action]").forEach((el) => {
      const btn = el as HTMLButtonElement;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { action, glyph, prop, value } = btn.dataset;
        if (action === "hub") {
          this.editor.model.applyHubGlyph(glyph!);
        } else if (action === "terminus") {
          this.editor.model.applyTerminusGlyph(glyph!);
        } else if (action === "style" && prop && value) {
          this.editor.model.applyStyle({ [prop as keyof PenStyle]: value });
        }
        this.editor.focus();
      });
    });
  }

  public dispose() {
    document.removeEventListener("click", this.handleDocumentClick);
    this.domEl.remove();
  }
}
