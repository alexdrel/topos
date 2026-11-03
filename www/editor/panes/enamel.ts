import { PersistedSignal } from "../signals/persisted-signal.ts";
import { type Context, observe, throttle } from "@alexdrel/perky";
import { Theme } from "../signals/theme.ts";
import { Panel } from "../panel.ts";
import template, { type Params, type Refs } from "./enamel.html.js";
import "../css/enamel.css";
import { isModKey, isTypingTarget } from "../dom-utils.ts";
import { Zoom, zoomScroll } from "../zoom.ts";
import { ExportMenu } from "./export.ts";
import { renderToSVG } from "../../../src/enamel/svg.ts";
import { parseTopos } from "../../../src/topos.ts";

const VIEWER_SCHEMES = ["host", "light", "dark"] as const;
const paperSignal = new PersistedSignal("topos-editor-enamel-paper", VIEWER_SCHEMES);

function parseLengthNumber(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export abstract class EnamelViewer extends Panel implements Partial<Params> {
  refs: Refs;
  zoom = new Zoom(1, "width");
  override = false;
  source: string | null = null;
  panState: {
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null = null;

  constructor(context: Context, toolbarMount: HTMLElement, bodyMount: HTMLElement, mode: "side" | "main") {
    super(toolbarMount, bodyMount, mode);
    this.refs = this.materialize(template, {
      zoomOut: () => this.stepZoom(-1),
      zoomIn: () => this.stepZoom(1),
      toggleOverride: () => (this.override = !this.override),
    });

    throttle(this, "render");
    observe(this, "source", this.render);
    observe(this, "override", (override) => {
      this.refs.overrideBtn.classList.toggle("active", override);
      this.render();
    });
    observe(this, "panState", (pan) => {
      this.content.classList.toggle("is-panning", pan !== null);
    });
    paperSignal.subscribe((scheme) => {
      this.content.dataset.scheme = scheme;
      this.refs.paperBtn.textContent = scheme;
      this.render();
    });
    context.observe(Theme, () => {
      if (paperSignal.value === "host") this.render();
    });

    this.onResize = () => this.applyZoom();
    this.content.addEventListener("wheel", this.onWheel, { passive: false });
    this.content.addEventListener("mousedown", this.onMouseDown);
    globalThis.addEventListener("mousemove", this.onMouseMove);
    globalThis.addEventListener("mouseup", this.onMouseUp);
  }

  hostSurface(): Record<string, string> {
    if (paperSignal.value === "light" || paperSignal.value === "dark") return { theme: paperSignal.value };
    const style = globalThis.getComputedStyle(document.body);
    const paper = style.getPropertyValue("--surface-grad-end").trim();
    const ink = style.getPropertyValue("--canvas-ink").trim();
    return { theme: "host", bg: "transparent", paper, ink };
  }

  intrinsicWidth(): number | null {
    const svg = this.content.querySelector("svg");
    if (!svg) return null;
    if (svg.viewBox?.baseVal && svg.viewBox.baseVal.width > 0) return svg.viewBox.baseVal.width;
    return parseLengthNumber(svg.getAttribute("width"));
  }

  fitZoom(): number {
    const width = this.intrinsicWidth();
    return width && this.content.clientWidth > 0 ? this.content.clientWidth / width : this.zoom.value;
  }

  applyZoom() {
    this.zoom.refresh(this.fitZoom());
    this.content.style.setProperty("--enamel-zoom", this.zoom.value.toFixed(4));
    const { zoom } = this.refs;
    zoom.reset.textContent = `${this.zoom.percent}%`;
    zoom.out.disabled = !this.zoom.canZoomOut;
    zoom.in.disabled = !this.zoom.canZoomIn;
  }

  stepZoom(direction: 1 | -1) {
    if (this.zoom.step(direction)) this.applyZoom();
  }

  resetZoom() {
    this.zoom.toggleFit(this.fitZoom(), "width");
    this.applyZoom();
  }

  onWheel = (event: WheelEvent) => {
    if (!isModKey(event) || event.deltaY === 0) return;
    event.preventDefault();
    const bounds = this.content.getBoundingClientRect();
    const origin = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const previous = this.zoom.value;
    if (!this.zoom.wheel(event.deltaY)) return;
    const scroll = zoomScroll({ x: this.content.scrollLeft, y: this.content.scrollTop }, origin, this.zoom.value / previous);
    this.applyZoom();
    this.content.scrollTo(scroll.x, scroll.y);
  };

  cyclePaper() {
    const index = VIEWER_SCHEMES.indexOf(paperSignal.value);
    paperSignal.value = VIEWER_SCHEMES[(index + 1) % VIEWER_SCHEMES.length];
  }

  onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || event.target instanceof HTMLButtonElement) return;
    this.panState = {
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: this.content.scrollLeft,
      startScrollTop: this.content.scrollTop,
    };
    event.preventDefault();
  };

  onMouseMove = (event: MouseEvent) => {
    const pan = this.panState;
    if (!pan) return;
    this.content.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startX);
    this.content.scrollTop = pan.startScrollTop - (event.clientY - pan.startY);
  };

  onMouseUp = () => {
    this.panState = null;
  };

  render() {
    const source = this.source;
    if (source === null) {
      this.content.replaceChildren();
      return;
    }
    this.content.innerHTML = renderToSVG(parseTopos(source), {
      parameters: this.hostSurface(),
      override: this.override,
      transparent: this.override ? true : undefined,
    });
    this.applyZoom();
  }
}

export class EnamelPane extends EnamelViewer {
  constructor(context: Context) {
    const mount = document.getElementById("enamel-section")!;
    super(context, mount, mount, "side");
  }
}

export class MainEnamelViewer extends EnamelViewer {
  exportMenu: ExportMenu;

  constructor(context: Context) {
    super(context, document.getElementById("surface-toolbar-mount")!, document.getElementById("surface-stack")!, "main");
    this.exportMenu = new ExportMenu(this.refs.exportMenuDropdown, this.renderExportSvg);
    globalThis.addEventListener("keydown", this.onKeyDown);
  }

  renderExportSvg = (transparent: boolean): string => {
    return renderToSVG(parseTopos(this.source ?? ""), {
      parameters: this.hostSurface(),
      override: this.override,
      transparent,
    });
  };

  onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (this.source === null || isTypingTarget(event.target)) return;
    if ((event.metaKey || event.ctrlKey) && key === "c") {
      event.preventDefault();
      if (event.shiftKey) this.exportMenu.copyXml();
      else this.exportMenu.copyPng();
    } else if (!event.metaKey && !event.ctrlKey && !event.altKey && (key === "+" || key === "=" || key === "-")) {
      event.preventDefault();
      this.stepZoom(key === "-" ? -1 : 1);
    }
  };
}
