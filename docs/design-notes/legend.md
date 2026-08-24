# Legend & Eidos Guide

Topos separates structure from presentation. While the `:map` section defines coordinates, boxes, actors, and connections (the physical layout), the `:legend` section gives **semantic meaning** and **visual style** (called **Eidos**) to the diagram.

This guide describes the `:legend` syntax, how rules are resolved, and the vocabulary of visual Eidos axes and values.

---

## 1. Pipeline

1. **Trace:** Agents (ants and mice) navigate the text grid to find entity boundaries and connections.
2. **Refine:** The engine constructs the structural `MapNode` tree, resolves physical `MapEdge`s, and promotes and lays out regions.
3. **Ink:** The raw, monochrome, structural source is emitted (invertible ASCII text).
4. **Annotate:** The `:legend` rules are applied (`#id`, `@type`, `.class`, etc.), injecting semantic meaning and abstract relationships.
5. **Enamel:** The final annotated AST is rendered by Enamel into styled SVG presentation, using embedded CSS, markers, patterns, and filters defined in the compendium.

---

## 2. Syntax

The `:legend` block contains selector rules and comments:

```topos
Selector : EidosAssignment                  // Unary rule
Selector Relation Selector : EidosAssignment  // Relation rule
Selector, Selector : EidosAssignment          // Selector list (alternatives)
// Comments start with double slash
```

Whitespace around `=` is optional in header parameters and Legend assignments, for example `bg = #EEE` and `label = solid, red`.

### 2.1 Renderer Parameters

Renderer parameters work on `:map` and `:legend` headers, Markdown `topos` fences, and URL fragments of local `.topos` images in VS Code Markdown Preview.

| Parameter      | Value                                 | Effect                                                                                                             |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `theme`        | `light`, `dark`                       | Supplies default paper and ink colors.                                                                             |
| `bg`           | color, `light`, `dark`, `transparent` | Sets the SVG background. A concrete background also supplies `paper` when omitted.                                 |
| `paper`        | color                                 | Sets the canvas color.                                                                                             |
| `ink`          | color                                 | Sets the default foreground color.                                                                                 |
| `font`         | CSS font family                       | Sets the diagram font. Quote values containing spaces.                                                             |
| `font-weight`  | CSS font weight                       | Sets the default text weight.                                                                                      |
| `w`, `h`       | positive map cells                    | Fix the viewport from its left/top origin, cropping or extending the right/bottom limits.                          |
| `padx`, `pady` | non-negative map cells                | Frame content with explicit padding instead of preserving authored outer whitespace and default canvas padding.    |
| `scale`        | positive multiplier                   | Multiplies intrinsic output dimensions without changing the viewBox or geometry.                                   |
| `width`        | positive pixels                       | Sets exact intrinsic width while preserving aspect ratio; takes precedence over `scale` in the same parameter set. |
| `animation`    | `false`                               | Disables all animation without changing authored Eidos.                                                            |
| `compendium`   | `true`                                | Includes the complete asset registry instead of only used definitions.                                             |

```topos
:map theme=dark w=60
┌───┐
│ A │
└───┘
:legend scale=2 padx=1
```

The `:legend` header overrides matching parameters from `:map`. Fence, host, and export parameters are external; their host chooses whether authored or external values have priority. In the export UI, **Diagram** preserves authored values and **Export** gives customization priority. `scale` and `width` form one size axis, so the higher-priority one replaces the lower-priority one.

### Examples:

```topos
API : blue strong
Database : fill=blue,soft stroke=blue,strong
[API] -> [DB] : red dashed
Service : .critical
.critical : red strong
```

---

## 3. Selectors

### 3.1 Labels and IDs

An entity can have both a display label and an optional explicit ID:

- Bare and bracketed selectors match labels: `Database`, `[Mission Control]`.
- A `#id` selector matches an explicit ID sigil: `#mc` matches `[ Mission Control #mc ]`.

Adding an explicit ID does not stop the label from being selectable. Both `[Mission Control]` and `#mc` can target `[ Mission Control #mc ]`.

> [!NOTE]
> The `#id` sigil is rarely needed. It is primarily useful as a **short alias** for entities with long labels, allowing concise legend rules: `#mc -> #mo : red dashed` instead of `[Mission Control] -> [Mars Orbiter] : red dashed`.

### 3.2 Leaf Selectors

| Form                | Meaning                                               |
| ------------------- | ----------------------------------------------------- |
| `*`                 | Any entity or edge endpoint, including an unbound one |
| `_`                 | An unbound edge endpoint (no resolved node)           |
| `/`                 | Root diagram                                          |
| `Database`          | Entity with label `Database`                          |
| `#mc`               | Entity with id `mc` (explicit `#id` sigil)            |
| `.class`            | Class membership                                      |
| `[Mission Control]` | Box with label `Mission Control`                      |
| `[*]`               | Any box-like entity                                   |
| `(*)`               | Any note-like entity                                  |
| `<*>`               | Any hub-like entity                                   |
| `<◆>`               | Hub entity matching glyph `◆`                         |
| `<diamond>`         | Hub entity matching marker name `diamond`             |
| `{*}`               | Any region-like entity                                |
| `%para%`            | Entity whose label contains "para" (substring match)  |
| `API%`              | Entity whose label starts with "API" (prefix match)   |

> [!NOTE]
> Bracket syntax constrains the target node type (`[...]` for box, `(...)` for note, `<...>` for hub, `{...}` for region). Inside hub angle brackets `<...>`, hubs can be targeted by wildcard (`<*>`), literal hub glyph (e.g. `<◆>`), hub marker name (e.g. `<diamond>`), or label.

### 3.3 Compound Selectors (Binary Operators)

All relations are binary: `left OP right`.

The parsing precedence determines how selectors are grouped. Operators bind in the following order (from loosest to tightest):

1. **Abstract edge operators** (bind loosest): These operators create new abstract edges between matching nodes when no physical edge exists in the map section.

   | Op    | Action                           |
   | ----- | -------------------------------- |
   | `~>`  | Abstract directed edge (uni)     |
   | `<~`  | Abstract reverse directed (uni)  |
   | `~~`  | Abstract undirected edge (none)  |
   | `<~>` | Abstract bidirectional edge (bi) |

2. **Unary parent operator** (`^`)

3. **Tree operators** (bind next):

   | Op   | Meaning        |
   | ---- | -------------- |
   | `>`  | Direct child   |
   | `>>` | Any descendant |

4. **Edge matching operators** (bind tightest): These style existing physical edges defined on the map.

   | Op    | Matches                           |
   | ----- | --------------------------------- |
   | `->`  | Directed edge (uni)               |
   | `<-`  | Reverse directed edge (uni)       |
   | `--`  | Undirected edge (none)            |
   | `<->` | Bidirectional edge (bi)           |
   | `-`   | Any edge, regardless of direction |

`A - B` ignores both edge direction and endpoint order: it matches `A -> B`, `A -- B`, `A <-> B`, and the same edge written as `B - A`.

Composition rules:

- `^%para% ~> ^%wraps%` parses as `(^%para%) ~> (^%wraps%)` because `~>` binds looser than `^`.
- `^[A] -> [B]` parses as `(^[A]) -> [B]` because `->` binds tighter than `^`.
- `X > Y -> Z` parses as `X > (Y -> Z)` — an edge from Y to Z inside parent X.

Bare dashes remain part of bare labels, so `A-B` is one label while `A - B` is an edge relation. A wildcard on either side makes the dash unambiguous, allowing the compact forms `*-B`, `A-*`, and `*-*`:

```topos
*-* : soft
*-B : blue
A-* : rounded
```

Multi-character operators already delimit themselves, so `*->*`, `*--*`, and `*<->*` follow the ordinary relation rules. Write `[A-B]` when the bracketed label form is clearer.

Use `_` when a rule must distinguish an unbound endpoint from `*`. In an edge relation, `*` matches both resolved and unbound endpoints; `_` matches only an unbound endpoint:

```topos
A -> _ : red   // directed edge from A with no resolved target
_ -- B : gray  // undirected edge with no resolved source
```

### 3.4 Unary Operators (Prefixes)

Unary operators prefix another selector to select nodes based on the map hierarchy. They bind tighter than synthesis operators (like `~>`), but looser than tree operators (like `>`) and edge matching operators (like `->`).

Stacking the caretaker operators walks up the tree level by level.

| Form         | Meaning                                               |
| ------------ | ----------------------------------------------------- |
| `^Selector`  | Selects the direct parent node of the matching entity |
| `^^Selector` | Selects the grandparent node (steps up two levels)    |

Example:

```topos
%long paragraph% : blue
^%long paragraph% : fill=red,soft   // Styles the parent box of the note
```

---

## 4. AST Shape

The Legend AST is structured in TypeScript as follows:

```typescript
type Selector = Leaf | Compound | Unary;

interface Leaf {
  kind: "any" | "unbound" | "root" | "class" | "id" | "label" | "substring" | "startswith";
  value?: string;
  bracket?: string; // "[]" | "()" | "<>" | "{}" — disambiguation hint
}

interface Compound {
  op: ">" | ">>" | "->" | "<-" | "--" | "<->" | "-" | "~>" | "<~" | "~~" | "<~>";
  left: Selector;
  right: Selector;
}

interface Unary {
  op: "^";
  right: Selector;
}
```

> [!NOTE]
> `#mc` parses as `kind: "id"` and resolves against the entity ID. Bare `Database` parses as `kind: "label"` and resolves against the entity label.

---

## 5. Annotations & Eidos

The right-hand side of a rule is parsed directly into an `Annotation` object, specifying semantic metadata, properties, and visual Eidos values.

```topos
@type .class                  // semantic type, class membership
"Display Label"               // display text override (does NOT change entity id)
red soft hatch                // typed eidos values
code                          // literal lines/spaces with a monospace default
fill=blue,solid               // scoped eidos values
stroke=red,strong label=purple
fill-color=#abc              // exact local paint, bypassing palette mixing
stroke-color=navy label-color="#123456"
left top                      // named text placement
label=purple,left,top         // equivalent scoped placement and styling
left=25% top=75%             // explicit text placement
#id                           // set id (rarely needed — prefer setting #id on the map)
key=value                     // extension property
```

> [!NOTE]
> A `"Display Label"` override changes only what the renderer draws. It does not change the map-derived label or explicit ID used by selectors.

### 5.1 Eidos Values vs. Classes

- **Classes (`.class`)**: Additive tag membership. They accumulate across all matching rules and do not conflict.
- **Eidos Values (`red`, `soft`, `hatch`)**: Built-in typed styling values. The vocabulary defines which axis each value belongs to. Values on the same axis conflict; the last value applied wins.

> [!NOTE]
> Any unrecognized token in legend rules (bare words or dot-prefixed) automatically falls back to being treated as a class. For example, `API : myclass .otherclass` maps both `myclass` and `otherclass` to target classes.

```topos
X: .critical red strong
.critical: fill=red,soft
```

Here, `.critical` groups and selects entities. `red`, `strong`, and `fill=red,soft` are resolved typed Eidos values.

### 5.2 Scopes

Scopes are namespaces that target specific visual channels. The supported scopes are:

| Scope    | Meaning                     |
| -------- | --------------------------- |
| `fill`   | Interior/background paint.  |
| `stroke` | Outline or line paint.      |
| `label`  | Text paint.                 |
| `head`   | Edge end terminus marker.   |
| `tail`   | Edge start terminus marker. |

A scoped assignment can contain multiple typed values:

```topos
X: red soft fill=blue,solid stroke=red,strong label=purple
```

This resolves conceptually into a nested structure:

```typescript
{
  eidos: {
    color: "red",
    intensity: "soft",
    fill: { color: "blue", intensity: "solid" },
    stroke: { color: "red", intensity: "strong" },
    label: { color: "purple" }
  }
}
```

### 5.3 Ordering and Conflicts

The only ordering rule is **last applicable annotation wins**. There is no CSS-like specificity calculation.

Ordering applies both across rules and within a single annotation line:

```topos
*: blue
X: red
Y: blue red
Z: fill=blue,red
```

`X`, `Y`, and `Z` all resolve to `red` on the color axis.

`reset` clears all Eidos accumulated by earlier matching rules before applying the Eidos values in its own rule:

```topos
[*]: blue soft fill=green,solid
API: reset red strong
```

This exempts `API` from the broad `[*]` styling. It keeps any accumulated classes, identity, display text, and custom properties; only its Eidos map, including scoped values such as `fill`, is cleared. The Eidos values following `reset` are then applied, and later matching rules continue to override normally.

### 5.4 Eidos Inventory

Every built-in Eidos value belongs to exactly one axis.

| Axis           | Values                                                                                                                                                                                                                       | Notes                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| color          | `ink`, `black`, `gray`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `white`                                                                                                                                        | Default paint color. Can be scoped to `fill`, `stroke`, or `label`.                              |
| intensity      | `tint`, `none`, `ghost`, `soft`, `strong`, `heavy`, `solid`                                                                                                                                                                  | Visual presence/opacity. Can be scoped.                                                          |
| pattern        | `no-pattern`, `hatch`, `backhatch`, `crosshatch`, `stripes`                                                                                                                                                                  | Active fill pattern. Scoped to `fill`.                                                           |
| effect         | `no-effect`, `xkcd`, `sketch`, `chalk`, `shadow`, `glow`, `neon`                                                                                                                                                             | SVG filter effect. Effects are exclusive.                                                        |
| weight         | `single`, `bold`, `double`, `dashed`, `dotted`                                                                                                                                                                               | Outline stroke weight or dash pattern.                                                           |
| edgeBody       | `standard-body`, `block`                                                                                                                                                                                                     | Standard stroke or filled block-arrow body.                                                      |
| edgeRoute      | `path`, `ray`, `taut`                                                                                                                                                                                                        | Edge path routing/interpretation.                                                                |
| attachment     | `no-gap`, `gap`, `s-gap`, `m-gap`, `l-gap`                                                                                                                                                                                   | Edge endpoint spacing. `gap` and `s-gap` are synonyms; values can be scoped to `head` or `tail`. |
| layering       | `flat`, `stack`                                                                                                                                                                                                              | Flat or stacked node presentation.                                                               |
| corner         | `sharp`, `tight`, `rounded`, `loose`, `pill`, `rhombus`, `bevel`, `skew`, `parallelogram`, `trapez`                                                                                                                          | Edge corner treatment or node outline geometry. `skew` and `parallelogram` are synonyms.         |
| animation      | `static`, `animate`, `animate-reverse`                                                                                                                                                                                       | Stationary, forward, or reverse animation.                                                       |
| particle       | `no-particle`, `spark`, `ping`, `chevron`, `packet`                                                                                                                                                                          | Optional path or perimeter particle.                                                             |
| marker         | `no-marker`, `end-cap`, `arrow`, `crowfoot`, `triangle`, `triangle-hollow`, `dart`, `dart-hollow`, `angle`, `double-arrow`, `dot`, `circle`, `diamond`, `square`, `square-hollow`, `circle-dot`, `diamond-hollow`, `hexagon` | Terminus and hub marker types.                                                                   |
| textHorizontal | `center`, `left`, `right`, `start`, `end`, `third`, `two-thirds`, `twothirds`, `1/3`, `2/3`, `quarter`, `three-quarters`, `1/4`, `3/4`                                                                                       | Horizontal text-block placement.                                                                 |
| textVertical   | `middle`, `top`, `bottom`, `ceiling`                                                                                                                                                                                         | Vertical text-block placement.                                                                   |
| textAlign      | `align-left`, `align-center`, `align-right`                                                                                                                                                                                  | Alignment of lines within a multi-line text block.                                               |
| noteMode       | `prose`, `text`, `code`                                                                                                                                                                                                      | Note parsing as formatted prose, literal text, or code.                                          |

Inline nodes derive a default corner geometry from their authored delimiters:

| Map text      | Default corner  |
| ------------- | --------------- |
| `[Service]`   | `sharp`         |
| `(Database)`  | `pill`          |
| `<Choice>`    | `rhombus`       |
| `{Transform}` | `parallelogram` |

An explicit Legend rule overrides that default. The polygon values are also available to ordinary boxes:

```topos
[Choice] : rhombus
[Process] : bevel
[Input] : trapez
[Transform] : skew
```

`rhombus` retains diamond ends and extends wide nodes through the middle. `bevel` clips each corner of the rectangular outline with a small diagonal. `skew` and `parallelogram` produce the same leaning outline. `trapez` produces an upright trapezoid. For ordinary boxes these values change the rendered outline only; edge attachment continues to use the rectangular box perimeter.

On edges, `bevel` replaces each right-angle corner with a small straight diagonal; `rhombus` makes the same cut larger. The other established edge values retain their existing meaning: `sharp` keeps the vertex, while `tight`, `rounded`, and `loose` curve it.

Fenced notes automatically use `code` mode. A legend rule can apply the same mode to an unfenced note such as a Markdown table:

```topos
%Form% : code
```

`noteMode` applies only to notes. Text mode disables inline Markdown interpretation while retaining normal spacing and font behavior. Code mode additionally preserves physical lines and spaces and uses a monospace font by default. Labels always use prose and continue to support inline Markdown. An explicit `font="..."` property still overrides the code default. Use `font-weight=400` (or another CSS weight) to override the diagram or an individual entity without colliding with the visual `weight` axis.

Prose labels and notes support inline Markdown links:

```topos
Read [the documentation](https://example.com/docs)
```

The linked text is emitted as a native SVG `<a>` element and remains visibly underlined. Text and code notes preserve the Markdown punctuation literally. Long destinations can move out of the spatial map into an exact ID rule:

```topos
Read [the documentation](#docs)

:legend
#docs: href="https://example.com/very/long/path"
```

For formatted-text references, the rule supplies only `href`; its other annotations do not apply to the segment. Multiple links can reuse the same reference. An unresolved reference renders as ordinary, non-clickable text. An ordinary entity rule can link its entire label without making the surrounding box or empty geometry clickable:

```topos
Database: href="https://example.com/database"
```

Explicit inline links inside that label retain their own destinations.

### 5.5 Document Palette

Palette declarations in the legend override built-in colors for the current document:

```topos
:legend
API: blue soft
Warning: fill=orange,solid

/blue: #0057b8
/orange: #ffd700
```

Palette values are preserved as CSS/SVG paint strings and participate in the normal intensity mixing. Unknown names are ignored, and a repeated name uses its last value. Declare each override on its own line.

For an exact local paint that bypasses palette mixing, use `fill-color`, `stroke-color`, or `label-color`.

### 5.6 Animation and Particles

Animation composes with edge weights, effects, block bodies, and particles:

```topos
[A] -> [B]: dashed animate
[A] -> [B]: packet animate
[A] -> [B]: block chevron animate
```

`animation-speed` accepts `slow`, `fast`, or a positive numeric multiplier. Every animation receives a deterministic identity-based start delay so separate entities do not move in lockstep. Bidirectional edges divide their particles between both directions.

| Property           | Meaning                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `particle-count`   | Exact number of particles. Takes precedence over density.                                                                  |
| `particle-density` | Number of particles per ten character-widths of rendered path.                                                             |
| `particle-scale`   | Positive multiplier applied to the compendium symbol's natural size.                                                       |
| `particle-phase`   | Percentage shift applied to the complete distribution around the path.                                                     |
| `particle-random`  | Enables random placement. Numeric seeds mix with entity identity; named seeds remain stable when the entity is translated. |
| `particle-balance` | Percentage (`0–100`) or ratio (`0–1`) sent in one direction on a bidirectional edge.                                       |

Without count or density, regular paths and node perimeters receive one particle. Block edges use an implicit density of five. Random placement tries up to three deterministic candidates per particle to avoid visual overlap; changing the seed selects another arrangement.

Static particles remain distributed along the path. `ping` retains its intrinsic pulse even when it does not travel.

### 5.7 Label Placement

Named placement uses ordinary Eidos values for every displayed text block. Values may be grouped in the `label` scope together with label styling:

```topos
API : left top
API : right bottom
API : center middle
[API] : left top
[API] : label=purple,center,middle
```

- **Named horizontal values:** `left`, `right`, `start`, `end`, `center`, `third`, `two-thirds`, `twothirds`, `1/3`, `2/3`, `quarter`, `three-quarters`, `1/4`, `3/4`.
- **Named vertical values:** `ceiling`, `top`, `middle`, `bottom`.

For exact placement, use properties that name both the coordinate and how the text is aligned to it:

```topos
Note : left=25% top=75%
Note : center=50% middle=50%
Note : right=75%
[API] : left=25% top=75%
[API] : center=50% middle=50%
```

`left=` and `top=` align the text block's left or top edge to the coordinate. `center=` and `middle=` center the block on the coordinate; `right=` aligns its right edge. Percentages are relative to the entity's placement geometry; plain numbers are offsets in map columns or rows. Use `map` to take an available coordinate from the text's authored position and bypass automatic alignment:

```topos
Note : left=map top=map
Note : center=map middle=map
Note : right=map
[API] : left=map top=map
```

For boxes, `map` refers to the authored label rather than the box rectangle. There are intentionally no `at=`, `x=`, or `y=` placement properties.

For multi-line text, horizontal placement and line alignment are independent. Notes are left-aligned by default; other labels are centered. Use the dedicated line-alignment values to override that default:

```topos
Note : center                         // center the block; keep its lines left-aligned
Note : center align-center            // center both the block and each line
Note : right label=red,align-right    // position right, color red, right-align lines
```

`align-left`, `align-center`, and `align-right` work at the top level or in the `label` scope. The scope is convenient grouping, not a different positioning language.

### 5.8 Semantic Shapes

A built-in semantic type replaces the ordinary rendered outline with a recognizable silhouette. It can be written inline in the map or assigned by a Legend rule:

```topos
┌────────────────┐  ┌────────────────┐
│Store @database │  │   Web Client   │
└────────────────┘  └────────────────┘

:legend
[Web Client]: @browser
```

| Type        | Rendered silhouette                                      |
| ----------- | -------------------------------------------------------- |
| `@database` | Cylindrical database.                                    |
| `@file`     | Page with a folded corner.                               |
| `@folder`   | Tabbed folder.                                           |
| `@cloud`    | Cloud outline; also usable for a region boundary.        |
| `@browser`  | Browser window with navigation controls and address bar. |
| `@windows`  | Windows-style application window.                        |
| `@mac`      | macOS-style application window.                          |
| `@ui`       | Generic application window.                              |
| `@ux`       | Application window with a pointer.                       |

The map rectangle establishes the shape's placement, but it is not a clipping boundary. Details such as a folder tab, file corner, database rim, window chrome, or cloud curve may extend beyond it. Leave some space when placing a semantic shape close to another entity.

Semantic shapes compose with other declarations, including colors, fills, effects, and stacks:

```topos
[Logs]: @file stack=3
[Clients]: @browser blue soft
```

---

## 6. Inline Map Sigils

Inline map sigils provide shortcut styling and identifiers directly in the structural map:

- `#id`: Adds an explicit ID selector target without disabling label matching. Rarely needed — useful as a short alias for long labels.
- `@type`: Sets the semantic type.
- `.class-or-eidos`: Specifies a class tag or inline style.
  - If the value matches a recognized **Eidos value** (e.g. `.red`, `.dashed`), it sets the Eidos axis.
  - If formatted with a valid scope and recognized value (e.g. `.fill-blue`, `.tail-triangle`), it sets the scoped Eidos axis.
  - Otherwise, it is added as a class tag (e.g. `.external`, `.fill-myclass`).

```topos
[API #api @service .external .red .fill-blue]
```

In this example:

- `#api` sets the entity's id to `api`. The label `API` remains a selector target; `#api` is an additional concise selector.
- `@service` sets `semanticType = "service"`
- `.external` is unrecognized and falls back to a CSS class tag.
- `.red` maps to eidos color `red`.
- `.fill-blue` maps to scoped fill color `blue`.

---

## 7. Regions

Regions are spatial groupings promoted automatically during diagram refinement. Region seeds are notes on the map that start with a double hash `##`:

```topos
## EARTH                                           ## MARS

   ┌──────┐                                           ┌──────┐
   │ TDRS │                                           │ Rover│
   └──────┘                                           └──────┘
```

The refined diagram automatically promotes these seeds to region nodes (`nodeType: "region"`), expands their boundaries to fill their respective logical swimlanes/quadrants, and reparents all visually enclosed elements as child nodes.

In the `:legend` block, you can target regions using curly brace selectors (`{...}`):

```topos
:legend
{EARTH} : blue                    // style the EARTH region node
{*} : stroke=none                 // style all regions
{EARTH} > * : soft                // style direct children of the EARTH region
```

Region nodes follow the same identity model as other entities — their `id` is their map label after stripping the `##` prefix and sigils.

---

## 8. Recommended Patterns

1. **Select by what you wrote on the map:**
   ```topos
   // Map has: [ Database ]  and  [ API ]
   Database : blue soft
   API : red strong
   ```
2. **Use `#id` only for long labels that need short aliases:**
   ```topos
   // Map has: [ Mission Control #mc ] ──▶ [ Mars Orbiter #mo ]
   #mc -> #mo : red dashed
   #mc : .ground
   ```
3. **Use classes for grouping and semantic meaning:**
   ```topos
   API : .external .critical
   .critical : red strong
   ```
4. **Use `"Display Label"` to override rendered text without changing identity:**
   ```topos
   DB : "PostgreSQL Database" blue
   // DB is still the selector — the display text is cosmetic
   ```
5. **Use scoped Eidos values for channel overrides:**
   ```topos
   API : red soft fill=blue,solid label=purple
   ```
6. **Avoid CSS-style selector names for values:**
   - `API : fill=strong` (correct scoped form)
   - `API : fill-strong` (incorrect form)
