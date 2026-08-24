import type { Attrs, Child, XmlEl } from "./jsonml.ts";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const COMMENT_NODE = 8;

function textLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

function domChildToJsonMl(node: Node): Child | undefined {
  if (node.nodeType === ELEMENT_NODE) return domToJsonMl(node);
  if (node.nodeType === COMMENT_NODE) return ["$comment", {}, ...textLines(node.nodeValue ?? "")];
  if (node.nodeType === CDATA_SECTION_NODE) return ["$cdata", {}, ...textLines(node.nodeValue ?? "")];
  if (node.nodeType !== TEXT_NODE) return undefined;

  const text = node.nodeValue ?? "";
  if (text.trim()) return text;

  // Ignore structural indentation, but retain an authored blank separator.
  return (text.match(/\n/g)?.length ?? 0) > 1 ? "\n" : undefined;
}

/** Convert an XML DOM element subtree to JsonML without depending on a DOM implementation. */
export function domToJsonMl(node: Node): XmlEl {
  const attrs: Attrs = {};
  const attributes = node.nodeType === ELEMENT_NODE ? (node as Element).attributes : undefined;
  if (attributes) {
    for (let i = 0; i < attributes.length; i++) {
      const attribute = attributes.item(i);
      if (attribute) attrs[attribute.name] = attribute.value;
    }
  }

  const children: Child[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes.item(i);
    if (!child) continue;
    const converted = domChildToJsonMl(child);
    if (converted !== undefined) children.push(converted);
  }

  return [node.nodeName, attrs, ...children];
}
