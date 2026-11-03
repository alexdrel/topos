import { filterElements, fragments, nodes } from "@alexdrel/jsonml-ts";
import { appendChild, type Blueprint, type BlueprintParams, type BlueprintRefs, materialize } from "@alexdrel/pralinejs";
import "./css/panel.css";

type PanelRefs = {
  panelToolbar: HTMLElement;
  panelBody: HTMLElement;
};

export class Panel {
  toolbarMount: HTMLElement;
  bodyMount: HTMLElement;
  mode: "side" | "main";
  toolbar!: HTMLElement;
  content!: HTMLElement;
  visible = true;
  canCollapse: boolean;
  onResize?: () => void;

  constructor(toolbarMount: HTMLElement, bodyMount: HTMLElement, mode: "side" | "main") {
    this.toolbarMount = toolbarMount;
    this.bodyMount = bodyMount;
    this.mode = mode;
    this.canCollapse = mode === "side";
  }

  materialize<const B extends Blueprint<object, PanelRefs>>(template: B, params?: NoInfer<Partial<BlueprintParams<B>>>): BlueprintRefs<B> {
    const tree = filterElements(fragments(template), (node) => node[1]["data-panel-mode"] === undefined || node[1]["data-panel-mode"] === this.mode);
    const sources = params === undefined ? [this] : [params, this];
    const refs = materialize(nodes(tree), sources).refs as BlueprintRefs<B>;
    this.toolbar = refs.panelToolbar;
    this.content = refs.panelBody;
    if (this.mode === "side") {
      appendChild(this.toolbar, [["span", { class: "pane-chevron" }, "▾"]]);
    }
    this.toolbar.addEventListener("click", this.toggleHeader.bind(this));
    this.toolbar.classList.add(this.mode === "side" ? "pane-head" : "surface-toolbar");
    this.toolbar.classList.toggle("panel-fixed", !this.canCollapse);
    this.toolbarMount.appendChild(this.toolbar);
    this.bodyMount.appendChild(this.content);
    return refs;
  }

  get collapsible() {
    return this.canCollapse;
  }

  set collapsible(value: boolean) {
    this.canCollapse = this.mode === "side" && value;
    this.toolbar.classList.toggle("panel-fixed", !this.canCollapse);
    this.content.hidden = !this.visible || !this.expanded;
  }

  get expanded() {
    return !this.collapsible || !this.toolbar.classList.contains("panel-collapsed");
  }

  set expanded(value: boolean) {
    if (!this.collapsible) return;
    this.toolbar.classList.toggle("panel-collapsed", !value);
    this.content.hidden = !this.visible || !value;
    globalThis.dispatchEvent(new Event("resize"));
  }

  toggleExpanded() {
    this.expanded = !this.expanded;
  }

  toggleHeader({ target }: MouseEvent) {
    const element = target as Element;
    if (element.closest(".pane-head-toggle, .pane-chevron")) this.toggleExpanded();
  }

  toggle(visible?: boolean) {
    this.visible = visible ?? !this.visible;
    if (this.toolbarMount === this.bodyMount) this.toolbarMount.hidden = !this.visible;
    this.toolbar.hidden = !this.visible;
    this.content.hidden = !this.visible || !this.expanded;
  }
}
