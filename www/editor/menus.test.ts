import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { Signal } from "@alexdrel/perky";
import { cancelInteraction } from "./app-context.ts";

import { initChoiceMenu, initDropdownMenu } from "./menus.ts";

test("choice menus follow shared selection, select nested clicks, and coordinate opening", (t) => {
  const window = new Window();
  const document = window.document as unknown as Document;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "addEventListener");
  const globalHandlers: string[] = [];
  Object.defineProperty(globalThis, "addEventListener", {
    configurable: true,
    value: (...args: Parameters<typeof window.addEventListener>) => {
      globalHandlers.push(args[0]);
      window.addEventListener(...args);
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "addEventListener", previous);
    else Reflect.deleteProperty(globalThis, "addEventListener");
  });
  document.body.innerHTML = `
    <div id="first" class="dropdown">
    <button id="trigger"><span>Choice: <span class="choice-label"></span></span><span>▼</span></button>
    <div id="menu" class="menu-content" hidden>
      <button data-value="a"><span>A</span></button>
      <button data-value="b"><span>B</span></button>
    </div>
    </div>
    <div id="second" class="dropdown">
    <button id="other-trigger"><span class="choice-label"></span></button>
    <div id="other-menu" class="menu-content" hidden><button data-value="a">A</button><button data-value="b">B</button></div>
    </div>`;
  const trigger = document.querySelector<HTMLButtonElement>("#trigger")!;
  const content = document.querySelector<HTMLElement>("#menu")!;
  const otherTrigger = document.querySelector<HTMLButtonElement>("#other-trigger")!;
  const otherContent = document.querySelector<HTMLElement>("#other-menu")!;
  const selection = new Signal("a");
  const first = initChoiceMenu(document.querySelector<HTMLElement>("#first")!, selection);
  assert.equal(first.visible, false);
  initChoiceMenu(document.querySelector<HTMLElement>("#second")!, selection);
  const buttons = content.querySelectorAll<HTMLButtonElement>("button");
  assert.equal(trigger.querySelector("span")!.textContent, "Choice: A");
  assert.equal(buttons[0].classList.contains("active"), true);
  selection.value = "b";
  assert.equal(buttons[0].classList.contains("active"), false);
  assert.equal(buttons[1].classList.contains("active"), true);
  assert.equal(otherTrigger.textContent, "B");
  assert.equal(trigger.querySelector("span")!.textContent, "Choice: B");
  assert.equal(trigger.lastElementChild!.textContent, "▼");

  trigger.click();
  assert.equal(first.visible, true);
  assert.equal(content.hidden, false);
  otherTrigger.click();
  assert.equal(content.hidden, true);
  assert.equal(otherContent.hidden, false);
  assert.equal(first.visible, false);
  trigger.click();
  buttons[0].querySelector("span")!.click();
  assert.equal(selection.value, "a");
  assert.equal(content.hidden, true);
  assert.equal(buttons[0].classList.contains("active"), true);
  trigger.click();
  document.body.click();
  assert.equal(content.hidden, true);

  const plainTrigger = document.createElement("button");
  const plainContent = document.createElement("div");
  plainContent.classList.add("menu-content");
  plainContent.hidden = true;
  const plainRoot = document.createElement("div");
  plainRoot.append(plainTrigger, plainContent);
  document.body.append(plainRoot);
  let opens = 0;
  let bubbled = 0;
  window.addEventListener("click", () => {
    bubbled++;
  });
  const plain = initDropdownMenu(plainRoot, () => {
    opens++;
  });
  first.toggle(true);
  plain.toggle(true);
  assert.equal(content.hidden, true);
  assert.equal(plainContent.hidden, false);
  assert.deepEqual(globalHandlers, ["click"]);
  plainContent.click();
  assert.equal(bubbled, 1);
  assert.equal(plainContent.hidden, false);
  plain.toggle(true);
  assert.equal(opens, 1);
  first.toggle(false);
  first.toggle(true);
  assert.equal(plainContent.hidden, true);
  plain.toggle(true);
  assert.equal(opens, 2);
  assert.equal(cancelInteraction.value, plain);
  cancelInteraction.value = plain;
  assert.equal(plainContent.hidden, false);
  cancelInteraction.value = "Escape";
  assert.equal(plainContent.hidden, true);
  assert.equal(document.activeElement, plainTrigger);
  plain.toggle(true);
  otherTrigger.focus();
  cancelInteraction.value = {};
  assert.equal(plainContent.hidden, true);
  assert.equal(document.activeElement, otherTrigger);
  plain.visible = true;
  assert.equal(plainContent.hidden, false);
  assert.equal(cancelInteraction.value, plain);
  plain.toggle();
  assert.equal(plain.visible, false);
  assert.equal(plainContent.hidden, true);
  plain.toggle(false);
  first.toggle(false);
});
