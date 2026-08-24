import type { XmlEl } from "./jsonml.ts";

/** Format JsonML as readable, diff-friendly JSON. */
export function stringifyJsonMl(node: XmlEl, indent = 0): string {
  const pad = "  ".repeat(indent);
  const [nodeTag, nodeAttrs, ...nodeChildren] = node;
  const head = `${pad}[${JSON.stringify(nodeTag)},${JSON.stringify(nodeAttrs)}`;
  if (nodeChildren.length === 0) return `${head}]`;
  if (nodeChildren.length === 1 && typeof nodeChildren[0] === "string") {
    return `${head},${JSON.stringify(nodeChildren[0])}]`;
  }

  const bodyParts: string[] = [];
  for (const child of nodeChildren) {
    if (typeof child === "string" && child.trim() === "" && bodyParts.length > 0) {
      bodyParts[bodyParts.length - 1] += `,${JSON.stringify(child)}`;
    } else if (typeof child === "string") {
      bodyParts.push(`${"  ".repeat(indent + 1)}${JSON.stringify(child)}`);
    } else {
      bodyParts.push(stringifyJsonMl(child, indent + 1));
    }
  }
  const body = bodyParts.join(",\n");
  return `${head},\n${body}\n${pad}]`;
}
