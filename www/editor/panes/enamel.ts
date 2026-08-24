import enamelHtml from "./enamel.html?raw";
import { isModKey, isTypingTarget } from "../dom-utils.ts";
import { initExport } from "./export.ts";
import { renderToSVG } from "../../../src/enamel/svg.ts";
import { parseTopos } from "../../../src/topos.ts";

export interface EnamelPaneConfig {
  sectionId?: string;
  paneId: string;
  toolbarMountId?: string;
  paperStorageKey?: string;
  keyboardShortcuts?: boolean;
}

const ENAMEL_VIEWER_SCHEMES = ["host", "light", "dark"] as const;
type EnamelViewerScheme = typeof ENAMEL_VIEWER_SCHEMES[number];

export interface EnamelPaneApi {
  setContent(source: string): void;
  clear(): void;
  isExpanded(): boolean;
  refresh(): void;
}

const ENAMEL_ZOOM_MIN = 0.1;
const ENAMEL_ZOOM_MAX = 4;
const ENAMEL_ZOOM_EPSILON = 0.0001;
const ENAMEL_ZOOM_STEP_RATIO = 1.25;
const ENAMEL_PERCENT_SNAP_EPS = 0.6;
const ENAMEL_PERCENT_ANCHOR_MAGNET = 0.06;
const ENAMEL_PERCENT_ANCHORS = [50, 100, 150, 200] as const;
const PAPER_STORAGE_KEY = "topos-editor-enamel-paper";

function isEnamelViewerScheme(value: string): value is EnamelViewerScheme {
  return ENAMEL_VIEWER_SCHEMES.some((scheme) => scheme === value);
}

function createEnamelElements() {
  const wrapper = document.createElement("template");
  wrapper.innerHTML = enamelHtml;
  return {
    toolbar: wrapper.content.querySelector<HTMLElement>("[data-enamel-part=toolbar]")!,
    controls: wrapper.content.querySelector<HTMLElement>("[data-enamel-part=controls]")!,
    pane: wrapper.content.querySelector<HTMLDivElement>("[data-enamel-part=pane]")!,
  };
}

export function initEnamelPane(config: EnamelPaneConfig): EnamelPaneApi {
  const elements = createEnamelElements();
  const sectionId = config.sectionId;
  if (sectionId) {
    const section = document.getElementById(sectionId) as HTMLElement;
    if (section) {
      elements.toolbar.querySelectorAll(".main-only").forEach((element) => element.remove());
      elements.toolbar.classList.add("pane-head");
      elements.controls.classList.add("enamel-head-controls");
      elements.pane.id = config.paneId;
      section.append(elements.toolbar, elements.pane);
    }
  }

  const paneId = config.paneId;
  const toolbarMount = config.toolbarMountId ? document.getElementById(config.toolbarMountId) : null;
  if (toolbarMount) {
    elements.toolbar.querySelectorAll(".side-only").forEach((element) => element.remove());
    elements.toolbar.classList.add("surface-toolbar", "surface-svg-toolbar");
    elements.controls.classList.add("surface-svg-controls");
    toolbarMount.appendChild(elements.toolbar);
  }
  const paperStorageKey = config.paperStorageKey ?? PAPER_STORAGE_KEY;

  const enamelPane = document.getElementById(paneId) as HTMLDivElement;
  const enamelToggleBtn = sectionId ? elements.toolbar.querySelector<HTMLElement>(".pane-head-toggle") : null;
  const controlsContainer = elements.controls;
  const enamelZoomOutBtn = controlsContainer?.querySelector(".btn-zoom-out") as HTMLButtonElement | null;
  const enamelZoomResetBtn = controlsContainer?.querySelector(".btn-zoom-reset") as HTMLButtonElement | null;
  const enamelZoomInBtn = controlsContainer?.querySelector(".btn-zoom-in") as HTMLButtonElement | null;
  const enamelOverrideBtn = controlsContainer?.querySelector(".btn-override") as HTMLButtonElement | null;
  const enamelPaperBtn = controlsContainer?.querySelector(".btn-paper") as HTMLButtonElement | null;

  let enamelExpanded = true;
  let enamelZoom = 1;
  let enamelUseFitZoom = true;
  let enamelViewerScheme: EnamelViewerScheme = "host";
  let enamelOverride = false;
  let currentSource = "";
  let hasContent = false;

  let enamelPanState: {
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null = null;

  function loadInitialEnamelViewerScheme() {
    try {
      const stored = localStorage.getItem(paperStorageKey);
      if (stored && isEnamelViewerScheme(stored)) {
        enamelViewerScheme = stored;
      }
    } catch {
      // Ignore storage errors
    }
  }

  function updateEnamelViewerSchemeButtonState() {
    const label = enamelViewerScheme[0].toUpperCase() + enamelViewerScheme.slice(1);
    if (enamelPaperBtn) {
      enamelPaperBtn.textContent = label;
      enamelPaperBtn.title = `Enamel background: ${label} (click to cycle)`;
      enamelPaperBtn.classList.remove("active");
    }
  }

  function applyEnamelViewerScheme() {
    enamelPane.classList.remove(...ENAMEL_VIEWER_SCHEMES.map((scheme) => `scheme-${scheme}`));
    enamelPane.classList.add(`scheme-${enamelViewerScheme}`);
    updateEnamelViewerSchemeButtonState();

    if (enamelViewerScheme === "host") {
      enamelPane.style.background = "";
    } else if (enamelViewerScheme === "light") {
      enamelPane.style.background = "#fdfaf6";
    } else if (enamelViewerScheme === "dark") {
      enamelPane.style.background = "#1a1a1a";
    }
    if (currentSource) {
      render();
    }
  }

  function hostSurface(): Record<string, string> {
    if (enamelViewerScheme === "light" || enamelViewerScheme === "dark") return { theme: enamelViewerScheme };

    const style = globalThis.getComputedStyle(document.body);
    const paper = style.getPropertyValue("--surface-grad-end").trim();
    const ink = style.getPropertyValue("--canvas-ink").trim();
    return { theme: "host", bg: "transparent", paper, ink };
  }

  globalThis.addEventListener("topos-theme-change", () => {
    if (enamelViewerScheme === "host") applyEnamelViewerScheme();
  });

  function parseLengthNumber(raw: string | null): number | null {
    if (!raw) return null;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function currentEnamelIntrinsicWidth(): number | null {
    const svg = enamelPane.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return null;

    if (svg.viewBox?.baseVal && svg.viewBox.baseVal.width > 0) {
      return svg.viewBox.baseVal.width;
    }
    const attrWidth = parseLengthNumber(svg.getAttribute("width"));
    if (attrWidth) return attrWidth;
    return null;
  }

  function currentEnamelFitZoom(): number {
    const intrinsicWidth = currentEnamelIntrinsicWidth();
    const paneWidth = enamelPane.clientWidth;
    if (intrinsicWidth && intrinsicWidth > 0 && paneWidth > 0) {
      return paneWidth / intrinsicWidth;
    }
    return enamelZoom;
  }

  function clampEnamelZoom(value: number): number {
    if (!Number.isFinite(value)) return enamelZoom;
    return Math.min(ENAMEL_ZOOM_MAX, Math.max(ENAMEL_ZOOM_MIN, value));
  }

  function snapEnamelPercent(percent: number): number {
    // Find the first anchor close enough to snap to, otherwise keep the original percent
    return ENAMEL_PERCENT_ANCHORS.find((a) => Math.abs(percent - a) <= ENAMEL_PERCENT_SNAP_EPS) ?? percent;
  }

  function snapEnamelStepTarget(currentPercent: number, targetPercent: number, direction: 1 | -1): number {
    // 1. Find the immediate next valid anchor
    const anchor = direction > 0
      ? ENAMEL_PERCENT_ANCHORS.find((a) => a > currentPercent + ENAMEL_PERCENT_SNAP_EPS)
      : ENAMEL_PERCENT_ANCHORS.findLast((a) => a < currentPercent - ENAMEL_PERCENT_SNAP_EPS);

    // 2. Check if the target is within the anchor's magnetic pull
    if (anchor !== undefined) {
      const isMagnetic = direction > 0
        ? targetPercent >= anchor * (1 - ENAMEL_PERCENT_ANCHOR_MAGNET)
        : targetPercent <= anchor * (1 + ENAMEL_PERCENT_ANCHOR_MAGNET);

      if (isMagnetic) return anchor;
    }

    return snapEnamelPercent(targetPercent);
  }

  function updateEnamelZoomButtons() {
    const currentPercent = snapEnamelPercent(enamelZoom * 100);
    const zoomPct = `${Math.max(1, Math.round(currentPercent))}%`;
    const fitPercent = Math.max(1, Math.round(clampEnamelZoom(currentEnamelFitZoom()) * 100));
    const atHundred = Math.abs(enamelZoom - 1) <= ENAMEL_ZOOM_EPSILON;
    if (enamelZoomResetBtn) {
      enamelZoomResetBtn.textContent = zoomPct;
      enamelZoomResetBtn.title = atHundred ? `Switch to Fit (${fitPercent}%)` : "Switch to 100%";
    }
    if (enamelZoomOutBtn) {
      enamelZoomOutBtn.disabled = enamelZoom <= ENAMEL_ZOOM_MIN + ENAMEL_ZOOM_EPSILON;
    }
    if (enamelZoomInBtn) {
      enamelZoomInBtn.disabled = enamelZoom >= ENAMEL_ZOOM_MAX - ENAMEL_ZOOM_EPSILON;
    }
  }

  function applyEnamelZoom() {
    if (enamelUseFitZoom) {
      enamelZoom = clampEnamelZoom(currentEnamelFitZoom());
    } else {
      enamelZoom = clampEnamelZoom(enamelZoom);
    }
    enamelPane.style.setProperty("--enamel-zoom", enamelZoom.toFixed(4));
    updateEnamelZoomButtons();
  }

  function setEnamelZoom(nextZoom: number, useFit = false, origin?: { x: number; y: number }) {
    const clamped = clampEnamelZoom(nextZoom);
    if (Math.abs(clamped - enamelZoom) < ENAMEL_ZOOM_EPSILON && enamelUseFitZoom === useFit) return;
    const ratio = clamped / enamelZoom;
    const contentX = origin ? enamelPane.scrollLeft + origin.x : 0;
    const contentY = origin ? enamelPane.scrollTop + origin.y : 0;
    enamelUseFitZoom = useFit;
    enamelZoom = clamped;
    applyEnamelZoom();
    if (origin) enamelPane.scrollTo(contentX * ratio - origin.x, contentY * ratio - origin.y);
  }

  function setEnamelFitZoom() {
    enamelUseFitZoom = true;
    applyEnamelZoom();
  }

  function stepEnamelZoom(direction: 1 | -1) {
    const currentPercent = enamelZoom * 100;
    const targetPercent = direction > 0 ? currentPercent * ENAMEL_ZOOM_STEP_RATIO : currentPercent / ENAMEL_ZOOM_STEP_RATIO;
    const snappedPercent = snapEnamelStepTarget(currentPercent, targetPercent, direction);
    setEnamelZoom(snappedPercent / 100);
  }

  function toggleEnamelReset() {
    if (Math.abs(enamelZoom - 1) <= ENAMEL_ZOOM_EPSILON) {
      setEnamelFitZoom();
      return;
    }
    setEnamelZoom(1, false);
  }

  if (enamelZoomOutBtn) enamelZoomOutBtn.addEventListener("click", () => stepEnamelZoom(-1));
  if (enamelZoomInBtn) enamelZoomInBtn.addEventListener("click", () => stepEnamelZoom(1));
  if (enamelZoomResetBtn) enamelZoomResetBtn.addEventListener("click", () => toggleEnamelReset());

  enamelPane.addEventListener("wheel", (event) => {
    if (!isModKey(event) || event.deltaY === 0) return;
    event.preventDefault();
    const bounds = enamelPane.getBoundingClientRect();
    const origin = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    setEnamelZoom(enamelZoom * Math.exp(-event.deltaY * 0.002), false, origin);
  }, { passive: false });

  if (enamelOverrideBtn) {
    enamelOverrideBtn.addEventListener("click", () => {
      enamelOverride = !enamelOverride;
      enamelOverrideBtn.classList.toggle("active", enamelOverride);
      if (currentSource) render();
    });
  }

  if (enamelPaperBtn) {
    enamelPaperBtn.addEventListener("click", () => {
      const idx = ENAMEL_VIEWER_SCHEMES.indexOf(enamelViewerScheme);
      enamelViewerScheme = ENAMEL_VIEWER_SCHEMES[(idx + 1) % ENAMEL_VIEWER_SCHEMES.length];
      applyEnamelViewerScheme();
      try {
        localStorage.setItem(paperStorageKey, enamelViewerScheme);
      } catch {
        // Ignore
      }
    });
  }

  enamelPane.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || event.target instanceof HTMLButtonElement) return;
    enamelPanState = {
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: enamelPane.scrollLeft,
      startScrollTop: enamelPane.scrollTop,
    };
    enamelPane.classList.add("is-panning");
    event.preventDefault();
  });

  globalThis.addEventListener("mousemove", (event) => {
    if (enamelPanState) {
      const dx = event.clientX - enamelPanState.startX;
      const dy = event.clientY - enamelPanState.startY;
      enamelPane.scrollLeft = enamelPanState.startScrollLeft - dx;
      enamelPane.scrollTop = enamelPanState.startScrollTop - dy;
      return;
    }
  });

  globalThis.addEventListener("mouseup", () => {
    if (enamelPanState) {
      enamelPanState = null;
      enamelPane.classList.remove("is-panning");
    }
  });

  enamelToggleBtn?.addEventListener("click", () => {
    enamelExpanded = !enamelExpanded;
    globalThis.dispatchEvent(new Event("resize"));
  });

  loadInitialEnamelViewerScheme();
  applyEnamelViewerScheme();

  function renderExportSvg(transparent: boolean): string {
    return renderToSVG(parseTopos(currentSource), {
      parameters: hostSurface(),
      override: enamelOverride,
      transparent,
    });
  }

  if (toolbarMount) {
    initExport({
      controls: controlsContainer,
      renderSvg: renderExportSvg,
      isActive: () => hasContent,
      keyboardShortcuts: config.keyboardShortcuts,
    });
  }

  if (config.keyboardShortcuts) {
    globalThis.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (!hasContent || isTypingTarget(event.target)) return;
      if (!event.metaKey && !event.ctrlKey && !event.altKey && (key === "+" || key === "=" || key === "-")) {
        event.preventDefault();
        stepEnamelZoom(key === "-" ? -1 : 1);
      }
    });
  }

  function render() {
    enamelPane.innerHTML = renderToSVG(parseTopos(currentSource), {
      parameters: hostSurface(),
      override: enamelOverride,
      transparent: enamelOverride ? true : undefined,
    });
    applyEnamelZoom();
  }

  return {
    setContent: (source: string) => {
      currentSource = source;
      hasContent = true;
      render();
    },
    clear: () => {
      hasContent = false;
      enamelPane.innerHTML = "";
    },
    isExpanded: () => enamelExpanded,
    refresh: () => {
      applyEnamelViewerScheme();
      applyEnamelZoom();
    },
  };
}
