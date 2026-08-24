export const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

export function isModKey(event: MouseEvent | KeyboardEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable;
}

export interface DropdownMenuApi {
  close: () => void;
}

export function initDropdownMenu(
  triggerBtn: HTMLElement | null,
  contentEl: HTMLElement | null,
  onBeforeOpen?: () => void,
): DropdownMenuApi {
  const close = () => {
    if (contentEl) contentEl.classList.add("hidden");
  };
  if (triggerBtn && contentEl) {
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (contentEl.classList.contains("hidden") && onBeforeOpen) {
        onBeforeOpen();
      }
      contentEl.classList.toggle("hidden");
    });
    globalThis.addEventListener("click", () => {
      close();
    });
    contentEl.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
  return { close };
}

export function showTemporaryLabel(btn: HTMLButtonElement, label: string, successClass?: string): void {
  const spans = btn.querySelectorAll("span:not(.btn-glyph)");
  const labelSpan = spans[spans.length - 1] as HTMLElement | null;
  if (!labelSpan) return;

  const originalText = labelSpan.textContent || "";
  labelSpan.textContent = label;
  btn.disabled = true;
  if (successClass) btn.classList.add(successClass);
  setTimeout(() => {
    labelSpan.textContent = originalText;
    btn.disabled = false;
    if (successClass) btn.classList.remove(successClass);
  }, 1000);
}
