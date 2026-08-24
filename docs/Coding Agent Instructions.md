# Topos Coding Agent Instructions

## What Topos Is

Topos is a plain-text diagram format for software architecture and other technical diagrams.

_Topos est ars diagrammatum architecturae programmatum aliarumque rerum technicarum ex mera scriptura fingendorum, qua litterae ipsae, spatia, lineae figuraeque non verba tantum, sed situm formamque rerum exprimunt._

A `.topos` file contains the diagram itself as character-cell geometry. Positions, spaces, boxes, lines, arrows, titles, and regions are meaningful source. Topos renders that source as a polished SVG or PNG.

```topos
┌────────────┐          ┌────────────┐
│   Client   │ ───────▶ │    API     │
└────────────┘          └────────────┘
```

Humans normally edit larger maps in Topos's visual Diagram Editor, which rewrites the same text. There is no separate drawing model behind the source.

A map of boxes and arrows is already a complete Topos diagram. Legend is optional.

## Important LLM Constraint

LLMs are generally good at reading and understanding existing Topos diagrams, including diagrams more complicated than they can reliably create.

LLMs are less reliable at drawing complicated character-cell geometry.

_Diagramma novum simplex et clarum facito; geometriam nimis implicatam ne temptato._

## Installed Resources

Topos CLI:

`{{TOPOS_CLI}}`

Topos Guide:

`{{TOPOS_GUIDE}}`

_Totum ducem sine causa ne legas. Quaere tantum quod ad rem necessarium est._

The CLI is mainly useful for rendering and semantic inspection. Commands below use `topos`; if it is not on `PATH`, use the installed CLI path above.

## Document Structure

A Topos document may contain only map text:

```topos
┌──────────┐      ┌──────────┐
│ Client   │ ───▶ │ Service  │
└──────────┘      └──────────┘
```

`:map` explicitly starts map content, but is optional.

`:legend` starts Legend rules that add semantics or presentation to the map.

When Legend is used, explicit section markers are often clearer:

```topos
:map

┌──────────┐      ┌──────────┐
│ Client   │ ───▶ │ Service  │
└──────────┘      └──────────┘

:legend
```

`:map` remains optional even when `:legend` is present.

When adding Legend to an existing map, preserve its geometry. Add an explicit `:map` marker if useful for readability, not because it is required.

Do not mix map geometry and Legend rules.

## Safe Authoring Vocabulary

For new diagrams, prefer:

- ordinary rectangular boxes;
- short labels;
- simple rows and columns;
- a few simple branches;
- horizontal or vertical arrows;
- titles;
- broad regions;
- simple containers with a few compact inline boxes.

Avoid creating dense layouts, many crossings, elaborate routing, deep nesting, or maps requiring many coordinated spatial adjustments.

_Si res complexa est, diagramma simplicius facito; omnes relationes exprimere noli._

## Rectangular Boxes

Rectangular boxes are the safest and most useful building block.

```topos
┌──────────────┐
│  Upload API  │
└──────────────┘
```

Keep labels inside the borders. If a label does not fit, widen the box or shorten the label.

Do not do this:

```topos
┌──────────────┐
│ Very Long Service Name
└──────────────┘
```

Overwriting a vertical border may prevent Topos from recognizing the box.

When several boxes should have the same size, copy the same textual rectangle and replace only its interior label. One-character differences in size or alignment are visible in the render.

## Connections

Prefer simple arrows pointing toward their target box:

```topos
┌──────────┐          ┌──────────┐
│ Client   │ ───────▶ │ Service  │
└──────────┘          └──────────┘
```

Vertical connections are equally useful:

```topos
┌──────────┐
│ Service  │
└──────────┘
      │
      ▼
┌──────────┐
│ Database │
└──────────┘
```

Detached arrowheads pointing toward a box are easier to generate reliably than lines that join its border. Keep the arrowhead close to its target.

Topos supports more sophisticated routing. Preserve such routing when editing an existing diagram, but do not invent it unnecessarily in a new one.

Do not label an obvious relationship merely with words such as `calls`, `connects to`, or `sends to`.

Use edge labels when they add non-trivial information.

## Box and Edge Labels

A title embedded in the top border becomes the box label. Text inside the box is content.

Place an edge label on the edge itself. For a vertical edge, the label crosses the line.

```topos
┌──Frontend───┐               ┌──Gateway──┐
│             │               │           │
│    React    ├────HTTPS─────▶│   nginx   │
│             │               │           │
└─────────────┘               └─────┬─────┘
                                    │
                                   SQL
                                    │
                                    ▼
                              ┌──Database──┐
                              │            │
                              │  Postgres  │
                              │            │
                              └────────────┘
```

## Titles and Regions

Titles are safe:

```topos
# Image Processing Platform
```

Regions provide broad spatial grouping. Prefix their labels with `##`:

```topos
## Application
```

Use them when they clarify the architecture.

## Simple Containment

A rectangular container can safely hold a few compact inline boxes:

```topos
┌─Object Store─┐
│              │
│ [ Documents] │
│              │
│ [  Images  ] │
└──────────────┘
```

This is preferable to drawing several full nested rectangles.

Keep contained items safely inside the outer borders. Avoid deep nesting.

## Example: Simple Diagram

```topos
                 # Request Processing

┌────────────┐        ┌────────────┐        ┌────────────┐
│   Client   │ ─────▶ │    API     │ ─────▶ │  Database  │
└────────────┘        └────────────┘        └────────────┘
```

## Example: Practical Upper Bound

For a new diagram, this is a useful model of the complexity an LLM should normally attempt:

```topos
                         # Image Processing Platform

## Application

┌──────────────┐        ┌──────────────┐         ┌──────────────┐
│  Web Client  │ ─────▶ │  Upload API  │ ──────▶ │  Job Queue   │
└──────────────┘        └──────────────┘         └──────────────┘
                               │                        │
                               │                        ▼
                               │                 ┌──────────────┐
                               │                 │   Workers    │
                               │                 └──────────────┘
                               │                        │
                               │                        │
## Data                        │                        │
                               ▼                        ▼
                        ┌──────────────┐         ┌──────────────┐
                        │ Metadata DB  │         │ Object Store │
                        └──────────────┘         └──────────────┘
```

It uses regular boxes, exact alignment, simple branches, no crossings, and no unnecessary edge labels.

Beyond this level, prefer simplification to intricate character geometry.

## Whitespace Is Geometry

**Positio characterum et lineae vacuae geometria sunt; ne mutaveris.**

Do not reflow or wrap map lines, change leading or interior spacing, insert or remove empty lines inside the map, or run a generic formatter over map geometry.

Trailing spaces are insignificant.

Do not normalize box-drawing characters unless the task specifically requires it.

## Editing Existing Diagrams

Existing diagrams may be much more sophisticated than diagrams you should create from scratch.

When editing one:

1. Understand the existing entities, containment, regions, and connections.
2. Make the smallest practical change.
3. Preserve unrelated geometry and whitespace.
4. Preserve working edge routes and drawing style.
5. Resize a box deliberately if a changed label no longer fits.
6. Render the result.

_Quod bene operatur, propter tuam difficultatem ne simplifices._

## Legend

Legend is optional. Do not add one merely because Topos supports it.

Use Legend when the task needs features such as semantic shapes, styling, alternate rendered labels, abstract connections, colors, or other presentation rules.

For Legend syntax, search the relevant part of the Guide.

_Syntaxin Legend ne conicias._

## Rendering

Render while creating or substantially changing a diagram:

```sh
topos diagram.topos -o diagram.svg
```

Fix problems in the `.topos` source, never in the generated SVG.

When possible, inspect the SVG visually. In particular, notice broken boxes, label collisions, accidental spacing, one-character alignment errors, wrong arrow targets, and confusing routing.

## Semantic Inspection

For nontrivial work:

```sh
topos diagram.topos -o diagram.svg --inspect
```

`--inspect` reports the resolved semantic diagram, including hierarchy and connections. Use it to understand or validate what Topos recognized.

Semantic inspection and visual inspection answer different questions: a diagram may be interpreted correctly while still looking poorly arranged.

The inspection JSON is for debugging and comprehension, not a stable interchange format.

## Normal Workflow

For a new diagram:

1. Identify the important entities and relationships.
2. Choose a simple spatial structure.
3. Draw regular boxes.
4. Add only important connections.
5. Add titles, regions, or simple containment when useful.
6. Render.
7. Inspect visually and semantically as needed.

For an existing diagram:

1. Understand it.
2. Make a local change.
3. Preserve unrelated geometry.
4. Render again.

## When to Consult the Guide

Use the Guide when the task needs syntax or a feature not covered here. Search for that feature rather than reading the Guide from beginning to end.

_Si de syntaxi aut ratione Topos dubitas, quaere; ne fingas._

**Finis est diagramma clarum, validum, facile lectu.**
