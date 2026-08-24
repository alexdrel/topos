# Topos SVG Classes Documentation

This document describes the CSS classes applied to Topos SVG presentation elements. The Enamel renderer separates structural containers, physical shapes, and typography to ensure predictable CSS inheritance and prevent style leakage.

## 1. Group Containers (`<g>`)

Every node and edge emitted by Topos is wrapped in an SVG group (`<g>`). These act as semantic and styling boundaries.

**Applied Classes:**

- `tp`: Foundation marker.
- `tp-node` or `tp-edge`: Functional role identifier.
- `tp-<nodeType>`: (e.g., `tp-box`, `tp-region`, `tp-note`, `tp-hub`).
- `tp-root`: Applied to the top-level diagram group.
- `tp-solid`, `tp-hollow`, `tp-transparent`: Structural classes applied to physical shape layers.
- _Pen Style Modifiers_: (e.g., `tp-rounded`, `tp-dashed`, `tp-bold`, `tp-double`). These live on the container so they can be contextually resolved by children.
- _Resolved Legend Visual Classes_: (e.g., `tp-color-red`, `tp-color-blue`, `tp-strong`). These are generated from typed Legend visual values; custom properties defined here (like `--tp-stroke`) cascade to all descendants.

---

## 2. Shapes & Presentation Elements (`.tpc-shape`)

The actual visual component geometry (e.g., `<rect>`, `<path>`, `<use>`, `<polygon>`) nested inside a group.

**Applied Classes:**

- `tp`: Foundation marker.
- `tpc-shape`: Primary category for physical geometry.
- `tp-solid`: Applied to the primary visible face of a node or its top-most stack layer.
- `tp-hollow`: Applied to background "shadow" layers in multi-stacked nodes.
- `tp-transparent`: Applied to the outer spacer layer of a `.tp-double` node geometry.

**Styling Strategy:** Shapes catch pen modifiers and generated visual classes.

- Example: `.tp-node.tp-rounded > .tpc-shape { rx: 6; ry: 6; }`

---

## 3. Labels & Typography (`.tpc-label`)

Text elements (`<text>`) residing alongside shapes within their respective layout container.

**Applied Classes:**

- `tp`: Foundation marker.
- `tpc-label`: Primary category for diagram text.

**Styling Strategy:** By default, standard effects like `sketch` or `shadow` apply to the parent group container, affecting both the shape and the label. Label-scoped visual values such as `label=purple,strong` are translated to generated label classes.

- Labels inherit colors through variables (like `--tp-label`).

---

## 4. Coloring & Palette

Enamel uses a CSS variable-driven coloring system that allows for global themes, per-node overrides, and fine-grained slot control.

### Base Palette

The core palette is defined at the SVG root:

- **Gray, Red, Orange, Yellow, Green, Blue, Purple**.

### Variables & Slots

Elements with the `.tp` class resolve their paint properties using the following variables:

- `--tp-stroke`: Controls the line color.
- `--tp-fill`: Controls the accent color used for the background tint.
- `--tp-label`: Controls the text and label color.
- `--tp-fill-mix`: Fill opacity (blended with `transparent`). Default `12%` for nodes and generated colors.
- `--tp-stroke-mix`: Stroke intensity (blended with `--tp-paper`). Default `100%` (nodes) / `80%` (colors).
- `--tp-label-mix`: Label intensity (blended with `--tp-paper`). Default `100%` (nodes) / `85%` (colors).

### Perceptual Blending (`color-mix`)

Enamel uses the following logic for physical fills, strokes, and labels:

```css
fill: color-mix(in oklch, var(--tp-fill) var(--tp-fill-mix), transparent);
stroke: color-mix(in oklch, var(--tp-stroke) var(--tp-stroke-mix), var(--tp-paper));
/* On text elements: */
fill: color-mix(in oklch, var(--tp-label) var(--tp-label-mix), var(--tp-paper));
```

- **OKLCH Color Space**: All blending happens in the OKLCH space, which is perceptually uniform. This ensures that a `red soft` node and a `blue soft` node have similar visual "weight" and legibility.
- **Why Paper?**: unlike fills (which blend with `transparent`), strokes and labels blend with `--tp-paper`. This prevents "washing out" and ensures contrast is maintained against the intended canvas color.
- **Paper Independence**: The same SVG will look correct on a dark theme or a light theme as long as `--tp-paper` is updated to match the environment.

1. **Generated Color Classes**: (e.g., `.tp-color-red`, `.tp-color-blue`)
   - Sets stroke, fill, and label to the same palette color.
   - Sets standard densities: fill (12%), stroke (80%), label (85%).

2. **Scoped Generated Classes**: (e.g., `.tp-stroke-red`, `.tp-fill-blue`, `.tp-label-purple`)
   - Allows independent coloring of lines, backgrounds, and text.

3. **Density Modifiers**:
   - `.tp-ghost`, `.tp-soft`, `.tp-strong`, `.tp-heavy`, `.tp-solid`.
   - These modify all three mix variables (fill, stroke, label) simultaneously using scales optimized for legibility.
   - Example (`.tp-soft`): Fill 8%, Stroke 45%, Label 50%.

4. **Granular Modifiers**:
   - `.tp-stroke-soft`, `.tp-label-ghost`, etc.
   - Allows independent control over specific slot intensities.

5. **Slot None**:
   - `.tp-fill-none` explicitly removes the background fill.
   - `.tp-stroke-none` explicitly removes the outline stroke.

### Legend Visuals

Legend visual syntax is resolved before Enamel renders. The renderer receives only final generated classes:

- `fill=blue,solid` -> `.tp-fill-blue .tp-fill-solid`
- `stroke=red,strong` -> `.tp-stroke-red .tp-stroke-strong`
- `label=purple,soft` -> `.tp-label-purple .tp-label-soft`
- `red soft hatch` -> `.tp-color-red .tp-soft .tp-hatch`

---

## 5. Filter & Symbol Resolution

The renderer automatically matches class combinations to the `compendium` assets:

- **Filters**: Resolved by finding the longest matching key in the Filter Registry. For example, the classes `tp-sketch` and `tp-chalk` will resolve to `url(#sketch-chalk)`.
- **Symbols**: Nodes with a `semanticType` (or hub glyphs) are rendered as `<use>` elements referencing symbols in the compendium (e.g., `#file`, `#database`).

---

## 6. Special Classes

- `legend`: Applied to abstract edges (edges with no physical polyline route) and their labels. Usually styled with low opacity and italics.
- `tp-double`: A semantic modifier that triggers concentric stacked geometry for nodes, allowing distinct fill/stroke application.
- `tp-grid-cell`: Semantic marker for cells within a decomposed grid. Triggers proportional boundary scaling.
- `tp-hatch`, `tp-backhatch`, `tp-crosshatch`, and `tp-stripes`: Semantic modifiers that apply SVG patterns from the compendium.

---

## 7. Development & Generation

The gallery and its Enamel definitions have separate editing surfaces:

- **Gallery**: Make layout and catalogue changes in `src/enamel/compendium/compendium.topos`, then regenerate everything with:
  ```bash
  deno task gen:compendium
  ```
- **Definitions**: Edit filters, patterns, markers, symbols, or styles inside `src/enamel/compendium/compendium.svg`, then preserve those edits with:
  ```bash
  deno task gen:defs
  ```

The extracted `<defs>` tree is stored structurally in `src/enamel/compendium/compendium.gen.json` and embedded by subsequent gallery compilations.

---

## 8. Special Styles

### Block Arrows (`.tp-block`)

The `.tp-block` class converts an edge stroke into a filled block-arrow polygon.

- **Geometry**: Instead of a stroke, Topos renders a filled `<polygon>` (7 points for unidirectional, 10 points for bidirectional).
- **Styling**: Block arrows inherit the same perceptual `color-mix` fill system as nodes and support patterns such as `hatch`.
- **Routing**: Block geometry follows straight, bent, rounded, ray, and taut edge paths.
- **Composition**: `block chevron` overlays repeated chevron particles. Block edges use an implicit particle density of five unless an explicit `particle-count` or `particle-density` is supplied.

### Ray and Taut Edge Routing (`.tp-ray`, `.tp-taut`)

The edge routing modes allow Enamel to simplify or bypass grid-based path geometry:

- **Ray Routing (`.tp-ray`)**: Draws a straight ray directly connecting the center points of the source and target nodes, ignoring any grid-routed paths. Ray routing is automatically applied to abstract edges (which have empty polylines).
- **Taut Routing (`.tp-taut`)**: Ignores intermediate bend/turn points of the physical edge, drawing a straight line directly between the start and end connections of the edge.

### Double Nodes (`.tp-double`)

The `.tp-double` class implements a "geometric stack" for nodes:

- **Outer Shape**: A standard stroke-only outline with `fill: none`.
- **Inner Shape**: A slightly contracted (3px) geometry that carries the primary fill or pattern.
- This creates a clean, visible gap between the two concentric lines, even when using hand-drawn filters like `.tp-chalk`.

### Grid Rendering & Proportional Scaling

Nodes marked as `tp-grid-cell` utilize a high-fidelity proportional scaling algorithm instead of standard character-to-pixel mapping.

- **Objective**: To eliminate visual "gutters" and double-borders where adjacent cells or parent boundaries overlap.
- **Geometric Mapping**: Cell boundaries are calculated by linearly mapping character-index coordinates (`0..parent.w-1`) to the parent's full pixel width.
- **Perimeter Snapping**: Outermost edges of a grid perfectly snap to the parent's container, ensuring a unified visual boundary.
- **Label Synchronization**: Label alignment is automatically synchronized to the calculated pixel-center of these scaled cells, maintaining perfect visual centering even in non-linear grid structures.

### Region Layouts (`tp-region`)

Regions render through the normal node geometry pipeline, which means they behave like regular containers for:

- fill / stroke / label styling
- local patterns
- filters
- label alignment

By default, `tp-region` uses quieter fill/stroke/label mix values than ordinary boxes so large partitions stay in the background.
