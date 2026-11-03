/// <reference lib="dom" />
import { Context } from "@alexdrel/perky";
import { PersistedSignal } from "./signals/persisted-signal.ts";
import { cancelInteraction, MainEditorView, mainEditorViews } from "./app-context.ts";
import defaultSource from "./default.topos?raw";
import { EditorModel } from "../../src-editor/model/model.ts";
import { ToposDocument } from "../../src-editor/model/document.ts";
import { Toolbar } from "./panes/toolbar.ts";
import { SlatePane } from "./panes/slate.ts";
import { LegendPane } from "./panes/legend.ts";
import { EnamelPane, MainEnamelViewer } from "./panes/enamel.ts";
import { InspectorPane } from "./panes/inspector.ts";
import { Layout } from "./layout.ts";
import { Source } from "./panes/source.ts";
import { GlyphPane } from "./panes/glyphs.ts";
import { Cheatsheet } from "./panes/cheatsheet.ts";
import { EditorHistory } from "../../src-editor/model/history.ts";
import { renderToMono } from "../../src/ink/mono/mono.ts";

const DOCUMENT_STORAGE_KEY = "topos-editor-document";

class App {
  mainEditorView = new PersistedSignal("topos-editor-view", mainEditorViews);
  context = new Context(MainEditorView(this.mainEditorView));
  lastEditorView: MainEditorView = "slate";

  toposDocument = new ToposDocument(localStorage.getItem(DOCUMENT_STORAGE_KEY) ?? defaultSource);
  model = new EditorModel(this.toposDocument);
  history = new EditorHistory(this.model);

  inspectorPane = new InspectorPane(this.model);
  enamelPane = new EnamelPane(this.context);
  mainEnamelPane = new MainEnamelViewer(this.context);
  legendPane = new LegendPane(this.model);
  cheatsheet = Cheatsheet(document.body);
  slatePane = new SlatePane(this.model, this.history);
  sourcePane = new Source(
    (source) => this.history.updateSource(source),
    () => this.commitSource(),
  );
  glyphPane = new GlyphPane(this.sourcePane.insertAtCursor);
  toolbar = new Toolbar(this.model, this.mainEditorView);

  layout = new Layout(
    document.querySelector(".workspace")!,
    document.querySelector(".side-panel")!,
    [this.slatePane, this.sourcePane, this.mainEnamelPane],
    [this.inspectorPane, this.legendPane, this.enamelPane, this.glyphPane],
  );

  constructor() {
    this.slatePane.toggleCheatsheet = this.cheatsheet.toggle;
    this.toolbar.renderMonosketch = (name) => renderToMono(this.model.traceMap, name);
    this.mainEditorView.apply = this.applyMainView;
    this.model.subscribe((_model, event) => this.onModelChange(event?.commit));
    globalThis.addEventListener("keydown", this.onKeyDown);
    this.applyMainView(this.mainEditorView.value, undefined);
  }

  applyMainView = (view: MainEditorView, previous: MainEditorView | undefined) => {
    if (previous !== undefined && view !== previous) cancelInteraction.value = this;
    if (view === "svg" && previous !== undefined && previous !== "svg") this.lastEditorView = previous;
    if (view === "source") this.sourcePane.open(this.toposDocument.source);
    const svg = view === "svg";
    const source = view === "source";
    this.slatePane.toggle(view === "slate");
    this.sourcePane.toggle(source);
    this.mainEnamelPane.toggle(svg);
    this.inspectorPane.toggle(view === "slate");
    this.enamelPane.toggle(view === "slate");
    this.legendPane.toggle(!source);
    this.glyphPane.toggle(source);
    if (view !== "slate") this.enamelPane.source = null;
    if (!svg) this.mainEnamelPane.source = null;
    this.layout.resize();
    this.renderPreview(view);
    if (view === "slate") this.slatePane.focus();
  };

  renderPreview(view: MainEditorView) {
    if (view === "slate") this.enamelPane.source = this.toposDocument.source;
    else if (view === "svg") this.mainEnamelPane.source = this.toposDocument.source;
  }

  onModelChange(commit = false) {
    this.inspectorPane.render();
    this.renderPreview(this.mainEditorView.value);
    if (commit) this.storeDocument();
  }

  commitSource() {
    this.history.commitSource();
    this.storeDocument();
  }

  storeDocument() {
    localStorage.setItem(DOCUMENT_STORAGE_KEY, this.toposDocument.source);
  }

  onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      cancelInteraction.value = event.key;
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (!mod || !event.shiftKey) return;
    if (key === "v") {
      event.preventDefault();
      this.mainEditorView.value = this.mainEditorView.value === "svg" ? this.lastEditorView : "svg";
      return;
    }
    if (key === "d") {
      event.preventDefault();
      this.mainEditorView.value = this.mainEditorView.value === "slate" ? "source" : "slate";
    }
  };
}

new App();
