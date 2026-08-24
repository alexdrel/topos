import type { Loc } from "../../src/geo.ts";
import type { XmlEl } from "../../src/jsonml/jsonml.ts";
import { htmlEl, isMac, mount } from "./dom.ts";
import { type PopupPosition, positionPopup } from "./popup.ts";
import type { Slate } from "./slate.ts";

export type CreateKind = "text" | "box" | "line" | "hub" | "glyph";

export interface CreateOption {
  kind: CreateKind;
  icon: string;
  label: string;
  gesture: string;
}

export function getCreateOptions(): readonly CreateOption[] {
  const mac = isMac();
  return [
    { kind: "text", icon: "A", label: "Text", gesture: "double-click" },
    { kind: "box", icon: "□", label: "Box", gesture: mac ? "⌘ drag" : "Ctrl drag" },
    { kind: "line", icon: "→", label: "Line", gesture: mac ? "⌥ drag" : "Alt drag" },
    { kind: "hub", icon: "◆", label: "Hub", gesture: mac ? "⌥ click" : "Alt click" },
    { kind: "glyph", icon: "¶", label: "Glyph", gesture: mac ? "⇧ Space" : "Shift Space" },
  ];
}

export function buildCreateMenuNode(options = getCreateOptions()): XmlEl {
  return htmlEl(
    "div",
    { class: "quick-inspector slate-create-menu" },
    htmlEl("div", { class: "slate-create-title" }, "Create"),
    ...options.map((option) =>
      htmlEl(
        "button",
        {
          type: "button",
          class: "slate-create-option",
          title: `${option.label}: ${option.gesture}`,
          "data-kind": option.kind,
        },
        htmlEl("span", { class: "slate-create-icon" }, option.icon),
        htmlEl("span", { class: "slate-create-label" }, option.label),
        htmlEl("span", { class: "slate-create-gesture" }, option.gesture),
      )
    ),
  );
}

export class CreateMenu {
  private readonly element: HTMLElement;
  public readonly position: PopupPosition;

  constructor(editor: Slate, pos: Loc, onPick: (kind: CreateKind) => void, placement: "center" | "above" | "top-left" = "center") {
    this.element = mount(buildCreateMenuNode()) as HTMLElement;
    this.element.addEventListener("mousedown", (event) => event.stopPropagation());
    this.element.addEventListener("click", (event) => {
      event.stopPropagation();
      const kind = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-kind]")?.dataset.kind as CreateKind | undefined;
      if (kind) onPick(kind);
    });
    editor.surface.appendViewportElement(this.element);
    this.position = positionPopup(editor, this.element, pos, { placement });
  }

  public dispose(): void {
    this.element.remove();
  }
}
