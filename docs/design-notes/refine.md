# Refine Pipeline

The `refine` stage is the structural engine of Topos. It bridges the gap between the raw geometric output of the `trace` stage and the semantic annotated models used by `legend` and `enamel`. It takes unstructured `TraceBox` entities (boxes, text, lines, hubs) and transforms them into a strictly ordered, spatial `MapAST`.

## 1. Node Initialization & Decomposition

Traces are mapped into base `MapNode` and `MapEdge` instances.

- **Boxes and Hubs** are mapped directly. Hubs adjacent to notes automatically assimilate those notes as their label.
- **Text Traces (Notes)** are classified during the `trace` stage by `traceText`. If a text block is bounded by bracket characters (e.g., `[ ]`, `< >`, `( )`), it is traced as an `inline` trace. In the `refine` stage, these `inline` traces are directly mapped into inline `MapNode` instances. Other plain text traces are mapped to regular `note` nodes.

> [!NOTE]
> A closing fence must use the same character and column as its opener and be at least as long. A shorter, complete fenced block can therefore be nested inside a longer one.

## 2. Edge Resolution

Edges are analyzed via `resolveEdges` to establish graph connectivity. Using the coordinate grid:

- Directionality (`uni`, `bi`, `none`) is determined based on the start and end terminus glyphs.
- The ends of lines are topologically attached to the nearest `MapNode` boundaries.
- Complex routing phenomena (e.g., split stems, overlapping connections) are resolved into coherent node-to-node links.

## 3. Tree Assembly (Containment)

Nodes are organized into a strict spatial hierarchy.

1. Container nodes (`box`, `inline`, and the `root`) are sorted by area to ensure innermost containers are checked first.
2. Every node is evaluated for bounding-box containment. If a node falls within a container, it becomes a child of that container. Anything uncontained becomes a direct child of the `root`.
3. Edges are similarly assigned to the smallest bounding container that fully encloses their path.

## 4. Final Polish: Titles & Regions

Once the containment tree is built, structural text cues are processed to finalize the `MapAST`. This handles explicit Markdown-like declarations.

### Label Promotion

The structural parser determines node and diagram titles by examining child notes:

- **Inline nodes** unconditionally promote their inner bracketed content to their semantic label.
- **Trivial Boxes** that contain only a single note (and no other nodes) automatically promote that note to the box's label, even without special syntax.
- **Explicit Titles (`# Title`)**: For complex boxes or the root diagram (which may contain multiple elements), the parser looks for a child `note` that begins with a single hash (`#`). This syntax explicitly defines the title of that container without spatial heuristics. The note is merged into the container's `labels` array—perfectly preserving its original text (including the `#`) and `x/y/w/h` coordinates to ensure 1:1 editor round-tripping. The hash is only stripped when computing the container's derived semantic `label` property.

### Region Resolution (`## Region`)

The structural tree is divided into logical quadrants or swimlanes based on section heading notes:

1. **Seed Identification & Promotion**: Any note starting with a double hash prefix (`##`) acts as a region seed. The node's type is changed to `region`. The original raw text and coordinates are preserved in the `labels` array to maintain coordinate sync with the editor, while the `##` prefix is stripped to derive its semantic `label` property (e.g. `## EARTH` becomes label `EARTH`).
2. **Spatial Clustering**: Region seeds are grouped vertically into row lanes by Y-proximity. Within each row lane, seeds are ordered horizontally from left to right.
3. **Lane Boundary Calculation (Whitespace Bisection)**:
   - **Row Boundaries**: Placed exactly at the top of each row's seeds.
   - **Column Boundaries**: Adjacent row lanes sharing the same column count share boundaries. The boundary between columns is placed exactly at the midpoint of the whitespace gap between them:
     - The gap is bounded on the left by the left column's seeds and any content boxes that end before the right column's seeds start.
     - The gap is bounded on the right by the right column's seeds and any content boxes that extend into the right column.
4. **Geometry Expansion**: Region geometries are expanded to tile the diagram grid completely along these lane boundaries.
5. **Enclosed Content Reparenting**: Any root-level boxes or edges are parented into the region that encloses them.

_(Because regions define structural hierarchy and grouping, this resolution operates entirely within the `refine` phase. This ensures the diagram's `MapAST` is fully structured and parented before it reaches the visual `annotate` or `enamel` rendering phases)._

## 5. Path Simplification

Finally, edge paths are optimized. Redundant intermediate points along straight grid segments are collapsed, leaving only a minimal set of turning points (`polyline`). This simplification is delayed to the end because the edge resolution phase requires the full coordinate path to accurately detect stems and intersections.
