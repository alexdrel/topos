/// <reference lib="dom" />
// src-editor/dom.ts
// DOM mounting for JsonML elements.
// Extends jsonml.ts with a browser-only mount() + htmlEl() for programmatic DOM creation.
// Uses a WeakMap to store back-references from XmlEl to mounted DOM elements.

import { SVG_NS, type SvgTag, type SvgTagAttrs } from "../../src/jsonml/svg.ts";
import { type Attrs, CDATA_TAG, type Child, COMMENT_TAG, textContent, type XmlEl } from "../../src/jsonml/jsonml.ts";
import type { Loc } from "../../src/geo.ts";

// ─── HTML Tag Types ───────────────────────────────────────────────────────────

export type HtmlTag = "div" | "span" | "pre" | "svg" | "button" | "input" | "label" | "textarea" | "style";

interface SharedAttrs {
  id?: string;
  class?: string;
  style?: string;
  tabindex?: number;
  title?: string;
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
}

interface DivAttrs extends SharedAttrs {}
interface SpanAttrs extends SharedAttrs {}
interface PreAttrs extends SharedAttrs {
  spellcheck?: boolean;
}
interface SvgAttrs extends SharedAttrs {
  width?: number | string;
  height?: number | string;
  viewBox?: string;
}
interface ButtonAttrs extends SharedAttrs {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  "aria-pressed"?: "true" | "false";
}
interface InputAttrs extends SharedAttrs {
  type?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  spellcheck?: boolean;
  autocomplete?: string;
  maxlength?: number;
}
interface LabelAttrs extends SharedAttrs {
  for?: string;
}
interface TextareaAttrs extends SharedAttrs {
  rows?: number;
  cols?: number;
  spellcheck?: boolean;
  wrap?: string;
}
interface StyleAttrs extends SharedAttrs {
  type?: string;
}

export interface HtmlTagAttrs {
  div: DivAttrs;
  span: SpanAttrs;
  pre: PreAttrs;
  svg: SvgAttrs;
  button: ButtonAttrs;
  input: InputAttrs;
  label: LabelAttrs;
  textarea: TextareaAttrs;
  style: StyleAttrs;
}

// ─── Element Constructors ─────────────────────────────────────────────────────

/** Create a typed HTML XmlEl node (no namespace; mounted as regular HTML element). */
export function htmlEl<T extends HtmlTag>(
  tag: T,
  attrs: HtmlTagAttrs[T] = {} as HtmlTagAttrs[T],
  ...children: Child[]
): XmlEl {
  return [tag, attrs as Attrs, ...children];
}

/** Create a typed SVG XmlEl node (mounted into the SVG namespace). */
export function svgEl<T extends SvgTag>(
  tag: T,
  attrs: SvgTagAttrs[T],
  ...children: Child[]
): XmlEl {
  return [tag, attrs as Attrs, ...children];
}

// ─── DOM Mount ────────────────────────────────────────────────────────────────

// Tags that require the SVG namespace when created via createElementNS.
const SVG_TAG_SET = new Set<string>([
  "svg",
  "g",
  "defs",
  "symbol",
  "use",
  "switch",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
  "textPath",
  "image",
  "foreignObject",
  "linearGradient",
  "radialGradient",
  "stop",
  "pattern",
  "filter",
  "feBlend",
  "feColorMatrix",
  "feComposite",
  "feFlood",
  "feGaussianBlur",
  "feMerge",
  "feMergeNode",
  "feOffset",
  "feTurbulence",
  "feDisplacementMap",
  "feMorphology",
  "feDropShadow",
  "clipPath",
  "mask",
  "animate",
  "animateTransform",
  "animateMotion",
  "mpath",
  "set",
  "marker",
  "a",
  "title",
  "desc",
  "metadata",
]);

const mountedElements = new WeakMap<XmlEl, Element>();

/**
 * Mount a JsonML element into the DOM, recursively creating child elements.
 * Stores the created Element back into a WeakMap keyed by the XmlEl, retrievable via el().
 * Works for both HTML and SVG tags — namespace is inferred from the tag name.
 */
export function mount(node: XmlEl): Element {
  const [tag, attrs, ...children] = node;
  const ns = SVG_TAG_SET.has(tag) ? SVG_NS : undefined;
  const domEl = ns ? document.createElementNS(ns, tag) : document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== false && v !== null) {
      domEl.setAttribute(k, v === true ? k : String(v));
    }
  }

  for (const child of children) {
    if (typeof child === "string") {
      domEl.append(child);
    } else if (Array.isArray(child)) {
      const childEl = child as XmlEl;
      if (childEl[0] === COMMENT_TAG) domEl.append(document.createComment(textContent(childEl)));
      else if (childEl[0] === CDATA_TAG) domEl.append(textContent(childEl));
      else domEl.append(mount(childEl));
    }
  }

  mountedElements.set(node, domEl);
  return domEl;
}

/**
 * Retrieve the DOM Element that was created when mount(node) was called.
 * Throws if the node has not been mounted yet.
 * Cast to the concrete element type at the call site: el<HTMLPreElement>(node).
 */
export function el<E extends Element = Element>(node: XmlEl): E {
  const domEl = mountedElements.get(node);
  if (!domEl) throw new Error("XmlEl has not been mounted yet");
  return domEl as E;
}

export { SVG_NS };

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
}

export function isModKey(e: MouseEvent | KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

export function arrowDelta(key: string): Loc | null {
  switch (key) {
    case "ArrowLeft":
      return { x: -1, y: 0 };
    case "ArrowRight":
      return { x: 1, y: 0 };
    case "ArrowUp":
      return { x: 0, y: -1 };
    case "ArrowDown":
      return { x: 0, y: 1 };
    default:
      return null;
  }
}
