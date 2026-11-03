import assert from "node:assert/strict";
import { test } from "node:test";
import { Zoom, zoomScroll } from "./zoom.ts";

test("stepping snaps through familiar percentages in either direction", () => {
  const zoom = new Zoom();
  const up: number[] = [];
  for (let i = 0; i < 4; i++) {
    zoom.step(1);
    up.push(zoom.percent);
  }
  assert.deepEqual(up, [125, 150, 188, 200]);
  zoom.set(1);
  const down: number[] = [];
  for (let i = 0; i < 3; i++) {
    zoom.step(-1);
    down.push(zoom.percent);
  }
  assert.deepEqual(down, [80, 64, 50]);
});

test("limits and invalid scales preserve a usable zoom", () => {
  const zoom = new Zoom();
  zoom.set(Infinity);
  assert.equal(zoom.value, 1);
  zoom.set(0);
  assert.equal(zoom.value, 0.1);
  assert.equal(zoom.canZoomOut, false);
  assert.equal(zoom.step(-1), false);
  zoom.set(100);
  assert.equal(zoom.value, 4);
  assert.equal(zoom.canZoomIn, false);
  assert.equal(zoom.step(1), false);
  zoom.set(NaN);
  assert.equal(zoom.value, 4);
});

test("fit follows layout changes until a manual zoom, including fit at exactly 100%", () => {
  const zoom = new Zoom(1, "width");
  zoom.refresh(0.75);
  assert.equal(zoom.value, 0.75);
  zoom.toggleFit(0.75, "width");
  assert.equal(zoom.value, 1);
  assert.equal(zoom.fitMode, null);
  zoom.refresh(0.5);
  assert.equal(zoom.value, 1);
  zoom.toggleFit(0.5, "width");
  assert.equal(zoom.value, 0.5);
  assert.equal(zoom.fitMode, "width");
  zoom.refresh(1);
  zoom.toggleFit(1, "width");
  assert.equal(zoom.value, 1);
  assert.equal(zoom.fitMode, null);
  zoom.toggleFit(0.6, "height");
  assert.equal(zoom.fitMode, "height");
  zoom.step(1);
  assert.equal(zoom.fitMode, null);
  zoom.set(1, "all");
  zoom.wheel(100);
  assert.equal(zoom.fitMode, null);
  assert.ok(Math.abs(zoom.value - Math.exp(-0.2)) < 1e-12);
});

test("cursor anchoring preserves the content point through zoom and its inverse", () => {
  const scroll = { x: 180, y: 90 };
  const origin = { x: 70, y: 30 };
  const next = zoomScroll(scroll, origin, 1.5);
  assert.deepEqual(next, { x: 305, y: 150 });
  assert.equal((next.x + origin.x) / 1.5, scroll.x + origin.x);
  assert.equal((next.y + origin.y) / 1.5, scroll.y + origin.y);
  assert.deepEqual(zoomScroll(next, origin, 1 / 1.5), scroll);
});
