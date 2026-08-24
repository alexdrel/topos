// deno-fmt-ignore-file
// svg.ts
// Typed SVG wrappers over jsonml.ts.
// Provides compile-time validation of SVG tag names and per-tag attribute shapes.
// Tag list is stable — SVG spec has not added structural tags in 20+ years.

import { xmlEl, type XmlEl, type Attrs, type Child } from "./jsonml.ts";

export const SVG_NS = "http://www.w3.org/2000/svg";

// ─── Tag Union ────────────────────────────────────────────────────────────────

export type SvgTag =
  // Structure
  | 'svg' | 'g' | 'defs' | 'symbol' | 'use' | 'switch'
  // Shapes
  | 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'polygon' | 'path'
  // Text
  | 'text' | 'tspan' | 'textPath'
  // Images & foreign
  | 'image' | 'foreignObject'
  // Gradients & paint
  | 'linearGradient' | 'radialGradient' | 'stop' | 'pattern'
  // Filters
  | 'filter' | 'feBlend' | 'feColorMatrix' | 'feComposite' | 'feFlood'
  | 'feGaussianBlur' | 'feMerge' | 'feMergeNode' | 'feOffset' | 'feTurbulence'
  | 'feDisplacementMap' | 'feMorphology' | 'feDropShadow'
  // Clipping & masking
  | 'clipPath' | 'mask'
  // Animation
  | 'animate' | 'animateTransform' | 'animateMotion' | 'mpath' | 'set'
  // Markers & links
  | 'marker' | 'a' | 'title' | 'desc'
  // Metadata
  | 'metadata' | 'style' | 'script';

// ─── Shared Presentation Attrs ────────────────────────────────────────────────
// Common to almost all SVG elements — not repeated per tag.

interface PresentationAttrs {
  fill?: string;
  'fill-opacity'?: number;
  'fill-rule'?: 'nonzero' | 'evenodd';
  stroke?: string;
  'stroke-width'?: number;
  'stroke-opacity'?: number;
  'stroke-dasharray'?: string;
  'stroke-dashoffset'?: number;
  'stroke-linecap'?: 'butt' | 'round' | 'square';
  'stroke-linejoin'?: 'miter' | 'round' | 'bevel';
  opacity?: number;
  visibility?: 'visible' | 'hidden' | 'collapse';
  transform?: string;
  'clip-path'?: string;
  mask?: string;
  filter?: string;
  cursor?: string;
  'pointer-events'?: string;
  'font-family'?: string;
  'font-size'?: number | string;
  'font-weight'?: 'normal' | 'bold' | number;
  'font-style'?: 'normal' | 'italic' | 'oblique';
  'text-decoration'?: string;
  color?: string;
  display?: string;
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
}

// Common to all elements (id, class, data-*, aria-*, style)
export interface CoreAttrs extends PresentationAttrs {
  id?: string;
  class?: string;
  style?: string;
  tabindex?: number;
  lang?: string;
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
  [ariaAttr: `aria-${string}`]: string | number | boolean | undefined;
}

// ─── Per-Tag Attribute Interfaces ─────────────────────────────────────────────

export interface SvgAttrs extends CoreAttrs {
  width?: number | string;
  height?: number | string;
  viewBox?: string;
  xmlns?: string;
  'xmlns:xlink'?: string;
  preserveAspectRatio?: string;
  x?: number;
  y?: number;
}

export interface GAttrs extends CoreAttrs { }

export interface DefsAttrs extends CoreAttrs { }

export interface SymbolAttrs extends CoreAttrs {
  viewBox?: string;
  preserveAspectRatio?: string;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
}

export interface UseAttrs extends CoreAttrs {
  href?: string;
  'xlink:href'?: string;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
}

export interface RectAttrs extends CoreAttrs {
  x?: number | string;
  y?: number | string;
  width: number | string;
  height: number | string;
  rx?: number;
  ry?: number;
}

export interface CircleAttrs extends CoreAttrs {
  cx?: number;
  cy?: number;
  r: number;
}

export interface EllipseAttrs extends CoreAttrs {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
}

export interface LineAttrs extends CoreAttrs {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  'marker-start'?: string;
  'marker-mid'?: string;
  'marker-end'?: string;
}

export interface PolylineAttrs extends CoreAttrs {
  points: string;
  'marker-start'?: string;
  'marker-mid'?: string;
  'marker-end'?: string;
}

export interface PolygonAttrs extends CoreAttrs {
  points: string;
}

export interface PathAttrs extends CoreAttrs {
  d: string;
  'marker-start'?: string;
  'marker-mid'?: string;
  'marker-end'?: string;
}

export interface TextAttrs extends CoreAttrs {
  x?: number;
  y?: number;
  dx?: number | string;
  dy?: number | string;
  'text-anchor'?: 'start' | 'middle' | 'end';
  'dominant-baseline'?: string;
  'writing-mode'?: string;
  'text-length'?: number;
  'length-adjust'?: string;
  'xml:space'?: 'default' | 'preserve';
}

export interface TspanAttrs extends CoreAttrs {
  x?: number;
  y?: number;
  dx?: number | string;
  dy?: number | string;
  'text-anchor'?: 'start' | 'middle' | 'end';
  'dominant-baseline'?: string;
}

export interface TextPathAttrs extends CoreAttrs {
  href?: string;
  startOffset?: number | string;
  method?: 'align' | 'stretch';
  spacing?: 'auto' | 'exact';
}

export interface ImageAttrs extends CoreAttrs {
  href?: string;
  'xlink:href'?: string;
  x?: number;
  y?: number;
  width: number | string;
  height: number | string;
  preserveAspectRatio?: string;
}

export interface ForeignObjectAttrs extends CoreAttrs {
  x?: number;
  y?: number;
  width: number | string;
  height: number | string;
}

export interface LinearGradientAttrs extends CoreAttrs {
  x1?: number | string;
  y1?: number | string;
  x2?: number | string;
  y2?: number | string;
  gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  gradientTransform?: string;
  spreadMethod?: 'pad' | 'reflect' | 'repeat';
  href?: string;
}

export interface RadialGradientAttrs extends CoreAttrs {
  cx?: number | string;
  cy?: number | string;
  r?: number | string;
  fx?: number | string;
  fy?: number | string;
  gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  gradientTransform?: string;
  spreadMethod?: 'pad' | 'reflect' | 'repeat';
  href?: string;
}

export interface StopAttrs extends CoreAttrs {
  offset: number | string;
  'stop-color'?: string;
  'stop-opacity'?: number;
}

export interface PatternAttrs extends CoreAttrs {
  x?: number | string;
  y?: number | string;
  width: number | string;
  height: number | string;
  patternUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  patternTransform?: string;
  viewBox?: string;
}

export interface FilterAttrs extends CoreAttrs {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  filterUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  primitiveUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
}

export interface FeGaussianBlurAttrs extends CoreAttrs {
  in?: string;
  stdDeviation?: number | string;
  result?: string;
}

export interface FeOffsetAttrs extends CoreAttrs {
  in?: string;
  dx?: number;
  dy?: number;
  result?: string;
}

export interface FeBlendAttrs extends CoreAttrs {
  in?: string;
  in2?: string;
  mode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';
  result?: string;
}

export interface FeFloodAttrs extends CoreAttrs {
  'flood-color'?: string;
  'flood-opacity'?: number;
  result?: string;
}

export interface FeCompositeAttrs extends CoreAttrs {
  in?: string;
  in2?: string;
  operator?: 'over' | 'in' | 'out' | 'atop' | 'xor' | 'arithmetic';
  k1?: number;
  k2?: number;
  k3?: number;
  k4?: number;
  result?: string;
}

export interface FeColorMatrixAttrs extends CoreAttrs {
  in?: string;
  type?: 'matrix' | 'saturate' | 'hueRotate' | 'luminanceToAlpha';
  values?: string;
  keyTimes?: string;
  calcMode?: string;
  result?: string;
}

export interface FeMergeNodeAttrs extends CoreAttrs {
  in?: string;
}

export interface FeTurbulenceAttrs extends CoreAttrs {
  baseFrequency?: number | string;
  numOctaves?: number;
  seed?: number;
  stitchTiles?: 'stitch' | 'noStitch';
  type?: 'fractalNoise' | 'turbulence';
  result?: string;
}

export interface FeDisplacementMapAttrs extends CoreAttrs {
  in?: string;
  in2?: string;
  scale?: number;
  xChannelSelector?: 'R' | 'G' | 'B' | 'A';
  yChannelSelector?: 'R' | 'G' | 'B' | 'A';
  result?: string;
}

export interface FeMorphologyAttrs extends CoreAttrs {
  in?: string;
  operator?: 'erode' | 'dilate';
  radius?: number | string;
  result?: string;
}

export interface FeDropShadowAttrs extends CoreAttrs {
  dx?: number;
  dy?: number;
  stdDeviation?: number | string;
  'flood-color'?: string;
  'flood-opacity'?: number;
  result?: string;
}

export interface ClipPathAttrs extends CoreAttrs {
  clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
}

export interface MaskAttrs extends CoreAttrs {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  maskUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
}

export interface MarkerAttrs extends CoreAttrs {
  markerWidth?: number;
  markerHeight?: number;
  refX?: number | string;
  refY?: number | string;
  orient?: string;
  markerUnits?: 'strokeWidth' | 'userSpaceOnUse';
  viewBox?: string;
}

export interface AnimateAttrs extends CoreAttrs {
  attributeName?: string;
  from?: string | number;
  to?: string | number;
  values?: string;
  dur?: string;
  repeatCount?: string | number;
  begin?: string;
  fill?: 'freeze' | 'remove';
}

export interface AnimateTransformAttrs extends CoreAttrs {
  attributeName?: string;
  type?: 'translate' | 'scale' | 'rotate' | 'skewX' | 'skewY';
  from?: string;
  to?: string;
  values?: string;
  dur?: string;
  begin?: string;
  repeatCount?: string | number;
}

export interface AAttrs extends CoreAttrs {
  href?: string;
  'xlink:href'?: string;
  target?: '_self' | '_parent' | '_top' | '_blank';
}

export interface TitleAttrs extends CoreAttrs { }
export interface DescAttrs extends CoreAttrs { }
export interface MetadataAttrs extends CoreAttrs { }
export interface SwitchAttrs extends CoreAttrs { }
export interface FeMergeAttrs extends CoreAttrs { }
export interface AnimateMotionAttrs extends CoreAttrs {
  path?: string;
  rotate?: string;
  keyPoints?: string;
  keyTimes?: string;
  calcMode?: string;
  dur?: string;
  begin?: string;
  repeatCount?: string | number;
}
export interface MpathAttrs extends CoreAttrs { href?: string; }
export interface SetAttrs extends CoreAttrs { attributeName?: string; to?: string; begin?: string; dur?: string; }
export interface StyleAttrs extends CoreAttrs { type?: string; }
export interface ScriptAttrs extends CoreAttrs { type?: string; href?: string; }

// ─── Tag → Attrs Map ──────────────────────────────────────────────────────────

export interface SvgTagAttrs {
  svg: SvgAttrs;
  g: GAttrs;
  defs: DefsAttrs;
  symbol: SymbolAttrs;
  use: UseAttrs;
  switch: SwitchAttrs;
  rect: RectAttrs;
  circle: CircleAttrs;
  ellipse: EllipseAttrs;
  line: LineAttrs;
  polyline: PolylineAttrs;
  polygon: PolygonAttrs;
  path: PathAttrs;
  text: TextAttrs;
  tspan: TspanAttrs;
  textPath: TextPathAttrs;
  image: ImageAttrs;
  foreignObject: ForeignObjectAttrs;
  linearGradient: LinearGradientAttrs;
  radialGradient: RadialGradientAttrs;
  stop: StopAttrs;
  pattern: PatternAttrs;
  filter: FilterAttrs;
  feBlend: FeBlendAttrs;
  feColorMatrix: FeColorMatrixAttrs;
  feComposite: FeCompositeAttrs;
  feFlood: FeFloodAttrs;
  feGaussianBlur: FeGaussianBlurAttrs;
  feMerge: FeMergeAttrs;
  feMergeNode: FeMergeNodeAttrs;
  feOffset: FeOffsetAttrs;
  feTurbulence: FeTurbulenceAttrs;
  feDisplacementMap: FeDisplacementMapAttrs;
  feMorphology: FeMorphologyAttrs;
  feDropShadow: FeDropShadowAttrs;
  clipPath: ClipPathAttrs;
  mask: MaskAttrs;
  animate: AnimateAttrs;
  animateTransform: AnimateTransformAttrs;
  animateMotion: AnimateMotionAttrs;
  mpath: MpathAttrs;
  set: SetAttrs;
  marker: MarkerAttrs;
  a: AAttrs;
  title: TitleAttrs;
  desc: DescAttrs;
  metadata: MetadataAttrs;
  style: StyleAttrs;
  script: ScriptAttrs;
}

// ─── Typed Element Constructor ────────────────────────────────────────────────

/**
 * Create a typed SVG element. Tag name and attributes are validated at compile time.
 *
 * svgEl('rect', { x: 10, y: 10, width: 80, height: 40 })
 * svgEl('text', { x: 50, y: 25, 'text-anchor': 'middle' }, 'Hello')
 * svgEl('line', { x1: 0, y1: 0, x2: 100, y2: 0, 'marker-end': 'url(#arrow)' })
 *
 * Type error — x1 does not exist on RectAttrs:
 * svgEl('rect', { x1: 0, width: 10, height: 10 })
 */
export function svgEl<T extends SvgTag>(
  tag: T,
  attrs: SvgTagAttrs[T],
  ...children: Child[]
): XmlEl {
  return xmlEl(tag, attrs as Attrs, ...children);
}

/**
 * Convenience: typed SVG root element.
 * svgRoot(200, 100, ...children)
 */
export function svgRoot(width: number, height: number, attrs: SvgAttrs = {}, ...children: Child[]): XmlEl {
  return svgEl('svg', { width, height, xmlns: SVG_NS, ...attrs }, ...children);
}
