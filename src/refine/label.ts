import { MapNode } from "./types.ts";
import { isSigilOnly, stripSigils } from "../sigil.ts";
import { removeNode } from "./refine.ts";

/** Cleans note prose text, preserving leading indentation but trimming the end. */
export function labelFromText(text: string): string {
  let cleaned = text;
  if (/[⏎↵¶]/.test(cleaned)) {
    cleaned = cleaned.replace(/\s*\n\s*/g, " ")
      .replace(/\s*¶\s*/g, "\n")
      .replace(/\s*[⏎↵]\s*/g, "\n");
  }
  cleaned = stripSigils(cleaned)!;
  return cleaned.trim().replaceAll("␠", " ").replaceAll("⍽", " ");
}

/** Cleans and joins label segments for box, hub, and edge labels, always trimming. */
export function extractLabel(labels?: { text: string }[]): string | undefined {
  if (!labels) return undefined;
  const nonSigils = labels.filter((s) => !isSigilOnly(s.text));
  if (nonSigils.length === 0) return undefined;

  return nonSigils.map((s) => labelFromText(s.text)).join(" ");
}

export function promoteLabels(node: MapNode, allNodes: MapNode[]): void {
  // Recurse first (bottom-up) so inner rawLabels are promoted before parents
  for (const child of node.children) promoteLabels(child, allNodes);

  // Early exit if not a container
  const isContainer = node.nodeType === "box" || node.nodeType === "root";
  if (!isContainer) return;

  function promoteNotes(node: MapNode, sigilNotes: MapNode[], before = false): void {
    for (const child of sigilNotes) {
      const label = {
        x: child.x,
        y: child.y,
        w: child.w,
        h: child.h,
        text: child.rawLabels?.[0]?.text || child.label!,
      };
      const labels = node.rawLabels ??= [];
      if (before) labels.unshift(label);
      else labels.push(label);
    }
    for (const s of sigilNotes) removeNode(s, node, allNodes);
    node.label = extractLabel(node.rawLabels);
  }

  const sigilNotes = node.children.filter((c) => c.nodeType === "note" && (c.header == 1 || isSigilOnly(c.text!)));
  promoteNotes(node, sigilNotes);

  // Root label must be explicit with #
  if (node.label || node.nodeType === "root") return;

  // Collect note candidates
  const notes = node.children.filter((c) => c.nodeType === "note");
  if (notes.length !== 1) return;
  const first = notes[0];

  // Single line (no newlines after possible reflow) with no links is a candidate for promotion
  if (first.label?.includes("\n") || first.links.length) return;

  // For boxes only - if there is only a single 'note' left and it's above all other nodes - promote.
  const othersY = node.children.filter((c) => c !== first && c.nodeType !== "hub").map((c) => c.y);
  const minOtherY = Math.min(...othersY);

  if (first.y < minOtherY) {
    promoteNotes(node, [first], true);
  }
}
