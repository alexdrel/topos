const MIN = 0.1;
const MAX = 4;
const EPSILON = 0.0001;
const STEP_RATIO = 1.25;
const SNAP_EPSILON = 0.6;
const ANCHOR_MAGNET = 0.06;
const ANCHORS = [50, 100, 150, 200];

export type FitMode = "width" | "height" | "all";

/** Numeric zoom state; callers measure fit scale and apply changes to their viewport. */
export class Zoom {
  value: number;
  fitMode: FitMode | null;

  constructor(value = 1, fitMode: FitMode | null = null) {
    this.value = 1;
    this.value = this.clamp(value);
    this.fitMode = fitMode;
  }

  get percent() {
    const percent = this.value * 100;
    const snapped = ANCHORS.find((anchor) => Math.abs(percent - anchor) <= SNAP_EPSILON) ?? percent;
    return Math.max(1, Math.round(snapped));
  }

  get actualSize() {
    return Math.abs(this.value - 1) <= EPSILON;
  }

  get canZoomOut() {
    return this.value > MIN + EPSILON;
  }

  get canZoomIn() {
    return this.value < MAX - EPSILON;
  }

  clamp(value: number) {
    return Number.isFinite(value) ? Math.min(MAX, Math.max(MIN, value)) : this.value;
  }

  set(value: number, fitMode: FitMode | null = null) {
    const next = this.clamp(value);
    if (Math.abs(next - this.value) <= EPSILON && this.fitMode === fitMode) return false;
    this.value = next;
    this.fitMode = fitMode;
    return true;
  }

  refresh(fitScale: number) {
    if (this.fitMode) this.value = this.clamp(fitScale);
  }

  step(direction: 1 | -1) {
    const current = this.value * 100;
    const target = direction > 0 ? current * STEP_RATIO : current / STEP_RATIO;
    const anchor = direction > 0 ? ANCHORS.find((value) => value > current + SNAP_EPSILON) : ANCHORS.findLast((value) => value < current - SNAP_EPSILON);
    const magnetic = anchor !== undefined && (direction > 0 ? target >= anchor * (1 - ANCHOR_MAGNET) : target <= anchor * (1 + ANCHOR_MAGNET));
    return this.set((magnetic ? anchor : target) / 100);
  }

  wheel(delta: number) {
    return this.set(this.value * Math.exp(-delta * 0.002));
  }

  toggleFit(fitScale: number, mode: FitMode = "all") {
    return this.actualSize && !this.fitMode ? this.set(fitScale, mode) : this.set(1);
  }
}

/** Scroll offset that keeps the same content point beneath a viewport-relative origin. */
export function zoomScroll(scroll: { x: number; y: number }, origin: { x: number; y: number }, ratio: number) {
  return {
    x: (scroll.x + origin.x) * ratio - origin.x,
    y: (scroll.y + origin.y) * ratio - origin.y,
  };
}
