import { assertEquals } from "@std/assert";
import { parseUnitRatio } from "../value.ts";

Deno.test("legend value: parse unit ratio from common legend forms", () => {
  assertEquals(parseUnitRatio("0.45"), { type: "absolute", value: 0.45 });
  assertEquals(parseUnitRatio(".45"), { type: "absolute", value: 0.45 });
  assertEquals(parseUnitRatio("45"), { type: "absolute", value: 45 });
  assertEquals(parseUnitRatio("45%"), { type: "ratio", value: 0.45 });
  assertEquals(parseUnitRatio("100"), { type: "absolute", value: 100 });
  assertEquals(parseUnitRatio("100%"), { type: "ratio", value: 1 });
  assertEquals(parseUnitRatio("wat"), undefined);
  assertEquals(parseUnitRatio(""), undefined);
  assertEquals(parseUnitRatio("   "), undefined);
});
