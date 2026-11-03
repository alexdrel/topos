import type { EditorModel } from "../../../src-editor/model/model.ts";
import { observe, type Signal } from "@alexdrel/perky";
import { cancelInteraction, type MainEditorView } from "../app-context.ts";
import { themeOption, themeSignal } from "../signals/theme.ts";
import { fontOption, fontSignal } from "../signals/font.ts";
import { showTemporaryLabel } from "../dom-utils.ts";
import { type DropdownMenu, initChoiceMenu, initDropdownMenu } from "../menus.ts";
import template, { type Params, type Refs } from "./toolbar.html.js";
import "../css/toolbar.css";
import { materialize } from "@alexdrel/pralinejs";

const folderIcons: Record<string, string> = { museum: "🏛️", cases: "🧪" };

function diagramOption(path: string) {
  const segments = path.replace(/^\/+/, "").split("/");
  const name = segments.at(-1)!.replace(/\.topos$/i, "");
  return {
    name,
    folder: segments.slice(0, -1).join("/"),
    icon: folderIcons[segments[0]] ?? "📄",
    groupClass: "",
    url: `/__topos/cases/${segments.map(encodeURIComponent).join("/")}`,
  };
}

export class Toolbar implements Params {
  refs: Refs;
  model: EditorModel;
  mainEditorView: Signal<MainEditorView>;
  diagramMenu: DropdownMenu;
  currentDocument: { name: string; icon: string; url: string | null } = { name: "Untitled", icon: "📄", url: null };
  renderMonosketch!: (name: string) => string;

  constructor(model: EditorModel, mainEditorView: Signal<MainEditorView>) {
    this.model = model;
    this.mainEditorView = mainEditorView;
    const { fragment, refs } = materialize(template, [this, { themeItem: themeOption, fontItem: fontOption }]);
    this.refs = refs;
    document.getElementById("topbar")!.append(fragment);

    initChoiceMenu(refs.themeMenu, themeSignal);
    initChoiceMenu(refs.fontMenu, fontSignal);
    this.diagramMenu = initDropdownMenu(refs.diagram.menu, () => this.loadLibrary());
    observe(this, "currentDocument", ({ name, icon, url }) => {
      refs.diagram.name.textContent = name;
      refs.diagram.icon.textContent = icon;
      refs.diagram.reload.disabled = url === null;
    });
    mainEditorView.subscribe((view) => {
      refs.svgFocusBtn.classList.toggle("active", view === "svg");
      refs.svgFocusBtn.setAttribute("aria-pressed", String(view === "svg"));
      refs.sourceFocusBtn.classList.toggle("active", view === "source");
      refs.sourceFocusBtn.setAttribute("aria-pressed", String(view === "source"));
    });
  }

  exportMono() {
    const { name } = this.currentDocument;
    const blob = new Blob([this.renderMonosketch(name)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.mono`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  newDocument() {
    cancelInteraction.value = this;
    this.model.applySource("");
    this.currentDocument = { name: "Untitled", icon: "📄", url: null };
    this.mainEditorView.value = "slate";
  }

  async loadLibrary() {
    try {
      const response = await fetch("/__topos/cases/", { cache: "no-store" });
      if (!response.ok) throw new Error(`failed ${response.status}`);
      const paths = (await response.json()) as string[];

      const diagrams = paths.map(diagramOption).sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
      for (const [i, d] of diagrams.entries()) {
        if (i == 0 || d.folder !== diagrams[i - 1]?.folder) d.groupClass = "group-start";
      }
      this.refs.diagramItem.replaceItems(diagrams);
    } catch (error) {
      console.error("Failed to load diagram library:", error);
    }
  }

  async loadDiagram(url: string, name: string, icon: string) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`failed ${response.status}`);
      const text = await response.text();
      cancelInteraction.value = this;
      this.model.applySource(text);
      this.currentDocument = { name, icon, url };
      this.mainEditorView.value = this.mainEditorView.value === "svg" ? "svg" : "slate";
    } catch (error) {
      console.error(error);
      alert("Failed to load diagram.");
    }
  }

  openDiagram({ currentTarget }: MouseEvent) {
    const button = currentTarget as HTMLButtonElement;
    const { url, name } = button.dataset;
    this.diagramMenu.toggle(false);
    return this.loadDiagram(url!, name!, button.querySelector(".btn-glyph")!.textContent!);
  }

  reloadDiagram() {
    const { url, name, icon } = this.currentDocument;
    if (url !== null) return this.loadDiagram(url, name, icon);
  }

  toggleSvg() {
    this.mainEditorView.value = this.mainEditorView.value === "svg" ? "slate" : "svg";
  }
  toggleSource() {
    this.mainEditorView.value = this.mainEditorView.value === "source" ? "slate" : "source";
  }

  async copyAll() {
    try {
      await navigator.clipboard.writeText(this.model.document.source);
      showTemporaryLabel(this.refs.copyAllBtn, "Copied!", "success");
    } catch (error) {
      console.error("Clipboard copy failed:", error);
    }
  }

  async pasteAll() {
    try {
      const text = await navigator.clipboard.readText();
      cancelInteraction.value = this;
      this.model.applySource(text);
      this.currentDocument = { name: "Untitled", icon: "📄", url: null };
      this.mainEditorView.value = "slate";
      showTemporaryLabel(this.refs.pasteAllBtn, "Pasted!", "success");
    } catch (error) {
      console.error("Clipboard paste failed:", error);
    }
  }
}
