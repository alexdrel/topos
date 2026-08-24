import { GLYPHS, type GlyphSpec, Trait } from "../../../src/grammar.ts";
import { Dir } from "../../../src/geo.ts";
import glyphsHtml from "./glyphs.html?raw";

export interface GlyphPaneConfig {
  onInsert: (glyph: string) => void;
}

export function initGlyphPane(config: GlyphPaneConfig): void {
  const glyphSection = document.getElementById("glyph-section") as HTMLDivElement;
  if (glyphSection) {
    glyphSection.innerHTML = glyphsHtml;
  }

  const glyphPane = document.getElementById("glyph-pane") as HTMLDivElement;
  const glyphToggleBtn = document.getElementById("btn-glyph-toggle") as HTMLElement;

  let glyphExpanded = true;

  function populateGlyphs() {
    glyphPane.innerHTML = "";

    // We'll build a list of groups to render in order.
    const sections: { title?: string; chars: string[] }[] = [];

    const matchWeight = (s: GlyphSpec, w: string) => s.weight && Object.values(s.weight).some((v) => v === w);
    const isPureWeight = (s: GlyphSpec, w: string) => {
      const weights = Object.values(s.weight || {});
      return weights.length > 0 && weights.every((v) => v === w);
    };

    // 1. Single weight wires
    const single = Object.entries(GLYPHS)
      .filter(([_, s]) => (s.trait & Trait.Wire) && s.family !== "ascii" && isPureWeight(s, "single") && s.corner !== "rounded")
      .map(([c]) => c);
    if (single.length > 0) sections.push({ title: "Single", chars: single });

    // 2. Rounded corners
    const rounded = Object.entries(GLYPHS)
      .filter(([_, s]) => (s.trait & Trait.Wire) && s.family !== "ascii" && s.corner === "rounded")
      .map(([c]) => c);
    if (rounded.length > 0) sections.push({ title: "Rounded Corners", chars: rounded });

    // 3. Other wire weights
    const otherWeights = ["bold", "double", "dashed", "dotted"];
    for (const w of otherWeights) {
      // Bold and Double now include mixed-weight junctions implicitly via the spec's weight record
      const chars = Object.entries(GLYPHS)
        .filter(([_, s]) => (s.trait & Trait.Wire) && s.family !== "ascii" && matchWeight(s, w) && s.corner !== "rounded")
        .map(([c]) => c);
      if (chars.length > 0) {
        sections.push({ title: w, chars });
      }
    }

    // 4. Arrows (separate row per direction, single visible header)
    const arrowOrder: Dir[] = [Dir.W, Dir.E, Dir.S, Dir.N];
    const arrowRows = arrowOrder
      .map((mask) =>
        Object.entries(GLYPHS)
          .filter(([_, s]) => (s.trait & Trait.Arrow) && (s.mask === mask))
          .map(([c]) => c)
      )
      .filter((chars) => chars.length > 0);
    arrowRows.forEach((chars, index) => {
      sections.push({ title: index === 0 ? "Arrows" : "", chars });
    });

    // 5. Hubs
    const hubs = Object.entries(GLYPHS)
      .filter(([_, s]) => (s.trait & Trait.Hub))
      .map(([char]) => char);
    if (hubs.length > 0) sections.push({ title: "Hubs", chars: hubs });

    // 6. Misc (Clean up remaining symbols)
    const claimed = new Set(sections.flatMap((s) => s.chars));
    const misc = Object.entries(GLYPHS)
      .filter(([c, s]) => !claimed.has(c) && c !== " " && c !== "@@" && s.family !== "ascii" && !(s.trait & Trait.Brace))
      .map(([c]) => c);
    if (misc.length > 0) sections.push({ title: "Misc", chars: misc });

    for (const section of sections) {
      if (section.title) {
        const title = document.createElement("div");
        title.className = "field-label glyph-group-title";
        title.textContent = section.title;
        glyphPane.appendChild(title);
      }

      const grid = document.createElement("div");
      grid.className = "glyph-grid";

      for (const char of section.chars) {
        const item = document.createElement("div");
        item.className = "glyph-item";
        item.textContent = char;
        item.title = `Insert ${char}`;
        item.addEventListener("click", () => config.onInsert(char));
        grid.appendChild(item);
      }
      glyphPane.appendChild(grid);
    }
  }

  glyphToggleBtn.addEventListener("click", () => {
    glyphExpanded = !glyphExpanded;
    glyphSection.classList.toggle("collapsed", !glyphExpanded);
    glyphToggleBtn.setAttribute("aria-expanded", String(glyphExpanded));
    const chevron = document.getElementById("glyph-chevron");
    if (chevron) chevron.textContent = glyphExpanded ? "▾" : "▸";
    globalThis.dispatchEvent(new Event("resize"));
  });

  populateGlyphs();
}
