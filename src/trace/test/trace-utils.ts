import { assert, assertEquals, assertObjectMatch } from "@std/assert";
import { DeepPartial } from "../../test/test-utils.ts";
import type { TraceBox, TraceMap } from "../types.ts";
import { projectTracesToGrid } from "../../ink/ink.ts";
import { Direction } from "../../geo.ts";

export function assertArrayMatch<T>(actual: T[], expected: DeepPartial<T>[]) {
  assertObjectMatch(
    actual as unknown as Record<PropertyKey, unknown>,
    expected as unknown as Record<PropertyKey, unknown>,
  );
}

export type TraceKey =
  | { type: "box"; x: number; y: number }
  | { type: "grid-cell"; x: number; y: number }
  | { type: "text"; x: number; y: number }
  | { type: "label"; x: number; y: number }
  | { type: "line"; x: number; y: number; startDir: Direction }
  | { type: "inline"; x: number; y: number }
  | { type: "hub"; x: number; y: number };

export function findTrace(traceMap: TraceMap, key: TraceKey): TraceBox {
  const found = traceMap.traces.find((trace) =>
    trace.x === key.x &&
    trace.y === key.y &&
    trace.type === key.type &&
    (key.type !== "line" || trace.source?.dir === key.startDir)
  );
  assert(found, `trace not found: ${JSON.stringify(key)}`);
  return found;
}

export function matchTraceMap(traceMap: TraceMap, expected: string): void {
  assertEquals(projectTracesToGrid(traceMap).text.trimEnd(), expected.trimEnd());
}
