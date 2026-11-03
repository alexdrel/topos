import assert from "node:assert/strict";
import { test } from "node:test";
import { PersistedSignal } from "./persisted-signal.ts";

test("independent signals restore and save string and JSON formats", () => {
  const values = new Map([
    ["font", "Iosevka"],
    ["layout", '{"width":320}'],
  ]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    const font = new PersistedSignal("font", (value) => (typeof value === "string" ? value : "JuliaMono"));
    const layout = new PersistedSignal("layout", (value) => value as { width: number });
    assert.equal(font.value, "Iosevka");
    assert.deepEqual(layout.value, { width: 320 });
    assert.equal(values.get("font"), "Iosevka");
    font.value = "monospace";
    layout.value = { width: 400 };
    assert.equal(values.get("font"), '"monospace"');
    assert.equal(new PersistedSignal("font", String).value, "monospace");
    assert.equal(values.get("layout"), '{"width":400}');
    const view = new PersistedSignal("view", (value) => (typeof value === "string" ? value : "slate"));
    assert.equal(view.value, "slate");
    assert.equal(values.has("view"), false);
    view.value = "svg";
    assert.equal(values.get("view"), '"svg"');
    view.value = "source";
    assert.equal(values.get("view"), '"source"');
    assert.equal(new PersistedSignal("invalid", () => undefined).value, undefined);
    assert.equal(new PersistedSignal("font", () => false).value, false);

    const choices = ["slate", "source", "svg"] as const;
    assert.equal(new PersistedSignal("missing-view", choices).value, "slate");
    assert.equal(values.has("missing-view"), false);
    assert.equal(new PersistedSignal("view", choices).value, "source");
    values.set("view", '"unknown"');
    assert.equal(new PersistedSignal("view", choices).value, "slate");
    assert.equal(values.get("view"), '"unknown"');
    assert.equal(new PersistedSignal("boolean", [false, true]).value, false);
    assert.throws(() => new PersistedSignal("empty", []), /at least one/);
    const applied: (typeof choices)[number][] = [];
    const selected = new PersistedSignal("view", choices, (value) => applied.push(value));
    selected.subscribe((value) => assert.equal(applied.at(-1), value));
    selected.value = "svg";
    assert.deepEqual(applied, ["slate", "svg"]);
    assert.equal(values.get("view"), '"svg"');

    values.set("font", '"monospace"');
    class OwnedSignal extends PersistedSignal<string> {
      applied = "monospace";
      get value(): string {
        return super.value;
      }
      set value(value: string) {
        if (value === "invalid") throw new Error("rejected");
        this.applied = value;
        super.value = value;
      }
    }
    const owned = new OwnedSignal("font", String);
    owned.subscribe((value) => {
      assert.equal(owned.applied, value);
      assert.equal(values.get("font"), JSON.stringify(value));
    });
    owned.value = "JuliaMono";
    assert.equal(values.get("font"), '"JuliaMono"');
    assert.throws(() => {
      owned.value = "invalid";
    }, /rejected/);
    assert.equal(owned.value, "JuliaMono");
    assert.equal(values.get("font"), '"JuliaMono"');
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("storage failures leave signals usable", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("unavailable");
    },
  });
  try {
    const signal = new PersistedSignal("font", (value) => (typeof value === "string" ? value : "JuliaMono"));
    assert.equal(signal.value, "JuliaMono");
    signal.value = "monospace";
    assert.equal(signal.value, "monospace");
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
