import legendHtml from "./legend.html?raw";
import type { EditorModel } from "../../../src-editor/model/model.ts";

export interface LegendPaneApi {
  setExpanded(expanded: boolean): void;
  isExpanded(): boolean;
}

export function initLegendPane(model: EditorModel): LegendPaneApi {
  const legendSection = document.getElementById("legend-section") as HTMLElement;
  if (legendSection) {
    legendSection.innerHTML = legendHtml;
  }

  const legendInput = document.getElementById("legend-input") as HTMLTextAreaElement;
  const toggleBtn = document.getElementById("btn-legend-toggle");
  let expanded = true;
  let dirty = false;
  let knownLegend = model.document.legendSource;
  let knownLegendLines = knownLegend.split("\n");
  let committedLegend = knownLegend;
  legendInput.value = knownLegend;

  function setExpanded(e: boolean) {
    if (!toggleBtn || !legendSection) return;
    expanded = e;
    legendSection.classList.toggle("collapsed", !expanded);
    globalThis.dispatchEvent(new Event("resize"));
  }

  toggleBtn?.addEventListener("click", () => setExpanded(!expanded));

  legendInput.addEventListener("input", () => {
    knownLegend = legendInput.value;
    knownLegendLines = knownLegend.split("\n");
    dirty = knownLegend !== committedLegend;
    model.updateLegendSource({ text: knownLegend, lines: knownLegendLines });
  });
  function commitLegendEdit() {
    if (!dirty) return;
    dirty = false;
    model.updateLegendSource({ text: knownLegend, lines: knownLegendLines }, true);
    committedLegend = knownLegend;
  }
  legendInput.addEventListener("change", commitLegendEdit);
  legendInput.addEventListener("blur", commitLegendEdit);

  model.subscribe((_model, event) => {
    if (model.document.legendSource === knownLegend) {
      return;
    }
    knownLegend = model.document.legendSource;
    knownLegendLines = knownLegend.split("\n");
    committedLegend = knownLegend;
    dirty = false;
    if (document.activeElement !== legendInput) legendInput.value = knownLegend;
    if (event?.commit && knownLegend) setExpanded(true);
  });

  return {
    setExpanded,
    isExpanded: () => expanded,
  };
}
