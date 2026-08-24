// jsonml.ts
// Generic JsonML implementation for XML generation and testing.
// Convention: [tagName, attributes, ...children]
// Children can be nested XmlEl arrays or plain text strings.
// For SVG-specific typed wrappers, see svg.ts.

// ─── Types ────────────────────────────────────────────────────────────────────

export type Attrs = Record<string, string | number | boolean | undefined>;
export type Child = XmlEl | string;
export type XmlEl = [string, Attrs, ...Child[]];
export const COMMENT_TAG = "$comment";
export const CDATA_TAG = "$cdata";

// ─── Construction ─────────────────────────────────────────────────────────────

/**
 * Create a JsonML element.
 * xmlEl("g", { id: "boxes" }, xmlEl("rect", { x: 0 }))
 */
export function xmlEl(tag: string, attrs: Attrs = {}, ...children: Child[]): XmlEl {
  return [tag, attrs, ...children];
}

/** Create an XML comment node using the JsonML pseudo-tag convention. */
export function xmlComment(text: string): XmlEl {
  return [COMMENT_TAG, {}, text];
}

/** Create an XML CDATA section using the JsonML pseudo-tag convention. */
export function xmlCdata(text: string): XmlEl {
  return [CDATA_TAG, {}, text];
}

/**
 * Mutates an existing element by appending one or more children cleanly.
 * Useful for building tree structures hierarchically without array reallocation.
 */
export function appendChild(node: XmlEl, ...childrenToAdd: Child[]): void {
  node.push(...childrenToAdd);
}

/**
 * Mutates an existing element by merging additional attributes.
 * Useful for building tree structures hierarchically without array reallocation.
 */
export function addAttrs(node: XmlEl, extra: Attrs): void {
  Object.assign(node[1], extra);
}

// ─── Accessors ────────────────────────────────────────────────────────────────

export function tag(node: XmlEl): string {
  return node[0];
}
export function attrs(node: XmlEl): Attrs {
  return node[1];
}
export function textContent(node: XmlEl): string {
  return node.slice(2)
    .map((c) => {
      if (Array.isArray(c)) return textContent(c);
      return typeof c === "string" ? c : "";
    })
    .join("");
}
export function children(node: XmlEl): XmlEl[] {
  return node.slice(2).filter((c) => Array.isArray(c)) as XmlEl[];
}

/** Visit an element and all nested JsonML nodes in document order. */
export function walk(node: XmlEl, visit: (node: XmlEl) => void): void {
  visit(node);
  for (const child of children(node)) walk(child, visit);
}

/** Index every element with a string id attribute. */
export function indexById(node: XmlEl): Map<string, XmlEl> {
  const index = new Map<string, XmlEl>();
  walk(node, (candidate) => {
    const id = attrs(candidate).id;
    if (typeof id === "string") index.set(id, candidate);
  });
  return index;
}

// ─── Serialization ────────────────────────────────────────────────────────────

/**
 * Escape XML attribute data enclosed in double quotes.
 */
export function escapeAttr(v: string): string {
  return v
    .replace(/&/g, "&amp;") // must be first
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Escape XML character data. A plain `>` is valid; only the `]]>` sequence
 * must be broken because it would close a CDATA section.
 */
export function escapeText(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/]]>/g, "]]&gt;");
}

function serializeAttrs(attrs: Attrs): string {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
    .join(" ");
}

/**
 * Serialize a JsonML element as a fragment (no XML declaration).
 */
export function serialize(node: XmlEl, indent = 0): string {
  const [t, a, ...ch] = node;
  const pad = "  ".repeat(indent);

  if (t === COMMENT_TAG) {
    const commentText = textContent(node).replace(/--/g, "- -").replace(/-$/, "- ");
    return `${pad}<!--${commentText}-->`;
  }

  if (t === CDATA_TAG) {
    const cdataText = textContent(node).replace(/]]>/g, "]]]]><![CDATA[>");
    return `${pad}<![CDATA[${cdataText}]]>`;
  }

  const attrStr = serializeAttrs(a);
  const open = attrStr ? `<${t} ${attrStr}>` : `<${t}>`;

  if (ch.length === 0) {
    return `${pad}${open.replace(/>$/, "/>")}`;
  }
  // Inline single text child
  if (ch.length === 1 && typeof ch[0] === "string") {
    return `${pad}${open}${escapeText(ch[0])}</${t}>`;
  }

  // Mixed text and element content is whitespace-sensitive. Keep it inline so
  // pretty-print indentation does not alter phrases split by nested elements.
  if (ch.some((child) => typeof child === "string" && child.trim() !== "")) {
    const inlineBody = ch.map((child) => {
      if (typeof child === "string") return escapeText(child);
      return serialize(child as XmlEl, 0);
    }).join("");
    return `${pad}${open}${inlineBody}</${t}>`;
  }

  const body = ch
    .map((c) => {
      if (typeof c === "string") return c.trim() ? "  ".repeat(indent + 1) + escapeText(c) : "";
      return serialize(c as XmlEl, indent + 1);
    })
    .join("\n");

  return `${pad}${open}\n${body}\n${pad}</${t}>`;
}

/**
 * Serialize a JsonML element as a full XML document with declaration.
 */
export function serializeXml(node: XmlEl, declaration = true): string {
  const xml = serialize(node, 0);
  return declaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' + xml : xml;
}
