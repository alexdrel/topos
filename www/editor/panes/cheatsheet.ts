import cheatsheetHtml from "./cheatsheet.html?raw";
import { isMac } from "../../../src-editor/slate/dom.ts";

export function initCheatsheet() {
  const overlay = document.createElement("div");
  overlay.id = "cheatsheet-overlay";
  overlay.className = "cheatsheet-overlay hidden";
  const mac = isMac();
  overlay.innerHTML = cheatsheetHtml
    .replaceAll("{{mod}}", mac ? "⌘" : "Ctrl")
    .replaceAll("{{alt}}", mac ? "⌥" : "Alt")
    .replaceAll("{{shift}}", mac ? "⇧" : "Shift");
  document.body.appendChild(overlay);

  const btnClose = overlay.querySelector("#btn-close-cheatsheet")!;

  function toggle() {
    overlay.classList.toggle("hidden");
  }

  function hide() {
    overlay.classList.add("hidden");
  }

  btnClose.addEventListener("click", hide);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      hide();
    }
  });

  return {
    toggle,
    hide,
  };
}
