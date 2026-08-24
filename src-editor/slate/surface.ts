import type { XmlEl } from "../../src/jsonml/jsonml.ts";
import type { Loc, Rect } from "../../src/geo.ts";
import { PROJECTION_ROLES, type ProjectionSpan } from "../../src/ink/ink.ts";
import type { GridMetrics } from "./grid.ts";
import * as dom from "./dom.ts";
import chromeTemplate from "./chrome.html?raw" with { type: "text" };
import slateCss from "./slate.css?raw" with { type: "text" };

const SLATE_STYLE_ID = "topos-slate-styles";
const RULER_GRID_COLUMNS = 5;
const RULER_GRID_ROWS = 2;

function installSlateStyles(): void {
  const existing = document.getElementById(SLATE_STYLE_ID);
  if (existing) {
    if (existing.textContent !== slateCss) existing.textContent = slateCss;
    return;
  }
  const style = document.createElement("style");
  style.id = SLATE_STYLE_ID;
  style.textContent = slateCss;
  document.head.appendChild(style);
}

function chromeHtml(): string {
  const mac = dom.isMac();
  return chromeTemplate
    .replaceAll("{{mod}}", mac ? "⌘" : "Ctrl")
    .replaceAll("{{alt}}", mac ? "⌥" : "Alt")
    .replaceAll("{{shift}}", mac ? "⇧" : "Shift");
}

export class SlateSurface {
  public containerEl: HTMLDivElement;
  public gridEl: HTMLPreElement;
  public chrome?: {
    root: HTMLDivElement;
    cheatsheet: HTMLDivElement;
    canvasGuideButton: HTMLButtonElement;
    cheatsheetGuideButton: HTMLButtonElement;
    legendButton: HTMLButtonElement;
  };

  private gridText: Text;
  private overlayEl: SVGSVGElement;
  public scrollEl: HTMLDivElement;
  public readonly hostEl: HTMLElement;
  private chromeResizeObserver?: ResizeObserver;

  constructor(config: { container: HTMLElement; hideChrome?: boolean }) {
    installSlateStyles();
    this.hostEl = config.container;
    const gridNode = dom.htmlEl("pre", { "data-part": "grid" });
    const overlayNode = dom.svgEl("svg", { "data-part": "overlay" });
    const containerNode = dom.htmlEl("div", { "data-part": "editor", tabindex: 0 }, gridNode, overlayNode);
    const scrollNode = dom.htmlEl("div", { "data-part": "scroll" }, containerNode);

    this.scrollEl = dom.mount(scrollNode) as HTMLDivElement;
    config.container.appendChild(this.scrollEl);
    this.containerEl = dom.el<HTMLDivElement>(containerNode);
    this.gridEl = dom.el<HTMLPreElement>(gridNode);
    this.overlayEl = dom.el<SVGSVGElement>(overlayNode);
    this.gridText = document.createTextNode("");
    this.gridEl.append(this.gridText);

    if (!config.hideChrome) this.mountChrome();
  }

  private mountChrome(): void {
    const chromeNode = dom.htmlEl("div", { class: "slate-chrome" });
    const root = dom.mount(chromeNode) as HTMLDivElement;
    root.innerHTML = chromeHtml();
    this.hostEl.appendChild(root);
    const updateScrollbarInset = () => {
      root.style.setProperty("--slate-h-scrollbar", `${this.scrollEl.offsetHeight - this.scrollEl.clientHeight}px`);
      root.style.setProperty("--slate-v-scrollbar", `${this.scrollEl.offsetWidth - this.scrollEl.clientWidth}px`);
    };
    this.chromeResizeObserver = new ResizeObserver(updateScrollbarInset);
    this.chromeResizeObserver.observe(this.scrollEl);
    updateScrollbarInset();
    this.chrome = {
      root,
      cheatsheet: root.querySelector(".slate-cheatsheet-overlay") as HTMLDivElement,
      canvasGuideButton: root.querySelector(".slate-canvas-guide-btn") as HTMLButtonElement,
      cheatsheetGuideButton: root.querySelector(".slate-cheatsheet-guide-btn") as HTMLButtonElement,
      legendButton: root.querySelector(".slate-legend-tab-btn") as HTMLButtonElement,
    };
  }

  public renderGuideControl(empty: boolean, available: boolean): void {
    if (!this.chrome) return;
    this.chrome.canvasGuideButton.hidden = !available || !empty;
    this.chrome.cheatsheetGuideButton.hidden = !available;
  }

  public renderLegendControl(hasMapSelection: boolean, hasLegend: boolean, legendSelected: boolean): void {
    const button = this.chrome?.legendButton;
    if (!button) return;
    if ((hasMapSelection || legendSelected) && hasLegend) {
      button.dataset.state = legendSelected ? "exclude" : "select";
    } else {
      button.dataset.state = hasLegend ? "edit" : "create";
    }
    button.classList.toggle("selected", legendSelected);
    button.setAttribute("aria-pressed", String(legendSelected));
  }

  public render(text: string, spans: ProjectionSpan[], overlay: XmlEl[], interacting: boolean): void {
    this.gridText.data = text;
    this.renderHighlights(spans);
    this.renderOverlay(overlay);
    if (this.chrome) this.chrome.root.hidden = interacting;
  }

  public renderRulerGrid(visible: boolean, metrics: GridMetrics, offset: Loc): void {
    this.containerEl.toggleAttribute("data-ruler-grid-visible", visible);
    if (!visible) return;

    const column = ((offset.x % RULER_GRID_COLUMNS) + RULER_GRID_COLUMNS) % RULER_GRID_COLUMNS;
    const row = ((offset.y % RULER_GRID_ROWS) + RULER_GRID_ROWS) % RULER_GRID_ROWS;
    this.containerEl.style.setProperty("--slate-ruler-grid-width", `${metrics.charWidth * RULER_GRID_COLUMNS}px`);
    this.containerEl.style.setProperty("--slate-ruler-grid-height", `${metrics.charHeight * RULER_GRID_ROWS}px`);
    this.containerEl.style.setProperty("--slate-ruler-grid-x", `${(column + 0.5) * metrics.charWidth}px`);
    this.containerEl.style.setProperty("--slate-ruler-grid-y", `${(row + 0.5) * metrics.charHeight}px`);
  }

  private renderHighlights(spans: ProjectionSpan[]): void {
    for (const role of PROJECTION_ROLES) {
      const ranges = spans.filter((span) => span.role === role).map((span) => {
        const range = new Range();
        range.setStart(this.gridText, span.start);
        range.setEnd(this.gridText, span.end);
        return range;
      });
      CSS.highlights.set(`topos-${role}`, new Highlight(...ranges));
    }
  }

  public renderOverlay(overlay: XmlEl[]): void {
    this.overlayEl.replaceChildren(...overlay.map((node) => dom.mount(node)));
  }

  public toClientPoint(point: Loc): Loc {
    const box = this.containerEl.getBoundingClientRect();
    return { x: point.x + box.left, y: point.y + box.top };
  }

  public toLocalPoint(point: Loc): Loc {
    const box = this.containerEl.getBoundingClientRect();
    return { x: point.x - box.left, y: point.y - box.top };
  }

  public appendViewportElement(element: HTMLElement): void {
    this.hostEl.appendChild(element);
  }

  public visibleRect(): Rect {
    const scrollBox = this.scrollEl.getBoundingClientRect();
    const origin = this.toLocalPoint({ x: scrollBox.left, y: scrollBox.top });
    return { ...origin, w: this.scrollEl.clientWidth, h: this.scrollEl.clientHeight };
  }

  public viewportPoint(point: Loc): Loc {
    const box = this.hostEl.getBoundingClientRect();
    return { x: point.x - box.left, y: point.y - box.top };
  }

  public viewportRect(): Rect {
    const hostBox = this.hostEl.getBoundingClientRect();
    const scrollBox = this.scrollEl.getBoundingClientRect();
    return {
      x: scrollBox.left - hostBox.left,
      y: scrollBox.top - hostBox.top,
      w: this.scrollEl.clientWidth,
      h: this.scrollEl.clientHeight,
    };
  }

  public get cheatsheetOpen(): boolean {
    return this.chrome !== undefined && !this.chrome.cheatsheet.hidden;
  }

  public toggleCheatsheet(): void {
    if (this.chrome) this.chrome.cheatsheet.hidden = !this.chrome.cheatsheet.hidden;
  }

  public closeCheatsheet(): void {
    if (this.chrome) this.chrome.cheatsheet.hidden = true;
  }

  public dispose(): void {
    for (const role of PROJECTION_ROLES) CSS.highlights.delete(`topos-${role}`);
    this.chromeResizeObserver?.disconnect();
    this.scrollEl.remove();
    this.chrome?.root.remove();
  }
}
