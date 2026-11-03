import template from "./legend.html.js";
import "../css/legend.css";
import type { EditorModel } from "../../../src-editor/model/model.ts";
import { Panel } from "../panel.ts";

export class LegendPane extends Panel {
  model: EditorModel;
  legendInput: HTMLTextAreaElement;
  knownLegend: string;
  knownLegendLines: string[];
  committedLegend: string;

  constructor(model: EditorModel) {
    const mount = document.getElementById("legend-section")!;
    super(mount, mount, "side");
    this.model = model;
    this.knownLegend = model.document.legendSource;
    this.knownLegendLines = this.knownLegend.split("\n");
    this.committedLegend = this.knownLegend;

    const refs = this.materialize(template);
    this.legendInput = refs.legendInput;
    this.legendInput.value = this.knownLegend;

    this.legendInput.addEventListener("input", this.editLegend);
    this.legendInput.addEventListener("change", this.commitLegendEdit);
    this.legendInput.addEventListener("blur", this.commitLegendEdit);
    model.subscribe((_model, event) => this.syncFromModel(event?.commit));
  }

  editLegend = () => {
    this.knownLegend = this.legendInput.value;
    this.knownLegendLines = this.knownLegend.split("\n");
    this.model.updateLegendSource({ text: this.knownLegend, lines: this.knownLegendLines });
  };

  commitLegendEdit = () => {
    if (this.knownLegend === this.committedLegend) return;
    this.model.updateLegendSource({ text: this.knownLegend, lines: this.knownLegendLines }, true);
    this.committedLegend = this.knownLegend;
  };

  syncFromModel(commit = false) {
    if (this.model.document.legendSource === this.knownLegend) return;
    this.knownLegend = this.model.document.legendSource;
    this.knownLegendLines = this.knownLegend.split("\n");
    this.committedLegend = this.knownLegend;
    if (this.legendInput.ownerDocument.activeElement !== this.legendInput) this.legendInput.value = this.knownLegend;
    if (commit && this.knownLegend) this.expanded = true;
  }
}
