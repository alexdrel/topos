import { assertEquals, assertAlmostEquals } from "@std/assert";

import { buildSvgTree } from "../svg.ts";
import { CHAR_HEIGHT, CHAR_WIDTH } from "../geometry.ts";
import { XmlEl } from "../../jsonml/jsonml.ts";
import { matchChildEl } from "../../jsonml/assert.ts";
import { parseTopos } from "../../topos.ts";

const attrNum = (el: XmlEl, key: string) => +(el[1][key] ?? NaN);

/**
 * Grid Geometry Verification
 * 
 * Standard Box (x,y,w,h):
 *   x_px = x * CW
 *   w_px = w * CW
 * 
 * Grid Cell Box (x,y,w,h):
 *   Uses Proportional Scaling relative to parent.w and parent.h.
 */
Deno.test("svg: grid cell geometry (divided evenly)", () => {
  const diagram = `\
┌───┬───┐
│ A │ B │
├───┼───┤
│ C │ D │
└───┴───┘`;
  // 012345678 (indices)

  // Outer Container: x:0, y:0, w:9, h:5
  // Box A: x:0, y:0, w:5, h:3
  // Box B: x:4, y:0, w:5, h:3
  // Box C: x:0, y:2, w:5, h:3
  // Box D: x:4, y:2, w:5, h:3

  const ast = parseTopos(diagram);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });

  // 1. Verify Parent (Standard Box logic)
  const parent = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" }, 0);
  const parentShape = matchChildEl(parent, "rect", { class: "tpc-shape" });

  const expectedParentW = 9 * CHAR_WIDTH;
  const expectedParentH = 5 * CHAR_HEIGHT;
  assertEquals(attrNum(parentShape, "width"), expectedParentW, "Parent should have standard width");
  assertEquals(attrNum(parentShape, "height"), expectedParentH, "Parent should have standard height");

  // 2. Verify Child A (Grid Cell logic: snapped to parent left, 0.5 offset on right)
  // x: 0, y: 0, w: 5, h: 3 -> snapped to parent(0,0,9,5)
  const boxA = matchChildEl(parent, "g", { class: "tp-node tp-box tp-grid-cell" }, 0);
  const shapeA = matchChildEl(boxA, "rect", { class: "tpc-shape" });

  const expectedAxStart = 0;
  const expectedAxEnd = 4.5;
  const expectedAyStart = 0;
  const expectedAyEnd = 2.5;

  assertAlmostEquals(attrNum(shapeA, "x"), attrNum(parentShape, "x") + expectedAxStart * CHAR_WIDTH, 0.001);
  assertAlmostEquals(attrNum(shapeA, "y"), attrNum(parentShape, "y") + expectedAyStart * CHAR_HEIGHT, 0.001);
  assertAlmostEquals(attrNum(shapeA, "width"), (expectedAxEnd - expectedAxStart) * CHAR_WIDTH, 0.001);
  assertAlmostEquals(attrNum(shapeA, "height"), (expectedAyEnd - expectedAyStart) * CHAR_HEIGHT, 0.001);

  // 3. Verify Child B (Grid Cell logic: meetings perfectly with A, snapped to parent right)
  // x: 4, y: 0, w: 5, h: 3 -> snapped on right
  const boxB = matchChildEl(parent, "g", { class: "tp-node tp-box tp-grid-cell" }, 1);
  const shapeB = matchChildEl(boxB, "rect", { class: "tpc-shape" });

  const expectedBxStart = 4.5;
  const expectedBxEnd = 9.0;

  assertAlmostEquals(attrNum(shapeB, "x"), attrNum(parentShape, "x") + expectedBxStart * CHAR_WIDTH, 0.001);
  assertAlmostEquals(attrNum(shapeB, "x") + attrNum(shapeB, "width"), attrNum(parentShape, "x") + expectedBxEnd * CHAR_WIDTH, 0.001);
  assertAlmostEquals(attrNum(shapeA, "x") + attrNum(shapeA, "width"), attrNum(shapeB, "x"), 0.001);
});

Deno.test("svg: grid cell geometry (proportional 1x3)", () => {
  const diagram = `\
┌───┬───┬───┐
│ A │ B │ C │
└───┴───┴───┘`;
  // Parent x:0, w:13
  // A: x:0, w:5; B: x:4, w:5; C: x:8, w:5

  const ast = parseTopos(diagram);
  const svgTree = buildSvgTree(ast);
  const diagGrp = matchChildEl(svgTree, "g", { class: "tp-root" });
  const parent = matchChildEl(diagGrp, "g", { class: "tp-node tp-box" }, 0);
  const wP = attrNum(matchChildEl(parent, "rect"), "width");
  assertAlmostEquals(wP, 13 * CHAR_WIDTH, 0.001);

  const cellA = matchChildEl(parent, "g", { class: "tp-grid-cell" }, 0);
  const cellB = matchChildEl(parent, "g", { class: "tp-grid-cell" }, 1);
  const cellC = matchChildEl(parent, "g", { class: "tp-grid-cell" }, 2);

  const expectedWidth = (1 / 3) * wP;

  assertAlmostEquals(attrNum(matchChildEl(cellA, "rect"), "width"), expectedWidth, 0.001);
  assertAlmostEquals(attrNum(matchChildEl(cellB, "rect"), "width"), expectedWidth, 0.001);
  assertAlmostEquals(attrNum(matchChildEl(cellC, "rect"), "width"), expectedWidth, 0.001);
});
