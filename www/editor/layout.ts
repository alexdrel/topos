import { PersistedSignal } from "./signals/persisted-signal.ts";
import type { Panel } from "./panel.ts";
import "./css/layout.css";

interface LayoutPrefs {
  sideWidth?: number;
  shares?: number[];
}

function readLayout(value: unknown): LayoutPrefs {
  const stored = value as LayoutPrefs | null;
  const prefs: LayoutPrefs = {};
  if (typeof stored?.sideWidth === "number" && Number.isFinite(stored.sideWidth) && stored.sideWidth > 0) prefs.sideWidth = stored.sideWidth;
  if (Array.isArray(stored?.shares) && stored.shares.every((share) => Number.isFinite(share) && share > 0)) prefs.shares = stored.shares;
  return prefs;
}

/** Distribute available height by weight, freezing panels that reach their minimum. */
export function panelHeights(available: number, shares: number[], minimums: number[]): number[] {
  let remaining = Math.max(
    available,
    minimums.reduce((sum, height) => sum + height, 0),
  );
  let pending = shares.map((_, index) => index);
  const heights = shares.map(() => 0);
  while (pending.length) {
    const weight = pending.reduce((sum, index) => sum + shares[index], 0);
    const limited = pending.filter((index) => (remaining * shares[index]) / weight < minimums[index]);
    if (!limited.length) {
      for (const index of pending) heights[index] = (remaining * shares[index]) / weight;
      break;
    }
    for (const index of limited) {
      heights[index] = minimums[index];
      remaining -= heights[index];
    }
    pending = pending.filter((index) => !limited.includes(index));
  }
  return heights;
}

export class Layout {
  workspace: HTMLElement;
  sidebar: HTMLElement;
  panels: Panel[];
  sidePanels: Panel[];
  shares: number[];
  splitters: HTMLElement[];
  observer: ResizeObserver;
  preferences = new PersistedSignal("topos-editor-layout-v1", readLayout);
  drag?: (event: MouseEvent) => void;

  constructor(workspace: HTMLElement, sidebar: HTMLElement, mainPanels: Panel[], sidePanels: Panel[]) {
    this.workspace = workspace;
    this.sidebar = sidebar;
    this.sidePanels = sidePanels;
    this.panels = [...mainPanels, ...this.sidePanels];
    this.shares = sidePanels.map((_, index) => this.preferences.value.shares?.[index] ?? 1);
    this.splitters = this.sidePanels.slice(0, -1).map((panel, index) => {
      const splitter = document.createElement("div");
      splitter.className = "panel-splitter panel-splitter-horizontal";
      sidebar.append(panel.toolbarMount, splitter);
      this.bindSplitter(splitter, "ns-resize", (event) => this.startPanelDrag(index, event));
      return splitter;
    });
    const last = this.sidePanels.at(-1);
    if (last) sidebar.appendChild(last.toolbarMount);
    this.bindSplitter(document.getElementById("workspace-splitter")!, "ew-resize", (event) => {
      const start = event.clientX;
      const width = sidebar.getBoundingClientRect().width;
      return (next) => {
        const sideWidth = this.clampWidth(width + start - next.clientX);
        this.preferences.value = { sideWidth, shares: this.shares };
        this.resize();
      };
    });
    globalThis.addEventListener("mousemove", (event) => this.drag?.(event));
    globalThis.addEventListener("mouseup", () => {
      this.drag = undefined;
      document.body.classList.remove("resizing-layout");
      document.body.style.cursor = "";
    });
    globalThis.addEventListener("resize", this.resize);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(workspace);
    this.observer.observe(sidebar);
  }

  clampWidth(width: number) {
    const style = getComputedStyle(this.workspace);
    const available = this.workspace.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return Math.max(240, Math.min(Math.max(240, available - 333 - 8), width));
  }

  bindSplitter(splitter: HTMLElement, cursor: string, start: (event: MouseEvent) => ((event: MouseEvent) => void) | undefined) {
    splitter.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || matchMedia("(max-width: 760px)").matches) return;
      this.drag = start(event);
      if (!this.drag) return;
      document.body.classList.add("resizing-layout");
      document.body.style.cursor = cursor;
      event.preventDefault();
    });
  }

  startPanelDrag(index: number, event: MouseEvent) {
    const panel = this.sidePanels[index];
    const nextIndex = this.sidePanels.findIndex((next, i) => i > index && next.visible && next.expanded);
    if (!panel.visible || !panel.expanded || nextIndex < 0) return;
    const next = this.sidePanels[nextIndex];
    const height = panel.toolbarMount.getBoundingClientRect().height;
    const total = height + next.toolbarMount.getBoundingClientRect().height;
    const expanded = this.sidePanels.filter((item) => item.visible && item.expanded);
    const activeWeight = expanded.reduce((sum, item) => sum + this.shares[this.sidePanels.indexOf(item)], 0);
    const activeHeight = expanded.reduce((sum, item) => sum + item.toolbarMount.getBoundingClientRect().height, 0);
    const shares = [...this.shares];
    for (const item of expanded) shares[this.sidePanels.indexOf(item)] = (activeWeight * item.toolbarMount.getBoundingClientRect().height) / activeHeight;
    const weight = shares[index] + shares[nextIndex];
    const minimum = Math.min(96, total / 2);
    const start = event.clientY;
    return (move: MouseEvent) => {
      const size = Math.max(minimum, Math.min(total - minimum, height + move.clientY - start));
      this.shares = [...shares];
      this.shares[index] = (weight * size) / total;
      this.shares[nextIndex] = weight - this.shares[index];
      this.preferences.value = { ...this.preferences.value, shares: [...this.shares] };
      this.resize();
    };
  }

  resize = () => {
    this.workspace.style.setProperty("--side-width", `${this.clampWidth(this.preferences.value.sideWidth ?? 340)}px`);
    const visible = this.sidePanels.filter((panel) => panel.visible);
    for (const panel of visible) panel.collapsible = visible.length > 1;
    const expanded = this.sidePanels.filter((panel) => panel.visible && panel.expanded);
    this.splitters.forEach((splitter, index) => {
      const panel = this.sidePanels[index];
      const active = panel.visible && panel.expanded && panel !== expanded.at(-1);
      splitter.hidden = !active;
    });
    const style = getComputedStyle(this.sidebar);
    const gaps = this.splitters.reduce((sum, splitter) => sum + splitter.getBoundingClientRect().height, 0);
    const collapsed = this.sidePanels.filter((panel) => panel.visible && !panel.expanded);
    for (const panel of collapsed) panel.toolbarMount.style.flex = "0 0 auto";
    const headers = collapsed.reduce((sum, panel) => sum + panel.toolbarMount.getBoundingClientRect().height, 0);
    const available = this.sidebar.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - gaps - headers;
    const minimums = expanded.map((panel) =>
      Math.max(96, panel.toolbar.getBoundingClientRect().height + panel.toolbarMount.offsetHeight - panel.toolbarMount.clientHeight)
    );
    const shares = expanded.map((panel) => this.shares[this.sidePanels.indexOf(panel)]);
    const heights = panelHeights(available, shares, minimums);
    expanded.forEach((panel, index) => {
      panel.toolbarMount.style.flex = `0 0 ${heights[index]}px`;
    });
    for (const panel of this.panels) if (panel.visible && panel.expanded) panel.onResize?.();
  };
}
