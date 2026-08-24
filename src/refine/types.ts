import { Direction, Loc, Rect } from "../geo.ts";
import { Glyph, PenStyle } from "../style.ts";
import type { Stack } from "../stacked-box.ts";

export type NodeType = "box" | "inline" | "note" | "hub" | "root" | "region";

export interface MapLabel extends Rect {
  text: string;
}

/**
 * Content represents the raw text content extracted from inside a box or edge, along with any parsed sigils.
 */
export interface Content {
  label?: string; // Parsed or promoted (first line or +==label==+)
  rawLabels?: MapLabel[]; // The extracted segments for exact alignment
}

/**
 * A detected entity on the grid before logical resolution.
 */
export interface MapNode extends Rect, Content {
  nodeType: NodeType; // How this node was detected
  text?: string; // Raw text for note

  parent?: MapNode; // Assigned during tree assembly; absent on root
  children: MapNode[]; // Excludes rawLabels
  edges: MapEdge[]; // [Containment] Edges visually nested inside this node's boundaries
  links: MapEdge[]; // [Connectivity] Edges that topologically point to or from this node

  glyph?: string; // Hub glyph for hubs (e.g. "●", "◎")
  style?: PenStyle; // Border/stroke style; undefined = no visible border (note, root, hub)
  bracket?: string; // Bracket pair for inline nodes (e.g., "[]", "()", "<>")
  header?: number; // #, ##, or ###
  isGridCell?: boolean; // True if this is a cell in a grid box
  isPort?: boolean; // True if this is a hub on the border of its parent box
  stack?: Stack; // Geometry metadata for stacked boxes
}

/**
 * Represents one end of a MapEdge, including the connected node, entry/exit direction, and glyph.
 */
export interface MapTerminus {
  node?: MapNode;
  dir: Direction; // direction pointing INTO the node
  glyph: Glyph; // Arrowhead/hub glyph (e.g. '<', '▶'), '' if none
  offset?: number; // offset from boundary (0 - on it, 1 - touching, 2 - etc)
  anchor?: Loc; // manual anchor position override
  stem?: MapEdge; // Edge this terminus splits from, before resolving to its node
}

/**
 * Represents a connection between two MapNodes, typically detected as a line of characters connecting them.
 */
export interface MapEdge extends Rect, Content {
  parent?: MapNode; // Assigned during edge attachment
  source: MapTerminus;
  target: MapTerminus;
  direction: "uni" | "bi" | "none"; // uni: source -> target, bi: source <-> target, none: undirected
  style?: PenStyle; // Line stroke style; undefined defaults to DEFAULT_PEN
  polyline: Loc[]; // The simplified path of the edge (turn points turn points only)

  nodes: MapNode[]; // Source and target nodes when present (used for layout/routing)
}

export interface MapAST {
  root: MapNode;
  nodes: MapNode[];
  edges: MapEdge[];
}
