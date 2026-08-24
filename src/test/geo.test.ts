import { assertEquals } from "@std/assert";
import { borderProximity, Dir, getDirection, isPointOnPolyline, resizeOffsets, resizeRect, simplifyPath } from "../geo.ts";

Deno.test("geo: signed distance to a rectangle border", () => {
  const rect = { x: 0, y: 0, w: 5, h: 3 };

  assertEquals(borderProximity(rect, { x: 0, y: 1 }), 0);
  assertEquals(borderProximity(rect, { x: 2, y: 1 }), -1);
  assertEquals(borderProximity(rect, { x: -0.5, y: 1 }), 0.5);
  assertEquals(borderProximity(rect, { x: -0.3, y: -0.4 }), 0.5);
});

Deno.test("geo: derives resize offsets between rectangles", () => {
  assertEquals(
    resizeOffsets({ x: 10, y: 20, w: 5, h: 4 }, { x: 8, y: 21, w: 9, h: 6 }),
    { top: 1, left: -2, bottom: 3, right: 2 },
  );
});

Deno.test("geo: applies resize offsets to a rectangle", () => {
  assertEquals(
    resizeRect({ x: 10, y: 20, w: 5, h: 4 }, { top: 1, left: -2, bottom: 3, right: 2 }),
    { x: 8, y: 21, w: 9, h: 6 },
  );
});

Deno.test("geo: corner cases", () => {
  assertEquals(isPointOnPolyline([{ x: 1, y: 1 }], { x: 1, y: 1 }), true);
  assertEquals(isPointOnPolyline([{ x: 1, y: 1 }], { x: 2, y: 1 }), false);
  assertEquals(isPointOnPolyline([], { x: 1, y: 1 }), false);

  assertEquals(simplifyPath([]), []);
  assertEquals(simplifyPath([{ x: 1, y: 1 }]), [{ x: 1, y: 1 }]);

  assertEquals(getDirection({ x: 1, y: 1 }, { x: 1, y: 1 }), Dir.None);
});
