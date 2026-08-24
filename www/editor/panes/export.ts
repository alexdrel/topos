/// <reference lib="dom" />
import { isTypingTarget, showTemporaryLabel } from "../dom-utils.ts";
import exportMenuHtml from "./export-menu.html?raw";

interface ExportConfig {
  controls: HTMLElement;
  renderSvg(transparent: boolean): string;
  isActive(): boolean;
  keyboardShortcuts?: boolean;
}

export function initExport(config: ExportConfig): void {
  const mount = config.controls.querySelector<HTMLElement>("#export-menu-dropdown");
  if (!mount) return;
  mount.innerHTML = exportMenuHtml;

  const copyPngButton = mount.querySelector<HTMLButtonElement>(".btn-copy-png")!;
  const copyXmlButton = mount.querySelector<HTMLButtonElement>(".btn-copy-xml")!;
  const downloadPngButton = mount.querySelector<HTMLButtonElement>(".btn-download-png")!;
  const downloadXmlButton = mount.querySelector<HTMLButtonElement>(".btn-download-xml")!;
  const openPngButton = mount.querySelector<HTMLButtonElement>(".btn-open-png")!;
  const openXmlButton = mount.querySelector<HTMLButtonElement>(".btn-open-xml")!;
  const transparentCheckbox = mount.querySelector<HTMLInputElement>(".chk-transparent")!;
  const menuButton = mount.querySelector<HTMLButtonElement>(".dropdown-trigger-btn")!;
  const menuContent = mount.querySelector<HTMLDivElement>(".menu-content")!;

  function renderSvg(): string {
    return config.renderSvg(transparentCheckbox.checked);
  }

  function closeMenu() {
    menuContent.classList.add("hidden");
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function openBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function svgToPng(svg: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const image = new Image();
      image.onload = async () => {
        try {
          const canvas = new OffscreenCanvas(image.naturalWidth || image.width || 800, image.naturalHeight || image.height || 600);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Failed to get 2D context from OffscreenCanvas");
          context.drawImage(image, 0, 0);
          resolve(await canvas.convertToBlob({ type: "image/png" }));
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      image.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load SVG image: ${error}`));
      };
      image.src = url;
    });
  }

  async function copyXml() {
    try {
      await navigator.clipboard.writeText(renderSvg());
      showTemporaryLabel(copyXmlButton, "Copied!");
    } catch (error) {
      console.error("Failed to copy SVG XML:", error);
    }
  }

  async function copyPng() {
    closeMenu();
    try {
      const blob = await svgToPng(renderSvg());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showTemporaryLabel(copyPngButton, "Copied!");
    } catch (error) {
      console.error("Failed to copy SVG PNG:", error);
    }
  }

  function exportXml(open: boolean) {
    closeMenu();
    const blob = new Blob([renderSvg()], { type: "image/svg+xml" });
    if (open) openBlob(blob);
    else {
      saveBlob(blob, "diagram.svg");
      showTemporaryLabel(downloadXmlButton, "Saved!");
    }
  }

  async function exportPng(open: boolean) {
    closeMenu();
    try {
      const blob = await svgToPng(renderSvg());
      if (open) openBlob(blob);
      else {
        saveBlob(blob, "diagram.png");
        showTemporaryLabel(downloadPngButton, "Saved!");
      }
    } catch (error) {
      console.error("Failed to export SVG PNG:", error);
    }
  }

  copyPngButton.addEventListener("click", copyPng);
  copyXmlButton.addEventListener("click", copyXml);
  downloadPngButton.addEventListener("click", () => void exportPng(false));
  openPngButton.addEventListener("click", () => void exportPng(true));
  downloadXmlButton.addEventListener("click", () => exportXml(false));
  openXmlButton.addEventListener("click", () => exportXml(true));

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    menuContent.classList.toggle("hidden");
  });
  globalThis.addEventListener("click", closeMenu);
  menuContent.addEventListener("click", (event) => event.stopPropagation());

  if (config.keyboardShortcuts) {
    globalThis.addEventListener("keydown", (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!config.isActive() || !mod || event.key.toLowerCase() !== "c" || isTypingTarget(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) void copyXml();
      else void copyPng();
    });
  }
}
