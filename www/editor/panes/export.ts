/// <reference lib="dom" />
import { showTemporaryLabel } from "../dom-utils.ts";
import { type DropdownMenu, initDropdownMenu } from "../menus.ts";
import exportMenu, { type Params, type Refs } from "./export-menu.html.js";
import { materialize } from "@alexdrel/pralinejs";

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

export class ExportMenu implements Params {
  refs: Refs;
  renderTopos: (transparent: boolean) => string;
  toggle: DropdownMenu["toggle"];

  constructor(mount: HTMLElement, renderTopos: (transparent: boolean) => string) {
    this.renderTopos = renderTopos;
    const { fragment, refs } = materialize(exportMenu, this);
    this.refs = refs;
    mount.replaceChildren(fragment);

    this.toggle = initDropdownMenu(mount).toggle;
  }

  renderSvg(): string {
    return this.renderTopos(this.refs.chkSvgTransparent.checked);
  }

  async copyXml() {
    try {
      await navigator.clipboard.writeText(this.renderSvg());
      showTemporaryLabel(this.refs.svgCopyXmlBtn, "Copied!");
    } catch (error) {
      console.error("Failed to copy SVG XML:", error);
    }
  }

  async copyPng() {
    try {
      const blob = await svgToPng(this.renderSvg());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showTemporaryLabel(this.refs.svgCopyPngBtn, "Copied!");
    } catch (error) {
      console.error("Failed to copy SVG PNG:", error);
    }
  }

  downloadXml() {
    this.toggle(false);
    saveBlob(new Blob([this.renderSvg()], { type: "image/svg+xml" }), "diagram.svg");
  }

  openXml() {
    this.toggle(false);
    openBlob(new Blob([this.renderSvg()], { type: "image/svg+xml" }));
  }

  async downloadPng() {
    this.toggle(false);
    try {
      saveBlob(await svgToPng(this.renderSvg()), "diagram.png");
    } catch (error) {
      console.error("Failed to download SVG PNG:", error);
    }
  }

  async openPng() {
    this.toggle(false);
    try {
      openBlob(await svgToPng(this.renderSvg()));
    } catch (error) {
      console.error("Failed to open SVG PNG:", error);
    }
  }
}
