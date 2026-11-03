import { PersistedSignal } from "./persisted-signal.ts";

export const fontOption = [
  { value: "JuliaMono", label: "JuliaMono", fontFamily: "'JuliaMono', monospace" },
  { value: "monospace", label: "System Mono", fontFamily: "monospace" },
  { value: "Roboto Mono", label: "Roboto Mono", fontFamily: "'Roboto Mono', monospace" },
  { value: "Fira Mono", label: "Fira Mono", fontFamily: "'Fira Mono', monospace" },
] as const;

export type FontName = (typeof fontOption)[number]["value"];
export const fontSignal = new PersistedSignal<FontName>(
  "topos-editor-font",
  fontOption.map((o) => o.value),
  (value) => {
    document.body.style.setProperty("--editor-font", `'${value}', monospace`);
    globalThis.dispatchEvent(new Event("resize"));
  },
);
