import * as dom from "./dom.ts";
import type { GridMetrics } from "./grid.ts";

export class GridMeasurer {
  public metrics: GridMetrics;

  private readonly probe: HTMLSpanElement;
  private readonly resizeObserver?: ResizeObserver;
  private readonly onFontsLoaded = () => {
    if (this.measure()) this.onChange();
  };

  constructor(gridEl: HTMLElement, private readonly onChange: () => void) {
    this.probe = dom.mount(dom.htmlEl("span", { style: "position: absolute; visibility: hidden; display: inline-block;" }, "M")) as HTMLSpanElement;
    gridEl.appendChild(this.probe);
    this.metrics = this.read();
    if (this.metrics.charWidth <= 0) this.metrics = { charWidth: 9, charHeight: 18 };

    document.fonts?.addEventListener("loadingdone", this.onFontsLoaded);
    document.fonts?.ready.then(this.onFontsLoaded);
    if (globalThis.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.measure()) this.onChange();
      });
      this.resizeObserver.observe(this.probe);
    }
  }

  public measure(): boolean {
    const metrics = this.read();
    if (metrics.charWidth <= 0) return false;
    if (metrics.charWidth === this.metrics.charWidth && metrics.charHeight === this.metrics.charHeight) return false;
    this.metrics = metrics;
    return true;
  }

  public dispose(): void {
    document.fonts?.removeEventListener("loadingdone", this.onFontsLoaded);
    this.resizeObserver?.disconnect();
    this.probe.remove();
  }

  private read(): GridMetrics {
    const box = this.probe.getBoundingClientRect();
    return { charWidth: box.width, charHeight: box.height };
  }
}
