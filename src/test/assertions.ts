import { ok, throws } from "node:assert/strict";

export function assertExists<T>(actual: T, message?: string): asserts actual is NonNullable<T> {
  ok(actual !== undefined && actual !== null, message ?? "Expected a non-null value");
}

export function assertAlmostEquals(actual: number, expected: number, tolerance = 1e-7, message?: string): void {
  ok(Object.is(actual, expected) || Math.abs(actual - expected) <= tolerance, message ?? `Expected ${actual} to be within ${tolerance} of ${expected}`);
}

export function assertStringIncludes(actual: string, expected: string, message?: string): void {
  ok(actual.includes(expected), message ?? `Expected string to include ${JSON.stringify(expected)}`);
}

export function assertLess(actual: number, expected: number, message?: string): void {
  ok(actual < expected, message ?? `Expected ${actual} to be less than ${expected}`);
}

export function assertThrows(fn: () => unknown, errorClass?: typeof Error, messageIncludes?: string): void {
  throws(fn, (error: unknown) => {
    if (errorClass) ok(error instanceof errorClass, `Expected ${errorClass.name}`);
    if (messageIncludes !== undefined) {
      ok(error instanceof Error);
      assertStringIncludes(error.message, messageIncludes);
    }
    return true;
  });
}
