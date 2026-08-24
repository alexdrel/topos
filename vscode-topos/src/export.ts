import * as vscode from "vscode";
import { parseHeaderTail, parseTopos, renderToSVG } from "#topos-core";
import type { ActiveToposSource } from "./source.ts";
import { errorMessage } from "./util.ts";
import exportPreviewTemplate from "./export-preview.html" with { type: "text" };

type ExportFormat = "svg" | "png";
type ExportTheme = "light" | "dark";
interface ExportSettings {
  theme: ExportTheme;
  override: boolean;
  transparent: boolean;
  scale?: string;
  width?: string;
  additional: string;
}
type ExportAction = vscode.QuickPickItem & {
  action: "copy" | "customize" | ExportFormat;
};
type Customization = vscode.QuickPickItem & {
  action: "done" | "theme" | "background" | "size" | "priority" | "additional";
};
type SizeChoice = vscode.QuickPickItem & {
  action: "unscaled" | "double" | "scale" | "width";
};
type RenderCustomization = (settings: ExportSettings) => string | undefined;

type ExportPreviewMessage =
  | { type: "ready" }
  | { type: "previewReady" }
  | { type: "pngReady"; png: string }
  | { type: "error"; message: string };

export function exportDiagram(
  source: ActiveToposSource,
  extensionUri: vscode.Uri,
): void {
  let settings = defaultExportSettings();
  const initialSvg = renderToposSource(source, settings);
  if (!initialSvg) return;
  let svg = initialSvg;

  const panel = vscode.window.createWebviewPanel(
    "topos.exportPreview",
    "Export Preview",
    vscode.ViewColumn.Active,
    { enableScripts: true },
  );
  panel.iconPath = vscode.Uri.joinPath(
    extensionUri,
    "resources",
    "topos-view.svg",
  );
  panel.webview.html = exportPreviewTemplate;

  let choosingOutput = false;
  const messageSubscription = panel.webview.onDidReceiveMessage(
    async (message: ExportPreviewMessage) => {
      switch (message.type) {
        case "ready":
          await panel.webview.postMessage({ type: "render", svg });
          break;
        case "previewReady": {
          if (choosingOutput) return;
          choosingOutput = true;
          const customized = await chooseExportOutput(
            panel,
            source.document.uri,
            svg,
            settings,
            async (previewSettings) => {
              const previewSvg = renderToposSource(source, previewSettings);
              if (!previewSvg) return;
              svg = previewSvg;
              await panel.webview.postMessage({ type: "render", svg });
            },
            (previewSettings) => renderToposSource(source, previewSettings),
            authoredSizeLabel(source),
          );
          if (!customized) break;
          const customizedSvg = renderToposSource(source, customized);
          if (!customizedSvg) {
            panel.dispose();
            break;
          }
          settings = customized;
          svg = customizedSvg;
          choosingOutput = false;
          await panel.webview.postMessage({ type: "render", svg });
          break;
        }
        case "pngReady":
          await saveExport(
            panel,
            source.document.uri,
            "png",
            svg,
            message.png,
          );
          break;
        case "error":
          void vscode.window.showErrorMessage(message.message);
          panel.dispose();
          break;
        default: {
          const unknownMessage: never = message;
          throw new Error(
            `Unknown export preview message: ${JSON.stringify(unknownMessage)}`,
          );
        }
      }
    },
  );
  panel.onDidDispose(() => messageSubscription.dispose());
}

async function chooseExportOutput(
  panel: vscode.WebviewPanel,
  source: vscode.Uri,
  svg: string,
  settings: ExportSettings,
  previewCustomization: (settings: ExportSettings) => Promise<void>,
  renderCustomization: RenderCustomization,
  authoredSize: string | undefined,
): Promise<ExportSettings | undefined> {
  while (true) {
    const action = await vscode.window.showQuickPick<ExportAction>(
      [
        { label: "Save SVG…", action: "svg" },
        { label: "Save PNG…", action: "png" },
        { label: "Copy SVG as Text", action: "copy" },
        { label: "Customize…", action: "customize" },
      ],
      {
        placeHolder: "Export output",
      },
    );

    if (!action) {
      panel.dispose();
      return;
    }

    switch (action.action) {
      case "copy":
        await vscode.env.clipboard.writeText(svg);
        void vscode.window.showInformationMessage("Copied SVG as text");
        panel.dispose();
        return;
      case "svg":
        await saveExport(panel, source, "svg", svg, undefined);
        return;
      case "png":
        await panel.webview.postMessage({ type: "rasterize" });
        return;
      case "customize": {
        const customized = await customizeExport(
          settings,
          previewCustomization,
          renderCustomization,
          authoredSize,
        );
        if (customized) return customized;
        break;
      }
      default: {
        const unknownAction: never = action.action;
        throw new Error(`Unknown export output: ${unknownAction}`);
      }
    }
  }
}

async function saveExport(
  panel: vscode.WebviewPanel,
  source: vscode.Uri,
  format: ExportFormat,
  svg: string,
  png: string | undefined,
): Promise<void> {
  const label = format.toUpperCase();
  const target = await vscode.window.showSaveDialog({
    defaultUri: defaultExportUri(source, format),
    filters: { [label]: [format] },
    saveLabel: `Export ${label}`,
  });
  if (!target) {
    panel.dispose();
    return;
  }

  const bytes = format === "svg" ? new TextEncoder().encode(svg) : decodePngDataUrl(png);
  if (!bytes) {
    void vscode.window.showErrorMessage(
      "PNG preview did not produce image data.",
    );
    panel.dispose();
    return;
  }

  await vscode.workspace.fs.writeFile(target, bytes);
  await vscode.commands.executeCommand(
    "vscode.openWith",
    target,
    "imagePreview.previewEditor",
    panel.viewColumn ?? vscode.ViewColumn.Active,
  );
  panel.dispose();
}

function defaultExportSettings(): ExportSettings {
  const kind = vscode.window.activeColorTheme.kind;
  const theme = kind === vscode.ColorThemeKind.Light ||
      kind === vscode.ColorThemeKind.HighContrastLight
    ? "light"
    : "dark";
  return { theme, override: false, transparent: true, additional: "" };
}

async function customizeExport(
  current: ExportSettings,
  preview: (settings: ExportSettings) => Promise<void>,
  render: RenderCustomization,
  authoredSize: string | undefined,
): Promise<ExportSettings | undefined> {
  const customized: ExportSettings = { ...current };
  while (true) {
    const sizeLocked = !customized.override && authoredSize !== undefined;
    let size = "Unscaled";
    if (sizeLocked) size = authoredSize;
    else if (customized.width) size = `${customized.width}px wide`;
    else if (customized.scale) size = `${customized.scale}×`;
    const choice = await vscode.window.showQuickPick<Customization>([
      { label: "Done", action: "done" },
      { label: `Theme: ${capitalize(customized.theme)}`, action: "theme" },
      {
        label: `Background: ${customized.transparent ? "Transparent" : "Opaque"}`,
        action: "background",
      },
      {
        label: `Size: ${size} ${renderedSize(customized, render)}`,
        description: sizeLocked ? "Set Priority to Export to customize" : undefined,
        action: "size",
      },
      {
        label: `Priority: ${customized.override ? "Export" : "Diagram"}`,
        description: customized.override ? "Export settings win" : "Authored values win",
        action: "priority",
      },
      {
        label: "Additional Parameters",
        description: customized.additional || "None",
        action: "additional",
      },
    ], {
      placeHolder: "Customize export",
    });
    if (!choice) return customized;

    let changed = true;
    switch (choice.action) {
      case "done":
        return customized;
      case "theme":
        customized.theme = customized.theme === "light" ? "dark" : "light";
        break;
      case "priority":
        customized.override = !customized.override;
        break;
      case "background":
        customized.transparent = !customized.transparent;
        break;
      case "size":
        if (sizeLocked) {
          void vscode.window.showInformationMessage("Set export Priority to Export before changing size.");
          changed = false;
        } else changed = await customizeExportSize(customized, render);
        break;
      case "additional": {
        const additional = await vscode.window.showInputBox({
          prompt: "Additional export parameters (optional)",
          placeHolder: 'font="Helvetica"',
          value: customized.additional,
        });
        if (additional === undefined) changed = false;
        else customized.additional = additional;
        break;
      }
      default: {
        const unknownChoice: never = choice.action;
        throw new Error(`Unknown export customization: ${unknownChoice}`);
      }
    }
    if (changed) await preview(customized);
  }
}

async function customizeExportSize(settings: ExportSettings, render: RenderCustomization): Promise<boolean> {
  const unscaled = { ...settings, scale: undefined, width: undefined };
  const doubled = { ...settings, scale: "2", width: undefined };
  const choice = await vscode.window.showQuickPick<SizeChoice>([
    { label: `Unscaled ${renderedSize(unscaled, render)}`, action: "unscaled" },
    { label: `2× ${renderedSize(doubled, render)}`, action: "double" },
    { label: "Custom scale…", action: "scale" },
    { label: "Custom width…", action: "width" },
  ], { placeHolder: "Export size" });
  if (!choice) return false;

  let value: string | undefined;
  if (choice.action === "scale" || choice.action === "width") {
    const scale = choice.action === "scale";
    value = await vscode.window.showInputBox({
      prompt: scale ? "Export scale" : "Export width in pixels",
      placeHolder: scale ? "2" : "1200",
      value: scale ? settings.scale : settings.width,
      validateInput: (value) => Number(value) > 0 ? undefined : "Enter a positive number",
    });
    if (value === undefined) return false;
  }

  settings.scale = undefined;
  settings.width = undefined;
  if (choice.action === "double") settings.scale = "2";
  else if (choice.action === "scale") settings.scale = value?.trim();
  else if (choice.action === "width") settings.width = value?.trim();
  return true;
}

function renderedSize(settings: ExportSettings, render: RenderCustomization): string {
  const svg = render(settings);
  const width = svg?.match(/<svg\b[^>]*\bwidth="([^"]+)"/)?.[1];
  const height = svg?.match(/<svg\b[^>]*\bheight="([^"]+)"/)?.[1];
  return width && height ? `(${Math.round(Number(width))} × ${Math.round(Number(height))} px)` : "";
}

function authoredSizeLabel(source: ActiveToposSource): string | undefined {
  const parameters = { ...source.fence, ...parseTopos(source.text).parameters };
  if (parameters.width) return `${parameters.width}px wide`;
  if (parameters.scale) return `${parameters.scale}×`;
  return undefined;
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}

function renderToposSource(
  source: ActiveToposSource,
  settings: ExportSettings,
): string | undefined {
  try {
    const parameters = parseHeaderTail(settings.additional).parameters;
    if (settings.scale) parameters.scale = settings.scale;
    if (settings.width) parameters.width = settings.width;
    parameters.theme = settings.theme;
    return renderToSVG(parseTopos(source.text), {
      parameters: { ...source.fence, ...parameters },
      override: settings.override,
      transparent: settings.transparent,
    });
  } catch (error) {
    void vscode.window.showErrorMessage(
      errorMessage(error),
    );
    return undefined;
  }
}

function decodePngDataUrl(dataUrl: string | undefined): Uint8Array | undefined {
  const prefix = "data:image/png;base64,";
  if (!dataUrl?.startsWith(prefix)) return undefined;
  const binary = atob(dataUrl.slice(prefix.length));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function defaultExportUri(
  source: vscode.Uri,
  format: ExportFormat,
): vscode.Uri {
  const path = source.path.match(/\.[^/.]+$/) ? source.path.replace(/\.[^/.]+$/, `.${format}`) : source.path + `.${format}`;
  return source.with({ path });
}
