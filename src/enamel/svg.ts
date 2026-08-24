import { activeEidosValues, type Annotated, type Palette, Topos } from "../topos.ts";
import { appendChild, attrs, indexById, serializeXml, XmlEl } from "../jsonml/jsonml.ts";
import { svgRoot } from "../jsonml/svg.ts";
import compendiumJson from "./compendium/compendium.gen.json" with { type: "json" };
import { renderNode } from "./node.ts";
import { EIDOS_VALUES, EidosAxis, EidosMap } from "../eidos.ts";
import { annotateTitle } from "../legend/annotate.ts";
import type { FilterAnimation } from "./animation.ts";
import { type RenderOptions, renderParameters } from "./render-params.ts";
import { resolveViewport } from "./viewport.ts";

export const COMPENDIUM = compendiumJson as unknown as XmlEl;
const COMPENDIUM_BY_ID = indexById(COMPENDIUM);

const DEFAULT_RENDER: RenderOptions = {
  parameters: { theme: "light" },
  override: false,
  transparent: false,
};

export function compendiumAsset(id: string): XmlEl | undefined {
  return COMPENDIUM_BY_ID.get(id);
}

/** Mutable context shared by one SVG render pass: render policy, used assets, and unique IDs. */
export interface Registry {
  animationDisabled: boolean;
  colors: Set<string>;
  filters: Set<string>;
  symbols: Set<string>;
  markers: Set<string>;
  uid: number;
}

export function cssVars(variables: Record<string, string | undefined>): string | undefined {
  const declarations = Object.entries(variables)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => `${name}: ${value}`);
  return declarations.length > 0 ? declarations.join("; ") : undefined;
}

export function entityStyle(entity: Annotated, extra?: Record<string, string | undefined>): string | undefined {
  return cssVars({
    "--tp-font": entity.properties?.font,
    "--tp-font-weight": entity.properties?.["font-weight"],
    "--tp-entity-fill": entity.properties?.["fill-color"],
    "--tp-entity-stroke": entity.properties?.["stroke-color"],
    "--tp-entity-label": entity.properties?.["label-color"],
    ...extra,
  });
}

const SKIP_CLASS_AXES: Partial<Record<EidosAxis, boolean /*skip only non-default*/>> = {
  pattern: true,
  effect: true,
  weight: true,
  edgeBody: true,
  edgeRoute: true,
  attachment: false,
  layering: true,
  corner: true,
  noteMode: true,
  animation: true,
  particle: true,
  marker: false,
  textHorizontal: false,
  textVertical: false,
  textAlign: false,
} as const;

export function addEidosClasses(classSet: Set<string>, eidos: EidosMap | undefined, registry: Registry): void {
  if (!eidos) return;
  for (const { axis, value, scope, isDefault } of activeEidosValues(eidos)) {
    if (axis === "color") registry.colors.add(value);
    const skip = SKIP_CLASS_AXES[axis];
    if (skip === false || skip === isDefault) continue;
    classSet.add(scope ? `tp-${scope}-${value}` : axis === "color" ? `tp-color-${value}` : `tp-${value}`);
  }
}

/**
 * Filter resolution from eidos effect value.
 */
export function resolveFilter(element: XmlEl, effect: string | undefined, registry: Registry, animation?: FilterAnimation): void {
  if (effect) {
    const animatedId = `tpc-flt-${effect}-animate`;
    if (animation && compendiumAsset(animatedId)) {
      const id = `${animatedId}-${registry.uid++}`;
      const clone = structuredClone(compendiumAsset(animatedId)!);
      attrs(clone).id = id;
      configureAnimation(clone, animation);
      appendChild(element, clone);
      attrs(element).filter = `url(#${id})`;
      return;
    }
    const fullId = `tpc-flt-${effect}`;
    if (compendiumAsset(fullId)) {
      registry.filters.add(fullId);
      attrs(element).filter = `url(#${fullId})`;
    }
  }
}

function configureAnimation(element: XmlEl, animation: FilterAnimation): void {
  if (element[0] === "animate") {
    const a = attrs(element);
    a.begin ??= animation.begin;
    const duration = Number.parseFloat(String(a.dur));
    if (Number.isFinite(duration) && animation.speed) a.dur = `${duration / animation.speed}s`;
    if (animation.reverse && typeof a.values === "string") a.values = a.values.split(";").reverse().join(";");
  }
  for (const child of element.slice(2)) {
    if (Array.isArray(child)) configureAnimation(child as XmlEl, animation);
  }
}

export function resolveMarker(type: string | undefined, registry: Registry): string {
  let m = type?.trim();
  if (!m) m = "arrow";
  let fullId = `tpc-arr-${m}`;
  if (!compendiumAsset(fullId)) {
    fullId = "tpc-arr-arrow";
  }
  registry.markers.add(fullId);
  return `url(#${fullId})`;
}

/** High-level Topos → JsonML AST conversion. */
export function buildSvgTree(ast: Topos, options: RenderOptions = DEFAULT_RENDER): XmlEl {
  const title = options.parameters.title;
  const root = title === undefined ? ast.root : { ...ast.root };
  if (title !== undefined) annotateTitle({ ...ast, root }, title);
  const properties = renderParameters(ast.parameters, options);
  const registry: Registry = {
    animationDisabled: properties.animation === "false",
    colors: new Set(),
    filters: new Set(),
    symbols: new Set(),
    markers: new Set(),
    uid: 0,
  };

  // 1. Resolve presentation bounds and viewport
  const viewport = resolveViewport(root, ast.nodes, ast.edges, properties);

  // 2. Resolve theme
  const bg = properties.bg;
  const paper = properties.paper;
  const ink = properties.ink;

  const styleParts: string[] = [];
  if (paper) styleParts.push(`--tp-paper: ${paper}`);
  if (ink) styleParts.push(`--tp-ink: ${ink}`);
  if (properties.font) styleParts.push(`--tp-diagram-font: ${properties.font}`);
  if (properties["font-weight"]) styleParts.push(`--tp-diagram-font-weight: ${properties["font-weight"]}`);
  if (bg && bg != "transparent") styleParts.push(`background: ${bg}`);
  const svg = svgRoot(viewport.intrinsicWidth, viewport.intrinsicHeight, {
    class: registry.animationDisabled ? "tp-animation-disabled" : undefined,
    viewBox: `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`,
    style: styleParts.length > 0 ? styleParts.join("; ") : undefined,
  });

  // Render content first to populate the used-asset registry.
  renderNode(root, svg, registry);

  // Definitions serialize before visible content even though content determines the subset.
  svg.splice(2, 0, buildDefs(registry, ast.palette, properties.compendium === "true"));

  return svg;
}

/** Built <defs> using the side-effects of the render pass. */
function buildDefs(registry: Registry, palette: Palette, compendium: boolean): XmlEl {
  if (compendium) {
    const defs = structuredClone(COMPENDIUM);
    const existing = indexById(defs).get("tp-palette");
    const style = instantiatePalette(palette);
    if (existing && style) defs.splice(defs.indexOf(existing), 1, style);
    appendColorStyles(defs, EIDOS_VALUES.color);
    return defs;
  }

  const defs: XmlEl = ["defs", {}];
  const style = compendiumAsset("tp-base");
  if (style) defs.push(structuredClone(style));

  if (registry.colors.size > 0) {
    const style = compendiumAsset("tp-palette");
    if (style) {
      const clone = structuredClone(style);
      const overrides = instantiatePalette(palette);
      if (overrides) clone.push(...overrides.slice(2));
      defs.push(clone);
    }
    appendColorStyles(defs, registry.colors);
  }

  for (const ids of [registry.markers, registry.symbols, registry.filters]) {
    for (const id of ids) {
      const asset = compendiumAsset(id);
      if (asset) defs.push(structuredClone(asset));
    }
  }
  return defs;
}

function instantiatePalette(palette: Palette): XmlEl | undefined {
  const entries = Object.entries(palette);
  if (entries.length === 0) return;
  const template = compendiumAsset("tp-palette-template");
  if (!template) return;
  const style = instantiateStyle(template, entries.map(([COLOR, VALUE]) => ({ COLOR, VALUE })));
  attrs(style).id = "tp-palette";
  return style;
}

function appendColorStyles(defs: XmlEl, colors: Iterable<string>): void {
  const template = compendiumAsset("tp-color-template");
  if (!template) return;
  const existing = indexById(defs).get("tp-colors");
  const style = instantiateStyle(template, [...colors].map((COLOR) => ({ COLOR })));
  attrs(style).id = "tp-colors";
  if (existing) defs.splice(defs.indexOf(existing), 1, style);
  else {
    const base = indexById(defs).get("tp-base");
    defs.splice(base ? defs.indexOf(base) : defs.length, 0, style);
  }
}

function instantiateStyle(template: XmlEl, replacements: Array<Record<string, string>>): XmlEl {
  const style = structuredClone(template);
  expandStyleTemplate(style, replacements);
  return style;
}

function expandStyleTemplate(element: XmlEl, replacements: Array<Record<string, string>>): void {
  const tokens = new Set(replacements.flatMap(Object.keys));
  for (let i = 2; i < element.length; i++) {
    const child = element[i];
    if (typeof child === "string" && [...tokens].some((token) => child.includes(token))) {
      const expanded = replacements.map((replacement) => {
        const entries = Object.entries(replacement);
        return entries.reduce((text, [token, value]) => text.replaceAll(token, value), child);
      });
      element[i] = expanded.join("");
    } else if (Array.isArray(child)) {
      expandStyleTemplate(child as XmlEl, replacements);
    }
  }
}

/** Topos Diagram → SVG string. */
export function renderToSVG(diagram: Topos, options: RenderOptions = DEFAULT_RENDER): string {
  const tree = buildSvgTree(diagram, options);
  return serializeXml(tree, options.xmlDeclaration !== false);
}

/**
 * Dynamic Local Pattern Injection.
 * Matches any class 'c' where 'tp-c' exists in compendium patterns.
 * Clones the pattern into the container with a unique local ID.
 * Returns a style string referencing the local ID.
 */
export function injectLocalAssets(container: XmlEl, pattern: string | undefined, registry: Registry): string | undefined {
  if (!pattern || pattern.startsWith("no-")) return undefined;
  const patternKey = `tpc-pat-${pattern}`;
  const patternAsset = compendiumAsset(patternKey);
  if (patternAsset) {
    const id = `${patternKey}-${registry.uid++}`;
    const patternClone = structuredClone(patternAsset);
    attrs(patternClone).id = id;
    appendChild(container, patternClone);
    return `fill: url(#${id}); --tp-local-fill: url(#${id});`;
  }
  return undefined;
}
