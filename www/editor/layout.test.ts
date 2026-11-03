import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { Window } from "happy-dom";
import type { Blueprint } from "@alexdrel/pralinejs";

const hooks = registerHooks({
  load(url, context, next) {
    if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
    return next(url, context);
  },
});
const { Layout, panelHeights } = await import("./layout.ts");
const { Panel } = await import("./panel.ts");
hooks.deregister();

test("height allocation preserves proportions, minimums, and total space", () => {
  assert.deepEqual(panelHeights(1000, [0.4, 0.2, 0.4], [96, 96, 96]), [400, 200, 400]);
  assert.deepEqual(panelHeights(1000, [2, 1, 2], [96, 96, 96]), [400, 200, 400]);
  assert.deepEqual(panelHeights(400, [0.4, 0.2, 0.4], [96, 96, 96]), [152, 96, 152]);
  assert.ok(panelHeights(100, [0.4, 0.2, 0.4], [96, 96, 96]).every((height) => Math.abs(height - 96) < 1e-8));
  assert.deepEqual(panelHeights(500, [1], [96]), [500]);
  assert.deepEqual(panelHeights(500, [], []), []);
});

test("layout allocates panels, preserves hidden preferences, and resizes adjacent expanded panels", () => {
  const window = new Window();
  const document = window.document as unknown as Document;
  const observerCallbacks: (() => void)[] = [];
  let stacked = false;
  const globals = {
    document,
    localStorage: window.localStorage,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    getComputedStyle: window.getComputedStyle.bind(window),
    matchMedia: () => ({ matches: stacked }),
    addEventListener: window.addEventListener.bind(window),
    dispatchEvent: window.dispatchEvent.bind(window),
    ResizeObserver: class {
      constructor(callback: () => void) {
        observerCallbacks.push(callback);
      }
      observe() {}
    },
  };
  const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  try {
    const workspace = document.createElement("main");
    workspace.style.padding = "8px";
    const sidebar = document.createElement("aside");
    sidebar.style.padding = "8px";
    const vertical = document.createElement("div");
    vertical.id = "workspace-splitter";
    workspace.append(vertical, sidebar);
    document.body.append(workspace);
    Object.defineProperty(workspace, "clientWidth", { configurable: true, value: 1000 });
    Object.defineProperty(sidebar, "clientHeight", { configurable: true, value: 600 });
    const template = [
      ["header", { id: "panel-toolbar", ref: "{{panelToolbar}}" }],
      ["div", { id: "panel-body", ref: "{{panelBody}}" }],
    ] as unknown as Blueprint<object, { panelToolbar: HTMLElement; panelBody: HTMLDivElement }>;
    function makePanel(id: string) {
      const mount = document.createElement("section");
      mount.id = id;
      sidebar.append(mount);
      const panel = new Panel(mount, mount, "side");
      panel.materialize(template);
      panel.toolbar.getBoundingClientRect = () => ({ height: 30 }) as DOMRect;
      mount.getBoundingClientRect = () =>
        ({
          height: panel.expanded ? parseFloat(mount.style.flexBasis) || 200 : 32,
        }) as DOMRect;
      return panel;
    }
    const panels = [makePanel("a"), makePanel("b"), makePanel("c"), makePanel("glyphs")];
    panels[3].toggle(false);
    localStorage.setItem("topos-editor-layout-v1", '{"sideWidth":360,"shares":[2,1,2,1]}');
    const layout = new Layout(workspace, sidebar, [], panels);
    for (const splitter of layout.splitters) {
      splitter.getBoundingClientRect = () => ({ height: splitter.hidden ? 0 : 8 }) as DOMRect;
    }
    let notifications = 0;
    panels[0].onResize = () => notifications++;
    layout.resize();
    const height = (index: number) => panels[index].toolbarMount.getBoundingClientRect().height;
    assert.ok(Math.abs(height(0) - 227.2) < 1e-8);
    assert.ok(Math.abs(height(1) - 113.6) < 1e-8);
    assert.equal(workspace.style.getPropertyValue("--side-width"), "360px");
    assert.equal(observerCallbacks.length, 1);
    assert.equal(notifications, 1);
    const originalShares = [...layout.shares];
    panels[1].expanded = false; // Existing resize notification invokes layout.
    assert.equal(height(1), 32);
    assert.equal(height(0), 272);
    assert.equal(height(2), 272);
    assert.deepEqual(layout.shares, originalShares);
    assert.equal(layout.splitters[0].hidden, false);
    assert.equal(layout.splitters[1].hidden, true);
    const move = layout.startPanelDrag(0, new MouseEvent("mousedown", { clientY: 100 }))!;
    move(new MouseEvent("mousemove", { clientY: 150 }));
    assert.equal(height(0), 322);
    assert.equal(height(2), 222);
    assert.equal(layout.shares[1], originalShares[1]);
    assert.equal(layout.shares[3], originalShares[3]);
    const saved = localStorage.getItem("topos-editor-layout-v1");
    panels[0].toggle(false);
    layout.resize();
    assert.equal(height(2), 552);
    assert.ok(layout.splitters.every((splitter) => splitter.hidden));
    assert.equal(localStorage.getItem("topos-editor-layout-v1"), saved);
    panels[2].expanded = false;
    panels[1].toggle(false);
    layout.resize();
    assert.equal(panels[2].collapsible, false);
    assert.equal(panels[2].expanded, true);
    assert.equal(panels[2].content.hidden, false);
    assert.equal(height(2), 584);
    panels[2].toggleExpanded();
    assert.equal(panels[2].expanded, true);
    panels[1].toggle(true);
    layout.resize();
    assert.equal(panels[2].collapsible, true);
    assert.equal(panels[2].expanded, false);
    assert.equal(panels[2].content.hidden, true);
    panels[2].expanded = true;
    panels[0].toggle(true);
    panels[1].expanded = true;
    Object.defineProperty(sidebar, "clientHeight", { configurable: true, value: 416 });
    layout.resize();
    const unrelatedHeight = height(0);
    const pair = height(1) + height(2);
    const constrainedMove = layout.startPanelDrag(1, new MouseEvent("mousedown", { clientY: 0 }))!;
    constrainedMove(new MouseEvent("mousemove", { clientY: 20 }));
    assert.ok(Math.abs(height(0) - unrelatedHeight) < 1e-8);
    assert.ok(Math.abs(height(1) + height(2) - pair) < 1e-8);
    assert.ok(height(1) >= 96 && height(2) >= 96);
    const afterDrag = localStorage.getItem("topos-editor-layout-v1");
    observerCallbacks[0]();
    assert.equal(localStorage.getItem("topos-editor-layout-v1"), afterDrag);
    stacked = true;
    vertical.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    assert.equal(layout.drag, undefined);
    stacked = false;
    vertical.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    assert.equal(typeof layout.drag, "function");
    dispatchEvent(new MouseEvent("mouseup"));
    assert.equal(layout.drag, undefined);
  } finally {
    for (const key of Object.keys(globals)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
