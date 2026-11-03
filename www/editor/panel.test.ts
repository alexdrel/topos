import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileHtml } from "@alexdrel/pralinejs/compiler";
import type { Blueprint } from "@alexdrel/pralinejs";

// Node's test runner needs loaders for virtual HTML modules and CSS imports.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith(".html.js")) return next(specifier.slice(0, -3), context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
    if (url.endsWith(".html")) return { format: "module", source: compileHtml(readFileSync(fileURLToPath(url), "utf8"), "js"), shortCircuit: true };
    return next(url, context);
  },
});
const { Panel } = await import("./panel.ts");
const { default: legend } = await import("./panes/legend.html.js");
const { default: glyphs } = await import("./panes/glyphs.html.js");
const { default: inspector } = await import("./panes/inspector.html.js");
const { default: source } = await import("./panes/source.html.js");
const { default: slate } = await import("./panes/slate.html.js");
hooks.deregister();

test("panels filter before binding, preserve templates, and coordinate separate mounts", () => {
  const window = new Window();
  const document = window.document as unknown as Document;
  const globals = {
    document,
    Event: window.Event,
    dispatchEvent: window.dispatchEvent.bind(window),
  };
  const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  try {
    const template = [
      [
        "header",
        { id: "panel-toolbar", ref: "{{panelToolbar}}" },
        ["div", { class: "pane-head-toggle", "data-panel-mode": "side" }, ["span", { id: "expand-btn", ref: "{{expandBtn}}" }, "Expand"]],
        ["button", { id: "export-btn", ref: "{{exportBtn}}", "data-panel-mode": "main", onClick: "{{exportSvg}}" }, "Export"],
      ],
      ["div", { id: "panel-body", ref: "{{panelBody}}" }, ["span", {}, "Content"]],
    ] as unknown as Blueprint<{ exportSvg?: () => void }, Refs>;
    const original = JSON.stringify(template);
    type Refs = { panelToolbar: HTMLElement; panelBody: HTMLDivElement; expandBtn: HTMLSpanElement; exportBtn: HTMLButtonElement };
    const sideMount = document.createElement("section");
    const side = new Panel(sideMount, sideMount, "side");
    // No exportSvg supplied: the excluded main-only handler must never be bound.
    const sideRefs = side.materialize(template);
    assert.equal(sideMount.children.length, 2);
    assert.equal(sideRefs.panelBody.parentElement, sideMount);
    assert.equal(sideRefs.expandBtn.closest("#panel-toolbar"), side.toolbar);
    assert.equal(sideRefs.exportBtn, undefined);
    assert.equal(sideRefs.expandBtn.parentElement!.dataset.panelMode, "side");
    sideRefs.expandBtn.click();
    assert.equal(side.expanded, false);
    assert.equal(sideRefs.panelBody.hidden, true);
    side.toolbar.querySelector<HTMLElement>(".pane-chevron")!.click();
    assert.equal(side.expanded, true);
    const control = document.createElement("button");
    side.toolbar.append(control);
    control.click();
    assert.equal(side.expanded, true);
    side.collapsible = false;
    sideRefs.expandBtn.click();
    assert.equal(side.expanded, true);
    side.collapsible = true;
    side.toggle(false);
    assert.equal(sideMount.hidden, true);
    side.expanded = true;
    assert.equal(sideRefs.panelBody.hidden, true);
    side.toggle(true);
    assert.equal(sideMount.hidden, false);
    assert.equal(sideRefs.panelBody.hidden, false);

    const toolbarMount = document.createElement("header");
    const bodyMount = document.createElement("main");
    const existing = document.createElement("div");
    bodyMount.append(existing);
    class MainPanel extends Panel {
      exports = 0;
      exportSvg() {
        this.exports++;
      }
    }
    const main = new MainPanel(toolbarMount, bodyMount, "main");
    const mainRefs = main.materialize(template);
    assert.equal(main.toolbar.classList.contains("panel-fixed"), true);
    assert.equal(main.toolbar.querySelector(".pane-chevron"), null);
    assert.equal(mainRefs.expandBtn, undefined);
    mainRefs.exportBtn.click();
    assert.equal(main.exports, 1);
    assert.equal(main.toolbar.parentElement, toolbarMount);
    assert.equal(mainRefs.exportBtn.parentElement, main.toolbar);
    assert.equal(mainRefs.panelBody.parentElement, bodyMount);
    assert.equal(existing.parentElement, bodyMount);
    main.expanded = false;
    assert.equal(main.expanded, true);
    main.toggle(false);
    assert.equal(main.toolbar.hidden, true);
    assert.equal(mainRefs.panelBody.hidden, true);
    assert.equal(JSON.stringify(template), original);

    for (const blueprint of [legend, glyphs, inspector, source, slate]) {
      const mount = document.createElement("section");
      const panel = new Panel(mount, mount, blueprint === source || blueprint === slate ? "main" : "side");
      const refs = panel.materialize(blueprint, { toggleHelp() {}, toggleReplay() {}, toggleOverwrite() {} });
      assert.equal(mount.children.length, 2);
      assert.equal(panel.toolbar, refs.panelToolbar);
      assert.equal(panel.content, refs.panelBody);
      // The imported Slate stylesheet defines its selection/theme variables on this host class.
      if (blueprint === slate) assert.equal(panel.content.classList.contains("slate-surface"), true);
      panel.toggle(false);
      assert.equal(mount.hidden, true);
      panel.toggle(true);
      assert.equal(mount.hidden, false);
    }
  } finally {
    for (const key of Object.keys(globals)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
