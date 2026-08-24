import { MapAST, MapEdge, MapNode } from "./types.ts";
import { boundingRect, contains, insetRect } from "../geo.ts";

/**
 * Expands `## Label` notes into swimlane/quadrant region cells and reparents enclosed content.
 *
 * Layout model
 * ────────────
 * Seeds (notes whose text starts with "## ") are clustered into **row groups** by Y
 * position (threshold <= 2 lines offset).
 *
 * Adjacent row groups that share the same column count form a **grid block**. Within a
 * block, column boundaries are computed based on seed label horizontal limits and content box
 * boundaries, and then refined by bisecting the whitespace gap between columns.
 *
 * Row boundaries are exact (minimum Y among the row's seeds), never bisected.
 * Column boundaries cover the full diagram width; row boundaries cover the full height.
 */
export function resolveRegions(diagram: MapAST): void {
  const { root } = diagram;
  const seeds = root.children.filter((n) => n.nodeType === "note" && n.header == 2);
  if (seeds.length === 0) return;

  // Promote seeds from note → region; rawLabels/label are already set correctly by the parser
  for (const seed of seeds) seed.nodeType = "region";

  // ── Step 1: Cluster seeds into row groups ────────────────────────────────────
  const sortedSeeds = [...seeds].sort((a, b) => a.y - b.y);
  const rowGroups: MapNode[][] = [];

  for (const seed of sortedSeeds) {
    const lastGroup = rowGroups.at(-1);
    // Allow slightly misaligned Y (e.g., difference <= 2 lines)
    if (lastGroup && seed.y - lastGroup[0].y <= 2) lastGroup.push(seed);
    else rowGroups.push([seed]);
  }

  // Sort each row's seeds by X
  for (const group of rowGroups) {
    group.sort((a, b) => a.x - b.x);
  }

  // ── Step 2: Global row boundaries from exact Y values ────────────────────────
  const rowBounds = rowGroups.map((g) => Math.min(...g.map((s) => s.y)));
  rowBounds.push(root.y + root.h);
  extendOuterRowBounds(rowBounds, root);
  const [leftBound, rightBound] = computeOuterColumnBounds(root, rowBounds[0], rowBounds[rowBounds.length - 1]);

  // ── Step 3: Build grid blocks and compute column bounds per block ─────────────
  // Adjacent row groups with the same column count share column lane boundaries.

  for (let startRow = 0; startRow < rowGroups.length;) {
    const colCount = rowGroups[startRow].length;
    let endRow = startRow + 1;
    while (endRow < rowGroups.length && rowGroups[endRow].length === colCount) endRow++;

    const blockRows = rowGroups.slice(startRow, endRow);
    const [startY, endY] = [rowBounds[startRow], rowBounds[endRow]];

    const colBounds = computeBlockColBounds(blockRows, startY, endY, root, leftBound, rightBound);

    // assign the refined geometries to seeds
    for (let r = startRow; r < endRow; r++) {
      for (let c = 0; c < colCount; c++) {
        const seed = rowGroups[r][c];
        seed.y = rowBounds[r];
        seed.h = rowBounds[r + 1] - rowBounds[r];
        seed.x = colBounds[c];
        seed.w = colBounds[c + 1] - colBounds[c];
      }
    }
    startRow = endRow;
  }

  reparentToRegions(seeds, root);
}

function computeOuterColumnBounds(root: MapNode, startY: number, endY: number): [number, number] {
  const content = contentInRows(root, startY, endY);
  if (content.length === 0) return [root.x, root.x + root.w];

  const regions = root.children.filter((node) => node.nodeType === "region");
  const contentBounds = boundingRect(content)!;
  const bounds = boundingRect([...regions, insetRect(contentBounds, -1)])!;
  return [bounds.x, bounds.x + bounds.w];
}

function extendOuterRowBounds(rowBounds: number[], root: MapNode): void {
  const topBounds = boundingRect(contentInRows(root, rowBounds[0], rowBounds[1]));
  if (topBounds && topBounds.y <= rowBounds[0]) {
    rowBounds[0] = topBounds.y - 1;
  }

  const last = rowBounds.length - 1;
  const bottomBounds = boundingRect(contentInRows(root, rowBounds[last - 1], rowBounds[last]));
  if (bottomBounds && bottomBounds.y + bottomBounds.h >= rowBounds[last]) {
    rowBounds[last] = bottomBounds.y + bottomBounds.h + 1;
  }
}

function contentInRows(root: MapNode, startY: number, endY: number): MapNode[] {
  return root.children.filter((node) => node.nodeType !== "region" && node.y < endY && node.y + node.h > startY);
}

// ── Column boundary computation ───────────────────────────────────────────────

/**
 * Compute column lane boundaries for a grid block.
 * Seeds within each row are already sorted by X, so seeds[c] is the c-th column in every row.
 */
function computeBlockColBounds(blockRows: MapNode[][], startY: number, endY: number, root: MapNode, leftBound: number, rightBound: number): number[] {
  const colCount = blockRows[0].length;
  const colBounds: number[] = [leftBound];
  colBounds[colCount] = rightBound;

  const blockNodes = contentInRows(root, startY, endY);

  // Compute each boundary cut using gap bisection and constraints
  for (let col = 1; col < colCount; col++) {
    const seedLeftLimit = Math.max(...blockRows.map((r) => r[col - 1].x + r[col - 1].w));
    const seedRightLimit = Math.min(...blockRows.map((r) => r[col].x));

    // Content boxes that end before/at the right seed limit belong to the left column (or earlier).
    // Boxes extending past the right seed limit belong to the right column (or later).
    const leftBoxes = blockNodes.filter((b) => b.x + b.w <= seedRightLimit);
    const rightBoxes = blockNodes.filter((b) => b.x + b.w > seedRightLimit);

    const leftBounds = boundingRect(leftBoxes);
    const rightBounds = boundingRect(rightBoxes);
    const boxesLeftLimit = leftBounds ? leftBounds.x + leftBounds.w : -Infinity;
    const boxesRightLimit = rightBounds?.x ?? Infinity;

    let minX = Math.max(seedLeftLimit, boxesLeftLimit);
    let maxX = Math.min(seedRightLimit, boxesRightLimit);
    if (minX > maxX) {
      minX = seedLeftLimit;
      maxX = seedRightLimit;
    }

    colBounds[col] = Math.floor((minX + maxX) / 2);
  }

  return colBounds;
}

// ── Reparenting ───────────────────────────────────────────────────────────────

function reparentToRegions(regions: MapNode[], root: MapNode): void {
  const keptChildren: MapNode[] = [];
  for (const child of root.children) {
    const region = regions.find((r) => r !== child && contains(r, child));
    if (region) {
      region.children.push(child);
      child.parent = region;
    } else {
      keptChildren.push(child);
    }
  }
  root.children = keptChildren;

  const keptEdges: MapEdge[] = [];
  for (const edge of root.edges) {
    const region = regions.find((r) => contains(r, edge));
    if (region) {
      region.edges.push(edge);
      edge.parent = region;
    } else {
      keptEdges.push(edge);
    }
  }
  root.edges = keptEdges;
}
