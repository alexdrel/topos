import { parseTopos, renderToSVG, type StringParameters } from "#topos-core";
import { errorMessage } from "./util.ts";

export type ToposRenderResult =
  | { ok: true; svg: string }
  | { ok: false; error: string };

export interface ViewerAppearance {
  theme: "host" | "light" | "dark";
  force: boolean;
}

const HOST_SURFACE: StringParameters = {
  theme: "host",
  bg: "transparent",
  paper: "var(--vscode-editor-background)",
  ink: "var(--vscode-editor-foreground)",
};

export function renderToposDocument(
  source: string,
  fence: StringParameters = {},
  override = false,
  appearance: ViewerAppearance = { theme: "host", force: false },
): ToposRenderResult {
  try {
    const parameters = appearance.theme === "host"
      ? fence.theme === "light" || fence.theme === "dark" ? fence : { ...HOST_SURFACE, ...fence }
      : { ...fence, theme: appearance.theme };
    return {
      ok: true,
      svg: renderToSVG(parseTopos(source), {
        parameters,
        override: override || appearance.force,
        transparent: appearance.theme === "host" ? undefined : false,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
    };
  }
}
