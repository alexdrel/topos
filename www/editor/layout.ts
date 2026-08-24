export interface LayoutPaneConfig {
  getInspectorExpanded: () => boolean;
  getLegendExpanded: () => boolean;
  getEnamelExpanded: () => boolean;
  onLayoutChange: () => void;
}

export interface LayoutPaneApi {
  initialize(): void;
  updateSidePanelState(): void;
  refreshLayoutAfterWindowResize(): void;
}

type LayoutPrefs = {
  sideWidth?: number;
  inspectorRatio?: number;
  legendRatio?: number;
};

const LAYOUT_STORAGE_KEY = "topos-editor-layout-v1";
const SIDE_WIDTH_MIN = 240;
const MAIN_WIDTH_MIN = 333;
const SIDE_SECTION_MIN = 96;
const LAYOUT_STACK_BREAKPOINT = 760;

export function initLayoutPane(config: LayoutPaneConfig): LayoutPaneApi {
  const workspace = document.querySelector(".workspace") as HTMLDivElement;
  const workspaceSplitter = document.getElementById("workspace-splitter") as HTMLDivElement;
  const sidePanel = document.querySelector(".side-panel") as HTMLDivElement;
  const sideSplitter = document.getElementById("side-splitter") as HTMLDivElement;
  const legendSplitter = document.getElementById("legend-splitter") as HTMLDivElement | null;

  let inspectorRatioPref = 0.4;
  let legendRatioPref = 0.2;
  let layoutStorageReady = false;

  let activeDragHandler: ((e: MouseEvent) => void) | null = null;

  function loadLayoutPrefs(): LayoutPrefs {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as LayoutPrefs;
      const sideWidth = Number(parsed?.sideWidth);
      const inspectorRatio = Number(parsed?.inspectorRatio);
      const legendRatio = Number(parsed?.legendRatio);
      const safe: LayoutPrefs = {};
      if (Number.isFinite(sideWidth) && sideWidth > 0) safe.sideWidth = sideWidth;
      if (Number.isFinite(inspectorRatio) && inspectorRatio >= 0.05 && inspectorRatio <= 0.95) safe.inspectorRatio = inspectorRatio;
      if (Number.isFinite(legendRatio) && legendRatio >= 0.05 && legendRatio <= 0.95) safe.legendRatio = legendRatio;
      return safe;
    } catch {
      return {};
    }
  }

  function saveLayoutPrefs() {
    if (!layoutStorageReady) return;
    const sideWidth = Math.round(sidePanel.getBoundingClientRect().width);
    const prefs: LayoutPrefs = {
      sideWidth,
      inspectorRatio: inspectorRatioPref,
      legendRatio: legendRatioPref,
    };
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore
    }
  }

  function applyLength(
    element: HTMLElement,
    cssVar: string,
    value: number,
    min: number,
    max: number,
    totalAvailable: number,
    saveRatio: (r: number) => void,
  ): number {
    const clamped = Math.round(Math.min(max, Math.max(min, value)));
    element.style.setProperty(cssVar, `${clamped}px`);
    if (totalAvailable > 0) {
      saveRatio(Math.min(0.95, Math.max(0.05, clamped / totalAvailable)));
    }
    return clamped;
  }

  function applySideWidth(width: number, persist = true) {
    const maxWidth = Math.max(SIDE_WIDTH_MIN, workspace.clientWidth - MAIN_WIDTH_MIN - (workspaceSplitter.offsetWidth || 8));
    applyLength(workspace, "--side-width", width, SIDE_WIDTH_MIN, maxWidth, 0, () => {});
    config.onLayoutChange();
    if (persist) saveLayoutPrefs();
  }

  function applyInspectorHeight(height: number, decreaseLegend = false, persist = true, startLegendHeight?: number, startInspectorHeight?: number) {
    const total = sidePanel.clientHeight;
    const splitH = sideSplitter.offsetHeight || 8;
    const maxH = Math.max(SIDE_SECTION_MIN, total - splitH - SIDE_SECTION_MIN);

    const clamped = applyLength(
      sidePanel,
      "--inspector-size",
      height,
      SIDE_SECTION_MIN,
      maxH,
      Math.max(1, total - splitH * 2),
      (r) => inspectorRatioPref = r,
    );

    if (decreaseLegend && config.getLegendExpanded() && startLegendHeight !== undefined && startInspectorHeight !== undefined) {
      const diff = clamped - startInspectorHeight;
      applyLegendHeight(Math.max(SIDE_SECTION_MIN, startLegendHeight - diff), false);
    }

    config.onLayoutChange();
    if (persist) saveLayoutPrefs();
  }

  function applyLegendHeight(height: number, persist = true) {
    const total = sidePanel.clientHeight;
    const splitH = (sideSplitter.offsetHeight || 8) * 2;
    const topSection = document.getElementById("inspector-section")!;
    const inspectorH = topSection?.getBoundingClientRect().height || SIDE_SECTION_MIN;
    const maxH = Math.max(SIDE_SECTION_MIN, total - splitH - inspectorH - SIDE_SECTION_MIN);

    applyLength(sidePanel, "--legend-size", height, SIDE_SECTION_MIN, maxH, Math.max(1, total - splitH), (r) => legendRatioPref = r);
    config.onLayoutChange();
    if (persist) saveLayoutPrefs();
  }

  function bindSplitter(
    splitter: HTMLElement | null,
    cursor: string,
    onDragStart: (e: MouseEvent) => (e: MouseEvent) => void,
  ) {
    if (!splitter) return;
    splitter.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      if (globalThis.matchMedia(`(max-width: ${LAYOUT_STACK_BREAKPOINT}px)`).matches) return;

      activeDragHandler = onDragStart(event);
      document.body.classList.add("resizing-layout");
      document.body.style.cursor = cursor;
      event.preventDefault();
    });
  }

  bindSplitter(workspaceSplitter, "ew-resize", (e) => {
    const startX = e.clientX;
    const startW = sidePanel.getBoundingClientRect().width;
    return (ev) => applySideWidth(startW + (startX - ev.clientX));
  });

  bindSplitter(sideSplitter, "ns-resize", (e) => {
    const startY = e.clientY;
    const topSection = document.getElementById("inspector-section")!;
    const startInsp = topSection?.getBoundingClientRect().height || SIDE_SECTION_MIN;
    const startLeg = document.getElementById("legend-section")?.getBoundingClientRect().height || 0;
    return (ev) => applyInspectorHeight(startInsp + (ev.clientY - startY), true, true, startLeg, startInsp);
  });

  bindSplitter(legendSplitter, "ns-resize", (e) => {
    const startY = e.clientY;
    const startLeg = document.getElementById("legend-section")?.getBoundingClientRect().height || SIDE_SECTION_MIN;
    return (ev) => applyLegendHeight(startLeg + (ev.clientY - startY));
  });

  globalThis.addEventListener("mousemove", (event) => {
    if (activeDragHandler) activeDragHandler(event);
  });

  globalThis.addEventListener("mouseup", () => {
    activeDragHandler = null;
    document.body.classList.remove("resizing-layout");
    document.body.style.cursor = "";
  });

  function updateSidePanelState() {
    sidePanel.classList.toggle("inspector-collapsed", !config.getInspectorExpanded());
    sidePanel.classList.toggle("legend-collapsed", !config.getLegendExpanded());
    sidePanel.classList.toggle("enamel-collapsed", !config.getEnamelExpanded());
    config.onLayoutChange();
  }

  function initialize() {
    const prefs = loadLayoutPrefs();
    if (prefs.inspectorRatio !== undefined) inspectorRatioPref = prefs.inspectorRatio;
    if (prefs.legendRatio !== undefined) legendRatioPref = prefs.legendRatio;
    applySideWidth(prefs.sideWidth ?? (sidePanel.getBoundingClientRect().width || 340), false);
    if (!sidePanel.style.getPropertyValue("--inspector-size")) {
      const splitterHeight = (sideSplitter?.offsetHeight || 8) * 2;
      const available = Math.max(0, sidePanel.clientHeight - splitterHeight);
      if (available > 0) {
        applyInspectorHeight(available * inspectorRatioPref, false, false);
        applyLegendHeight(available * legendRatioPref, false);
      }
    }
    layoutStorageReady = true;
    saveLayoutPrefs();
    updateSidePanelState();
  }

  function refreshLayoutAfterWindowResize() {
    updateSidePanelState();
    applySideWidth(sidePanel.getBoundingClientRect().width, false);
    const splitterHeight = (sideSplitter?.offsetHeight || 8) * 2;
    const available = Math.max(0, sidePanel.clientHeight - splitterHeight);
    if (available > 0) {
      applyInspectorHeight(available * inspectorRatioPref, false, false);
      applyLegendHeight(available * legendRatioPref, false);
    }
  }

  globalThis.addEventListener("resize", () => {
    refreshLayoutAfterWindowResize();
  });

  return {
    initialize,
    updateSidePanelState,
    refreshLayoutAfterWindowResize,
  };
}
