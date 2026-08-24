import type { Loc } from "../../src/geo.ts";
import type { Slate } from "./slate.ts";

export type PopupPosition = { left: number; top: number };

export function positionPopup(
  editor: Slate,
  element: HTMLElement,
  pos: Loc,
  options: {
    placement: "above" | "center" | "top-left";
    gap?: number;
    flipBelow?: boolean;
    reservedHeight?: number;
  },
): PopupPosition {
  const local = editor.surface.viewportPoint(pos);
  const visible = editor.surface.viewportRect();
  const width = element.offsetWidth;
  const height = options.reservedHeight ?? element.offsetHeight;
  const gap = options.gap ?? 8;
  const centered = options.placement !== "top-left";
  let left = centered ? local.x - width / 2 : local.x;
  let top = options.placement === "center" ? local.y - height / 2 : options.placement === "above" ? local.y - height - gap : local.y;
  if (options.placement === "above" && options.flipBelow && top < visible.y) {
    top = local.y + gap;
  }

  left = Math.max(visible.x + 8, Math.min(left, visible.x + visible.w - width - 8));
  top = Math.max(visible.y + 8, Math.min(top, visible.y + visible.h - height - 8));
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  return { left, top };
}
