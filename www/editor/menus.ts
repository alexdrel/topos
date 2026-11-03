import { observe, type Signal } from "@alexdrel/perky";
import { cancelInteraction } from "./app-context.ts";

export class DropdownMenu {
  static openMenu: DropdownMenu | undefined;
  static outsideClick: ((event: MouseEvent) => void) | undefined;

  menuRoot: HTMLElement;
  content: HTMLElement;
  trigger: HTMLButtonElement;
  beforeOpen?: () => void;
  visible = false;

  constructor(menuRoot: HTMLElement, beforeOpen?: () => void) {
    this.menuRoot = menuRoot;
    this.content = menuRoot.querySelector<HTMLElement>(".menu-content")!;
    this.beforeOpen = beforeOpen;
    observe(this, "visible", (visible) => {
      if (visible) {
        cancelInteraction.value = this;
        this.beforeOpen?.();
        DropdownMenu.openMenu = this;
      } else if (DropdownMenu.openMenu === this) DropdownMenu.openMenu = undefined;
      this.content.hidden = !visible;
    });
    this.trigger = menuRoot.querySelector<HTMLButtonElement>("button")!;
    this.trigger.addEventListener("click", () => this.toggle());
    if (!DropdownMenu.outsideClick) {
      DropdownMenu.outsideClick = ({ target }) => {
        const { openMenu } = DropdownMenu;
        if (openMenu && !openMenu.menuRoot.contains(target as Node)) openMenu.visible = false;
      };
      globalThis.addEventListener("click", DropdownMenu.outsideClick);
    }
    cancelInteraction.subscribe((initiator) => {
      if (initiator === this || !this.visible) return;
      this.visible = false;
      if (initiator === "Escape") this.trigger.focus();
    });
  }

  toggle = (visible = !this.visible) => {
    if (visible !== this.visible) this.visible = visible;
  };
}

/** Root contains a trigger button and .menu-content element. */
export function initDropdownMenu(menuRoot: HTMLElement, beforeOpen?: () => void): DropdownMenu {
  return new DropdownMenu(menuRoot, beforeOpen);
}

/** Attach selection behavior to existing data-value buttons and a trigger label. */
export function initChoiceMenu<T extends string>(menuRoot: HTMLElement, selection: Signal<T>): DropdownMenu {
  const menu = initDropdownMenu(menuRoot);
  const label = menuRoot.querySelector<HTMLElement>(".choice-label")!;
  const buttons = menuRoot.querySelectorAll<HTMLButtonElement>("button[data-value]");
  function select({ currentTarget }: MouseEvent) {
    selection.value = (currentTarget as HTMLButtonElement).dataset.value as T;
    menu.visible = false;
  }
  for (const button of buttons) button.addEventListener("click", select);
  selection.subscribe((value) => {
    for (const button of buttons) {
      const selected = button.dataset.value === value;
      button.classList.toggle("active", selected);
      if (selected) label.textContent = button.textContent!.trim();
    }
  });
  return menu;
}
