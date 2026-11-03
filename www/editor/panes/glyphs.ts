import { GLYPHS, type GlyphSpec, Trait } from "../../../src/grammar.ts";
import { Dir } from "../../../src/geo.ts";
import template from "./glyphs.html.js";
import "../css/glyphs.css";
import { appendChild, type ParamNode } from "@alexdrel/pralinejs";
import { Panel } from "../panel.ts";

export class GlyphPane extends Panel {
  onInsert: (glyph: string) => void;

  constructor(onInsert: (glyph: string) => void) {
    const mount = document.getElementById("glyph-section")!;
    super(mount, mount, "side");
    this.onInsert = onInsert;
    this.materialize(template);
    this.populateGlyphs();
  }

  populateGlyphs() {
    // We'll build a list of groups to render in order.
    const sections: { title?: string; chars: string[] }[] = [];

    const matchWeight = (s: GlyphSpec, w: string) => s.weight && Object.values(s.weight).some((v) => v === w);
    const isPureWeight = (s: GlyphSpec, w: string) => {
      const weights = Object.values(s.weight || {});
      return weights.length > 0 && weights.every((v) => v === w);
    };

    // 1. Single weight wires
    const single = Object.entries(GLYPHS)
      .filter(([_, s]) => s.trait & Trait.Wire && s.family !== "ascii" && isPureWeight(s, "single") && s.corner !== "rounded")
      .map(([c]) => c);
    if (single.length > 0) sections.push({ title: "Single", chars: single });

    // 2. Rounded corners
    const rounded = Object.entries(GLYPHS)
      .filter(([_, s]) => s.trait & Trait.Wire && s.family !== "ascii" && s.corner === "rounded")
      .map(([c]) => c);
    if (rounded.length > 0) sections.push({ title: "Rounded Corners", chars: rounded });

    // 3. Other wire weights
    const otherWeights = ["bold", "double", "dashed", "dotted"];
    for (const w of otherWeights) {
      // Bold and Double now include mixed-weight junctions implicitly via the spec's weight record
      const chars = Object.entries(GLYPHS)
        .filter(([_, s]) => s.trait & Trait.Wire && s.family !== "ascii" && matchWeight(s, w) && s.corner !== "rounded")
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
          .filter(([_, s]) => s.trait & Trait.Arrow && s.mask === mask)
          .map(([c]) => c)
      )
      .filter((chars) => chars.length > 0);
    arrowRows.forEach((chars, index) => {
      sections.push({ title: index === 0 ? "Arrows" : "", chars });
    });

    // 5. Hubs
    const hubs = Object.entries(GLYPHS)
      .filter(([_, s]) => s.trait & Trait.Hub)
      .map(([char]) => char);
    if (hubs.length > 0) sections.push({ title: "Hubs", chars: hubs });

    // 6. Misc (Clean up remaining symbols)
    const claimed = new Set(sections.flatMap((s) => s.chars));
    const misc = Object.entries(GLYPHS)
      .filter(([c, s]) => !claimed.has(c) && c !== " " && c !== "@@" && s.family !== "ascii" && !(s.trait & Trait.Brace))
      .map(([c]) => c);
    if (misc.length > 0) sections.push({ title: "Misc", chars: misc });

    const content: ParamNode[] = [];
    for (const section of sections) {
      if (section.title) {
        content.push(["div", { class: "group-title" }, section.title]);
      }

      content.push([
        "div",
        { class: "grid" },
        ...section.chars.map((char) => ["div", { class: "item", title: `Insert ${char}`, onClick: () => this.onInsert(char) }, char] satisfies ParamNode),
      ]);
    }
    appendChild(this.content, content);
  }
}
