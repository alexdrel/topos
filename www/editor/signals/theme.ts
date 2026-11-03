import { Context } from "@alexdrel/perky";
import { PersistedSignal } from "./persisted-signal.ts";

export const themeOption = [
  { value: "erebus", label: "Erebus", previewStyle: "background: #111; border-color: #222;" },
  { value: "solarized-dark", label: "Solarized Dark", previewStyle: "background: #002b36; border-color: #073642;" },
  { value: "solarized-light", label: "Solarized Light", previewStyle: "background: #fdf6e3; border-color: #eee8d5;" },
  { value: "classic", label: "Classic", previewStyle: "background: #ffffff; border-color: #cccccc;" },
  { value: "monokai", label: "Monokai", previewStyle: "background: #272822; border-color: #3e3d32;" },
] as const;

export type ThemeName = (typeof themeOption)[number]["value"];
export const themeSignal = new PersistedSignal<ThemeName>(
  "topos-editor-theme",
  themeOption.map((o) => o.value),
  (value) => {
    document.body.dataset.theme = value;
  },
);
export const Theme = Context.key(themeSignal);
