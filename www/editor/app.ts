/// <reference lib="dom" />
import defaultSource from "./default.topos?raw";
import { EditorModel } from "../../src-editor/model/model.ts";
import { ToposDocument } from "../../src-editor/model/document.ts";
import { initToolbar, type MainView } from "./panes/toolbar.ts";
import { initSlatePane } from "./panes/slate.ts";
import { initLegendPane } from "./panes/legend.ts";
import { initEnamelPane } from "./panes/enamel.ts";
import { initInspectorPane } from "./panes/inspector.ts";
import { initLayoutPane } from "./layout.ts";
import { initSource } from "./panes/source.ts";
import { EditorHistory } from "../../src-editor/model/history.ts";
import { renderToMono } from "../../src/ink/mono/mono.ts";

const surfacePanel = document.querySelector(".surface-panel") as HTMLDivElement;
const DOCUMENT_STORAGE_KEY = "topos-editor-document";
const VIEW_STORAGE_KEY = "topos-editor-view";

const storedView = localStorage.getItem(VIEW_STORAGE_KEY);
let view: MainView = storedView === "svg" ? "svg" : "slate";
let viewerOrigin: Exclude<MainView, "svg"> = "slate";

const toposDocument = new ToposDocument(localStorage.getItem(DOCUMENT_STORAGE_KEY) ?? defaultSource);
const model = new EditorModel(toposDocument);
const history = new EditorHistory(model);
const inspectorPane = initInspectorPane(model);

const enamelPane = initEnamelPane({
  sectionId: "enamel-section",
  paneId: "enamel-pane",
});
const mainEnamelPane = initEnamelPane({
  paneId: "main-enamel-pane",
  toolbarMountId: "surface-toolbar-mount",
  paperStorageKey: "topos-editor-main-enamel-paper",
  keyboardShortcuts: true,
});

const legendPane = initLegendPane(model);

const slatePane = initSlatePane(model, history);
const sourcePane = initSource({
  change: (source) => history.updateSource(source),
  commit: () => {
    history.commitSource();
    storeDocument();
  },
});

const layoutPane = initLayoutPane({
  getInspectorExpanded: inspectorPane.isExpanded,
  getLegendExpanded: legendPane.isExpanded,
  getEnamelExpanded: enamelPane.isExpanded,
  onLayoutChange: () => {
    slatePane.refresh();
    enamelPane.refresh();
    mainEnamelPane.refresh();
  },
});

function renderPreviews() {
  const showSide = view === "slate" && enamelPane.isExpanded();
  if (showSide) enamelPane.setContent(toposDocument.source);
  else enamelPane.clear();
  if (view === "svg") mainEnamelPane.setContent(toposDocument.source);
  else mainEnamelPane.clear();
}

function syncView() {
  const svg = view === "svg";
  const source = view === "source";
  surfacePanel.classList.toggle("svg-focus", svg);
  document.body.classList.toggle("svg-focus", svg);
  document.body.classList.toggle("source-focus", source);
  slatePane.setVisible(view === "slate");
  if (svg) legendPane.setExpanded(true);
  layoutPane.updateSidePanelState();
  layoutPane.refreshLayoutAfterWindowResize();
  renderPreviews();
  toolbar.refresh();
}

function setView(next: MainView) {
  if (next === "svg" && view !== "svg") viewerOrigin = view;
  if (view === "source") sourcePane.close();
  view = next;
  localStorage.setItem(VIEW_STORAGE_KEY, view);
  if (view === "source") sourcePane.open(toposDocument.source);
  syncView();
  if (view === "slate") slatePane.focus();
}

function storeDocument() {
  localStorage.setItem(DOCUMENT_STORAGE_KEY, toposDocument.source);
}

function replaceDocument(source: string, nextView: MainView = "slate") {
  slatePane.cancel();
  source = source.split(/\r?\n/).map((line) => line.trimEnd()).join("\n").trimEnd();
  model.applySource(source);
  setView(nextView);
}

const toolbar = initToolbar({
  getView: () => view,
  setView,
  onNewCase: () => replaceDocument(""),
  onCaseLoaded: (source) => replaceDocument(source, view === "svg" ? "svg" : "slate"),
  onCopyAll: () => toposDocument.source,
  onPasteAll: replaceDocument,
  renderMonosketch: (name) => renderToMono(model.traceMap, name),
});

model.subscribe((_model, event) => {
  inspectorPane.render();
  renderPreviews();
  if (event?.commit) storeDocument();
});

globalThis.addEventListener("resize", slatePane.refresh);
globalThis.addEventListener("keydown", (event) => {
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (!mod || !event.shiftKey) return;
  if (key === "v") {
    event.preventDefault();
    setView(view === "svg" ? viewerOrigin : "svg");
    return;
  }
  if (key === "d") {
    event.preventDefault();
    setView(view === "slate" ? "source" : "slate");
  }
});

layoutPane.initialize();
syncView();
if (view === "slate") slatePane.focus();
