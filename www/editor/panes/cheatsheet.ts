import template from "./cheatsheet.html.js";
import "../css/cheatsheet.css";
import { isMac } from "../../../src-editor/slate/dom.ts";
import { materialize } from "@alexdrel/pralinejs";
import { observe } from "@alexdrel/perky";
import { cancelInteraction } from "../app-context.ts";

export function Cheatsheet(mount: HTMLElement) {
  const params = {
    ...(isMac() ? { mod: "⌘", alt: "⌥", shift: "⇧" } : { mod: "Ctrl", alt: "Alt", shift: "Shift" }),
    dismiss,
  };
  const { fragment, refs } = materialize(template, params);
  mount.appendChild(fragment);
  const cheatsheet = { visible: false, toggle };
  observe(cheatsheet, "visible", (visible) => {
    if (visible) cancelInteraction.value = cheatsheet;
    refs.cheatsheetOverlay.hidden = !visible;
  });
  cancelInteraction.subscribe((initiator) => {
    if (initiator !== cheatsheet) cheatsheet.visible = false;
  });

  function toggle(visible = !cheatsheet.visible) {
    if (visible !== cheatsheet.visible) cheatsheet.visible = visible;
  }

  function dismiss(event: MouseEvent) {
    if (event.target === event.currentTarget) cheatsheet.visible = false;
  }

  return cheatsheet;
}
