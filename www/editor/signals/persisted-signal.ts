import { Signal } from "@alexdrel/perky";

export class PersistedSignal<const T> extends Signal<T> {
  key: string;
  apply?: (value: T, previous: T | undefined) => void;

  constructor(key: string, parse: readonly T[] | ((value: unknown) => T), apply?: (value: T, previous?: T) => void) {
    if (typeof parse !== "function" && parse.length === 0) throw new Error("PersistedSignal requires at least one allowed value");
    let value: unknown;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          value = JSON.parse(raw);
        } catch {
          value = raw; // Existing string settings were stored without JSON encoding.
        }
      }
    } catch {
      // The parser also handles unavailable or missing storage.
    }
    const initial = typeof parse === "function" ? parse(value) : parse.includes(value as T) ? (value as T) : parse[0]!;
    super(initial);
    this.key = key;
    this.apply = apply;
    apply?.(initial);
  }

  get value(): T {
    return super.value;
  }

  set value(value: T) {
    this.apply?.(value, super.value);
    try {
      localStorage.setItem(this.key, JSON.stringify(value));
    } catch {
      // The signal remains usable when browser storage is unavailable.
    }
    super.value = value;
  }
}
