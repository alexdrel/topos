import type { StringParameters } from "../topos.ts";

export interface RenderOptions {
  /** External parameters supplied by this renderer consumer. */
  parameters: StringParameters;
  /** Whether external parameters replace corresponding diagram parameters. */
  override: boolean;
  /** Force transparent/opaque output; omit to use the merged background. */
  transparent?: boolean;
  /** Include the XML declaration required by standalone SVG documents. */
  xmlDeclaration?: boolean;
}

const LIGHT_THEME: StringParameters = {
  paper: "#fdfaf6",
  ink: "#111111",
};

const DARK_THEME: StringParameters = {
  paper: "#1a1a1a",
  ink: "#ffffff",
};

export function renderParameters(authored: StringParameters, options: RenderOptions): StringParameters {
  const diagram = normalizeParameters(authored);
  const external = normalizeParameters(options.parameters);
  const rendered = options.override ? { ...diagram, ...external } : { ...external, ...diagram };

  if (!rendered.ink || !rendered.paper || rendered.paper === "transparent") {
    throw new Error("Rendering requires concrete ink and paper parameters");
  }

  if (options.transparent === true) rendered.bg = "transparent";
  if (options.transparent === false && (!rendered.bg || rendered.bg === "transparent")) {
    rendered.bg = rendered.paper;
  }
  return rendered;
}

function normalizeParameters(parameters: StringParameters): StringParameters {
  const normalized: StringParameters = {};
  if (parameters.theme === "light") Object.assign(normalized, LIGHT_THEME);
  if (parameters.theme === "dark") Object.assign(normalized, DARK_THEME);
  for (const [name, value] of Object.entries(parameters)) {
    if (name === "theme" || value === undefined) continue;
    if (name === "bg" && value === "light") normalized.bg = LIGHT_THEME.paper;
    else if (name === "bg" && value === "dark") normalized.bg = DARK_THEME.paper;
    else normalized[name] = value;
  }
  if (normalized.bg && normalized.bg !== "transparent" && parameters.paper === undefined) {
    normalized.paper = normalized.bg;
  }
  if (normalized.width !== undefined) normalized.scale = undefined;
  else if (normalized.scale !== undefined) normalized.width = undefined;
  return normalized;
}
