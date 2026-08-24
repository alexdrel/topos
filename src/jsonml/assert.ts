import { assertEquals, assertObjectMatch } from "@std/assert";
import { Attrs, attrs, children, tag, textContent, XmlEl } from "./jsonml.ts";

// ─── Query / Test Helpers ─────────────────────────────────────────────────────

export function attrsMatch(node: XmlEl, match: Attrs): boolean {
  const actualAttrs = attrs(node);
  const { class: expectedClass, ...restExpected } = match;

  // 1. Strict match for all attributes except 'class', '$children', '$text'
  for (const [k, v] of Object.entries(restExpected)) {
    if (k.startsWith("$")) continue; // Skip internal match patterns
    if (actualAttrs[k] !== v) return false;
  }

  // 2. Subset match for 'class' (space-separated tokens)
  if (expectedClass !== undefined) {
    const actualClass = actualAttrs.class;
    if (typeof actualClass !== "string") return false;
    const actualSet = new Set(actualClass.split(/\s+/).filter(Boolean));
    const expectedSet = String(expectedClass).split(/\s+/).filter(Boolean);
    for (const cls of expectedSet) {
      if (!actualSet.has(cls)) return false;
    }
  }

  return true;
}

/**
 * Find the first element matching tag and optional attributes.
 * maxDepth=0 only checks the node itself.
 * maxDepth=Infinity (default) searches everywhere.
 */
export function findEl(
  node: XmlEl,
  matchTag: string,
  matchAttrs?: Attrs,
  maxDepth = Number.POSITIVE_INFINITY,
): XmlEl | undefined {
  if (tag(node) === matchTag && (!matchAttrs || attrsMatch(node, matchAttrs))) return node;
  if (maxDepth <= 0) return undefined;
  for (const child of children(node)) {
    const found = findEl(child, matchTag, matchAttrs, maxDepth - 1);
    if (found) return found;
  }
}

export type MatchPattern = Attrs & {
  $children?: number;
  $text?: string;
};

/**
 * Asserts that a given element matches the specified tag and (optionally) attributes.
 * The 'class' attribute is matched as a subset (all expected classes must be present).
 */
export function assertElMatch(node: XmlEl, matchTag: string, matchAttrs?: MatchPattern): void {
  const actualTag = tag(node);
  if (actualTag !== matchTag) {
    throw new Error(`assertElMatch: expected <${matchTag}>, got <${actualTag}>`);
  }
  if (matchAttrs) {
    const { $children, $text, class: expectedClass, ...restExpected } = matchAttrs;
    const actualAttrs = attrs(node);

    // 1. Partial/Subset match for classes
    if (expectedClass !== undefined) {
      const actualClass = actualAttrs.class;
      if (typeof actualClass !== "string") {
        throw new Error(`assertElMatch: expected classes "${expectedClass}", but element has no class attribute`);
      }
      const actualSet = new Set(actualClass.split(/\s+/).filter(Boolean));
      const expectedSet = String(expectedClass).split(/\s+/).filter(Boolean);
      for (const cls of expectedSet) {
        if (!actualSet.has(cls)) {
          throw new Error(`assertElMatch: expected class "${cls}" missing from "${actualClass}"`);
        }
      }
    }

    // 2. Strict match for other real attributes (excluding $ helpers and class)
    const realExpectedAttrs: Attrs = {};
    for (const [k, v] of Object.entries(restExpected)) {
      if (!k.startsWith("$")) realExpectedAttrs[k] = v;
    }
    assertObjectMatch(actualAttrs, realExpectedAttrs);

    if ($children !== undefined) {
      assertEquals(
        children(node).length,
        $children,
        `assertElMatch: expected ${$children} children, got ${children(node).length}`,
      );
    }
    if ($text !== undefined) {
      assertEquals(textContent(node), $text, `assertElMatch: expected text "${$text}", got "${textContent(node)}"`);
    }
  }
}

/**
 * Asserts structural matching of a child exactly like matchChild from test-utils.ts.
 */
export function matchChildEl(
  node: XmlEl,
  matchTag: string,
  matchAttrs: MatchPattern | null = null,
  ndx: number | null | ((child: XmlEl, i: number) => boolean) = null,
  expectedMatchCount: number | null = null,
): XmlEl {
  const nodeChildren = children(node);
  const matchedChildren = nodeChildren.filter((c) => {
    if (tag(c) !== matchTag) return false;
    if (matchAttrs) {
      return attrsMatch(c, matchAttrs);
    }
    return true;
  });

  if (expectedMatchCount !== null) {
    if (matchedChildren.length !== expectedMatchCount) {
      throw new Error(`matchChildEl: expected ${expectedMatchCount} matched children, got ${matchedChildren.length}`);
    }
  }

  let child: XmlEl | undefined;
  if (ndx === null) {
    if (matchedChildren.length !== 1) {
      throw new Error(`matchChildEl: expected 1 matched child, got ${matchedChildren.length}`);
    }
    child = matchedChildren[0];
  } else if (typeof ndx === "function") {
    const idx = matchedChildren.findIndex(ndx);
    if (idx === -1) {
      throw new Error(`matchChildEl: No child element matches the predicate`);
    }
    child = matchedChildren[idx];
  } else {
    if (matchedChildren.length <= ndx) {
      throw new Error(`matchChildEl: expected child index ${ndx}, got ${matchedChildren.length} matched children`);
    }
    child = matchedChildren[ndx];
  }

  assertElMatch(child, matchTag, matchAttrs || undefined);
  return child;
}
