import { assertEquals } from "@std/assert";
import { getCreateOptions } from "../create-menu.ts";
import { isMac } from "../dom.ts";

Deno.test("create menu teaches native Slate gestures", () => {
  const mac = isMac();
  assertEquals(
    getCreateOptions().map(({ kind, gesture }) => [kind, gesture]),
    [
      ["text", "double-click"],
      ["box", mac ? "⌘ drag" : "Ctrl drag"],
      ["line", mac ? "⌥ drag" : "Alt drag"],
      ["hub", mac ? "⌥ click" : "Alt click"],
      ["glyph", mac ? "⇧ Space" : "Shift Space"],
    ],
  );
});
