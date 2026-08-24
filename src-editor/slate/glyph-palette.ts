import { Dir, type Loc } from "../../src/geo.ts";
import { GLYPHS, type GlyphSpec, TEXT_CONTROL_GLYPHS, Trait } from "../../src/grammar.ts";
import type { PenWeight } from "../../src/style.ts";
import type { XmlEl } from "../../src/jsonml/jsonml.ts";
import { htmlEl, mount } from "./dom.ts";
import { type PopupPosition, positionPopup } from "./popup.ts";
import type { Slate } from "./slate.ts";

export interface GlyphOption {
  display: string;
  value: string;
  title?: string;
}

export interface GlyphGroup {
  name: string;
  icon: string;
  options: GlyphOption[];
}

function options(entries: [string, GlyphSpec][]): GlyphOption[] {
  return entries.map(([char]) => ({ display: char, value: char }));
}

function getGlyphGroups(): GlyphGroup[] {
  const entries = Object.entries(GLYPHS).filter(([char]) => char !== "");
  const wires = entries.filter(([, s]) => (s.trait & Trait.Wire) && s.family !== "ascii");
  const matching = (source: [string, GlyphSpec][], predicate: (spec: GlyphSpec) => boolean) => options(source.filter(([, spec]) => predicate(spec)));
  const uniform = (weight: PenWeight) => matching(wires, (spec) => spec.uniWeight === weight);
  const mixed = (weight: PenWeight) => matching(wires, (spec) => !spec.uniWeight && Object.values(spec.weight ?? {}).includes(weight));
  const arrows = (mask: Dir) => matching(entries, (spec) => (spec.trait & Trait.Arrow) !== 0 && spec.mask === mask);
  const textControlTitles: Record<(typeof TEXT_CONTROL_GLYPHS)[number], string> = {
    "⏎": "Line break",
    "↵": "Line break",
    "¶": "Paragraph",
    "␠": "Em space",
    "⍽": "Non-breaking space",
  };
  const groups: GlyphGroup[] = [
    {
      name: "Text",
      icon: "¶",
      options: [
        { display: "␣", value: " ", title: "Space" },
        ...TEXT_CONTROL_GLYPHS.map((glyph) => ({ display: glyph, value: glyph, title: textControlTitles[glyph] })),
        { display: "•", value: "•", title: "Bullet" },
        { display: "✓", value: "✓", title: "Check" },
        { display: "✗", value: "✗", title: "Cross" },
        { display: "…", value: "…", title: "Ellipsis" },
      ],
    },
    { name: "Thin", icon: "┌", options: uniform("single") },
    { name: "Bold", icon: "━", options: uniform("bold") },
    { name: "Double", icon: "═", options: uniform("double") },
    { name: "Pattern", icon: "┄", options: matching(wires, (spec) => spec.uniWeight === "dashed" || spec.uniWeight === "dotted") },
    { name: "Bold Mix", icon: "┿", options: mixed("bold") },
    { name: "Double Mix", icon: "╫", options: mixed("double") },
    { name: "Right Arrows", icon: "→", options: arrows(Dir.W) },
    { name: "Left Arrows", icon: "←", options: arrows(Dir.E) },
    { name: "Down Arrows", icon: "↓", options: arrows(Dir.N) },
    { name: "Up Arrows", icon: "↑", options: arrows(Dir.S) },
    { name: "Hubs", icon: "◆", options: matching(entries, (spec) => (spec.trait & Trait.Hub) !== 0) },
  ];
  return groups.filter((group) => group.options.length > 0);
}

export class GlyphPalette {
  public static readonly groups = getGlyphGroups();
  private readonly element: HTMLElement;
  private readonly glyphs: HTMLElement;
  private readonly title: HTMLElement;

  constructor(editor: Slate, location: { anchor: Loc } | { position: PopupPosition }, onPick: (glyph: string) => void) {
    const navButtons = GlyphPalette.groups.map((group, index) => this.button(group.icon, group.name, { class: "slate-glyph-group-btn", "data-group": index }));
    this.element = mount(htmlEl(
      "div",
      { class: "quick-inspector slate-glyph-palette" },
      htmlEl("div", { class: "slate-glyph-title" }),
      htmlEl("div", { class: "qi-group slate-glyph-groups" }, ...navButtons),
      htmlEl("div", { class: "qi-group slate-glyph-grid" }),
    )) as HTMLElement;
    this.title = this.element.querySelector(".slate-glyph-title")!;
    this.glyphs = this.element.querySelector(".slate-glyph-grid")!;

    this.element.addEventListener("mousedown", (event) => event.stopPropagation());
    this.element.addEventListener("click", (event) => {
      event.stopPropagation();
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (button?.dataset.group !== undefined) this.showGroup(GlyphPalette.groups[Number(button.dataset.group)]);
      else if (button?.dataset.glyph !== undefined) onPick(button.dataset.glyph);
    });
    editor.surface.appendViewportElement(this.element);
    this.showGroup(GlyphPalette.groups[0]);
    const reservedHeight = this.element.offsetHeight + editor.metrics.charHeight + 4;
    if ("position" in location) {
      const visible = editor.surface.viewportRect();
      this.element.style.left = `${location.position.left}px`;
      this.element.style.top = `${Math.max(visible.y + 8, Math.min(location.position.top, visible.y + visible.h - reservedHeight - 8))}px`;
    } else {
      positionPopup(editor, this.element, location.anchor, {
        placement: "top-left",
        reservedHeight,
      });
    }
  }

  private showGroup(group: GlyphGroup): void {
    this.title.textContent = group.name;
    this.element.querySelectorAll<HTMLButtonElement>("[data-group]").forEach((button, index) => {
      button.classList.toggle("active", GlyphPalette.groups[index] === group);
    });
    this.glyphs.replaceChildren(
      ...group.options.map((option) => mount(this.button(option.display, option.title ?? `Insert ${option.display}`, { "data-glyph": option.value }))),
    );
  }

  private button(text: string, title: string, attrs: { class?: string; "data-group"?: number; "data-glyph"?: string } = {}): XmlEl {
    const { class: extraClass, ...data } = attrs;
    return htmlEl("button", { type: "button", class: `qi-btn${extraClass ? ` ${extraClass}` : ""}`, title, ...data }, text);
  }

  dispose(): void {
    this.element.remove();
  }
}
