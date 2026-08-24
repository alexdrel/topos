// deno-fmt-ignore-file

import { borders, compareByArea, contains, type Loc, midpoint, type Rect, simplifyPath } from "../../geo.ts";
import { isBordered, type TraceBox, type TraceMap } from "../../trace/types.ts";
import type { PenStyle } from "../../style.ts";
import { getStackGeometry } from "../../stacked-box.ts";

/**
 * Monosketch shorthand codes:
 */
export type MonoFillType = "F0" | "F1" | "F2" | "F3" | "F4" | "F5";
export type MonoStrokeType = "S0" | "S1" | "S2" | "S3" | "S4";
export type MonoArrowType = "A1" | "A12" | "A13" | "A14" | "A2" | "A21" | "A220" | "A221" | "A3" | "A4" | "A5" | "A6" | "A61" | "A62";

/**
 * Monosketch JSON Format.
 * Note: Monosketch is built with Kotlin/JS, resulting in these highly compressed
 * and sometimes cryptic property names (e.g., 'j1j_1' style internal mappings).
 * 
 * Property Legend (Inferred):
 * - 'i': Unique ID (usually 26-char base36)
 * - 'v': Version/Variant hash (32-bit signed int)
 * - 'ss': Shapes (Array of boxes and lines)
 * - 'connectors': Topological links between lines and boxes
 */
export interface MonoFormat {
  root: {
    i: string;
    v: number;
    ss: MonoShape[]; // Shapes collection
  };
  extra: {
    name: string;   // Diagram name
    offset?: string;
  };
  version: 2;
  modified_timestamp_millis: number;
  connectors: MonoConnector[];
}

/**
 * 'T' stands for Text/Box, 'L' stands for Line.
 */
export type MonoShape = MonoBox | MonoLine;

/**
 * Shape Type 'T': Represents a Box or Note.
 */
export interface MonoBox {
  type: "T";
  i: string;
  v: number;
  b: string; // Bounds: "x|y|w|h" in grid units
  t: string; // Text content (label)
  e: {
    be: {
      fe: boolean; // Fill Enabled
      fu: MonoFillType;  // Fill Color
      be: boolean; // Border Enabled
      bu: MonoStrokeType;  // Border Color/Style
      du: string;  // Dash/Line pattern (e.g. "1|0|0" for solid)
      rc: string;  // Rounded Corners ("NNNN" = none, "YYYY" = all)
    };
    tha: number; // Text Horizontal Alignment (0: Left, 1: Center, 2: Right)
    tva: number; // Text Vertical Alignment   (0: Top, 1: Middle, 2: Bottom)
  };
  te?: boolean; // ?? "Text Explicit/Enabled" - Often false for empty-label nodes
}

/**
 * Shape Type 'L': Represents an Edge or Path.
 */
export interface MonoLine {
  type: "L";
  i: string;
  v: number;
  ps: string; // Path Start orientation: "H|x|y" or "V|x|y"
  pe: string; // Path End orientation:   "H|x|y" or "V|x|y"
  jps: string[]; // Junction Points: ["x|y", ...] defined for minden transition
  e: {
    su: MonoStrokeType;   // Stroke Unit
    ase: boolean; // Arrow Start Enabled
    asu: MonoArrowType;  // Arrow Start Unit
    aee: boolean; // Arrow End Enabled
    aeu: MonoArrowType;  // Arrow End Unit
    du: string;   // Dash pattern ("3|3|0" for dashed)
  };
  em: boolean; // ?? "Edge Managed/Modified" - If true, Monosketch respects manual junction points
}

/**
 * Maps Line terminals to Shape boundaries using relative coordinates.
 */
export interface MonoConnector {
  i: string; // ID of the MonoLine being connected
  a: number; // Anchor index (1 = Start/ps, 2 = End/pe)
  t: string; // ID of the target MonoBox
  r: string; // Relative position on box: "rx|ry" (0.0 to 1.0)
  o: string; // Offset: "dx|dy" (usually "0|0")
}

/**
 * Maps Topos Unicode/ASCII characters to Monosketch arrowhead codes based on discovered JS.
 * - A1: Triangle (Filled)
 * - A12: Triangle (Open)
 * - A2: Square (Filled)
 * - A21: Square (Open)
 * - A220: Diamond (Filled)
 * - A221: Diamond (Open)
 * - A3: Circle (Open)
 * - A4: Double Circle
 * - A5: Circle (Filled)
 * - A6, A61, A62: Hub variants (Thin, Bold, Double)
 */
/**
 * Maps Topos arrowhead types to Monosketch terminal IDs.
 */
function getArrowType(char: string): MonoArrowType {
  switch (char) {
    // Triangles (A1/A12)
    case '▶': case '►': case '▸': case '▹': case '▻': case '⯈':
    case '◀': case '◄': case '◂': case '◃': case '◅': case '⯇':
    case '▲': case '▴': case '▵':
    case '▼': case '▾': case '▿':
    case '>': case '<': case 'v': case 'V': case '^':
      return 'A1';
    case '▷': case '◁': case '△': case '▽':
      return 'A12';

    // Squares/Diamonds (A2/A21/A220/A221)
    case '■': return 'A2';
    case '□': return 'A21';
    case '◆': return 'A220';
    case '◇': return 'A221';

    // Circles (A3/A4/A5)
    case '○': return 'A3';
    case '◎': return 'A4';
    case '●': return 'A5';

    // Hubs/Junctions (A6/A61/A62)
    case '├': case '┤': case '┬': case '┴': case '┼':
    case '┝': case '┥': case '┰': case '┸': case '╂':
    case '┠': case '┨': case '┯': case '┷': case '┿':
    case '┢': case '┪': case '┱': case '┹': case '╃':
    case '┡': case '┩': case '┲': case '┺': case '╄':
    case '┟': case '┧': case '╁':
    case '┞': case '┦': case '╀':
    case '┚': case '┖': case '┎': case '┒':
    case '┐': case '└': case '┘': case '┌':
    case '╷': case '╵': case '╶': case '╴':   // New Single-direction stubs
      return 'A6';
    case '┣': case '┫': case '┳': case '┻': case '╋':
    case '┏': case '┓': case '┗': case '┛':   // Bold corners
      return 'A61';
    case '╠': case '╣': case '╦': case '╩': case '╬':
    case '╔': case '╗': case '╚': case '╝':   // Double corners
      return 'A62';

    default:
      // Whitelist common line/dot characters as "Hub" style (A6)
      if (char === '-' || char === '|' || char === '+' || char === '*' || char === '.' ||
        char === '─' || char === '│' || char === '═' || char === '║' || char === '·') {
        return 'A6';
      }
      // If none of the above, it might be a floating arrowhead character (A1)
      return 'A1';
  }
}

/**
 * Maps Topos styles to Monosketch fill codes based on discovered JS.
 * - F0: No Fill (100% transparent)
 * - F1: Standard (Default white/theme-aware)
 * - F2: Full/Solid (█)
 * - F3: Dense Pattern (▒)
 * - F4: Light Pattern (░)
 * - F5: Checkerboard (▚)
 */
function getFillType(_nodeType: string): MonoFillType {
  // Currently we use F1 (Standard) to preserve the lean ASCII look,
  // but we could map specific node types to patterns in the future.
  return "F1";
}

/**
 * Maps Topos styles to Monosketch stroke codes based on discovered JS.
 * - S0: No Stroke
 * - S1: Standard (Thin/Unicode)
 * - S2: Bold (Heavy Unicode)
 * - S3: Double
 * - S4: Rounded (Standard line with Rounded corners)
 */
function getStrokeType(style: PenStyle | undefined): MonoStrokeType {
  if (!style) return 'S1';
  if (style.corner === 'rounded') return 'S4';
  switch (style.weight) {
    case 'bold': return 'S2';
    case 'double': return 'S3';
    default: return 'S1';
  }
}

/**
 * Orchestrates the export of Topos traces to Monosketch JSON.
 * 
 * Monosketch Metadata Summary:
 * - Strokes: S0 (None), S1 (Thin), S2 (Bold), S3 (Double), S4 (Rounded)
 * - Arrows: A1 (Triangle), A2 (Square), A220 (Diamond), A5 (Circle), A6 (Hub)
 * - Fills: F0 (None), F1 (Standard), F2 (Full/Solid), F3-F5 (Patterns)
 * - Dashing (du): "Dash|Gap|Shift" (e.g. "1|0|0" for solid, "3|3|0" for dashed)
 */
export function renderToMono(traceMap: TraceMap, name = "Topos Diagram"): string {
  const boxes: MonoBox[] = [];
  /** 
   * 'extBoxes' holds standalone text elements (type: 'T') that aren't natively 
   * bound as a Box's internal label. This is used for: 
   * 1. Ceiling rawLabels (Monosketch doesn't support "on-ceiling" rawLabels).
   * 2. Labels that don't fit Monosketch's coarse alignment grid (to preserve 1:1 fidelity).
   */
  const extBoxes: MonoBox[] = [];
  const lines: MonoLine[] = [];
  const connectors: MonoConnector[] = [];
  const now = Date.now();

  /** Generates a standard 26-character Monosketch-style ID */
  function generateId() {
    return "02-AA" + Math.random().toString(36).substring(2, 26);
  }

  const boxTraces = traceMap.traces.filter(isBordered);
  const textOwners = new Map<TraceBox, TraceBox>();
  for (const text of traceMap.traces.filter((trace) => trace.type === "text")) {
    const owner = boxTraces.filter((box) => contains(box, text)).sort(compareByArea)[0];
    if (owner) textOwners.set(text, owner);
    }
  const shapeTraces = traceMap.traces.filter((trace) =>
    isBordered(trace) || trace.type === "inline" ||
    (trace.type === "text" && !textOwners.has(trace))
  );
  const connectorTraces = shapeTraces.filter((trace) => trace.type !== "text");
  const nodeToId = new Map(shapeTraces.map((trace) => [trace, generateId()]));

  for (const node of shapeTraces) {
      const id = nodeToId.get(node)!;
    const rawLabels = [
      ...(node.rawLabels ?? []),
      ...[...textOwners].filter(([, owner]) => owner === node).map(([text]) => text),
    ].flatMap(splitTextRows);
      let label = "";
      let tha = 1; // Default: Center
      let tva = 0; // Default: Top
      let te = false;

    const isBox = isBordered(node);
    const borderOffset = isBox ? 1 : 0;
    const isCeilingLabel = rawLabels.length > 0 && rawLabels[0].y === node.y;

      // Special handling for rawLabels
    if (rawLabels.length > 0) {
        if (isCeilingLabel) {
          // Ceiling rawLabels (on the border) must be separate text nodes in Monosketch
        rawLabels.forEach((segment) => {
            extBoxes.push({
              type: "T",
              i: generateId(),
              v: Math.floor(Math.random() * 2000000000) - 1000000000,
            b: `${segment.x}|${segment.y}|${segment.text?.length ?? 0}|1`,
              /**
               * CRITICAL: We use Non-Breaking Space (\u00A0) instead of a regular space (\u0020).
             * Monosketch's grid renderer treats \u0020 as transparent, but \u00A0 as opaque.
               * This allows the label to "mask" the box border underneath without needing a fill.
               */
            t: (segment.text ?? "").replace(/ /g, "\u00A0"),
              e: {
                be: { fe: false, fu: "F1", be: false, bu: "S1", du: "1|0|0", rc: "NNNN" },
              tha: 1,
              tva: 0,
              },
            });
          });
          label = ""; // Clear from parent box
          te = false;
        } else {
          // Normal internal rawLabels
        const primaryLabel = rawLabels[0];
          const innerW = Math.max(1, node.w - 2 * borderOffset);
          const innerH = Math.max(1, node.h - 2 * borderOffset);
          const startX = node.x + borderOffset;
          const startY = node.y + borderOffset;
          const align = calculateAlignmentBasic(
            { x: startX, y: startY, w: innerW, h: innerH },
          { x: primaryLabel.x, y: primaryLabel.y, w: primaryLabel.w, h: primaryLabel.h },
          );

          tha = align.h === 0 ? 0 : (align.h === 1 ? 2 : 1);
          tva = align.v === 0 ? 0 : (align.v === 1 ? 2 : 1);

          // Accuracy check: If snapped alignment is too far from original, emit separate text
          const expectedX = startX + align.h * (innerW - primaryLabel.w);
        const expectedY = startY + align.v * (innerH - 1);
          const dx = Math.abs(expectedX - primaryLabel.x);
          const dy = Math.abs(expectedY - primaryLabel.y);

          if (rawLabels.length > 1 || dx > 1 || dy > 0.5) {
          rawLabels.forEach((segment) => {
              extBoxes.push({
                type: "T",
                i: generateId(),
                v: Math.floor(Math.random() * 2000000000) - 1000000000,
                b: `${segment.x}|${segment.y}|${segment.w}|${segment.h}`,
              t: (segment.text ?? "").replace(/ /g, "\u00A0"),
                e: {
                  be: { fe: false, fu: "F1", be: false, bu: "S1", du: "1|0|0", rc: "NNNN" },
                tha: 1,
                tva: 0,
                },
              });
            });
            label = "";
            te = false;
          } else {
            // Successfully matched Mono alignment constraints! 
            // Use exact spacing but keep it internal to the box
            label = (primaryLabel.text ?? "").replace(/ /g, "\u00A0");
          }
        }
      } else if (node.text) {
        label = (node.type === "inline" ? node.text.slice(1, -1) : node.text).replace(/ /g, "\u00A0");
      }

      if (node.stack && node.stack.layers > 1) {
        const geo = getStackGeometry(node, node.stack);

        for (const layer of geo.layers) {
          boxes.push({
            type: "T",
            i: layer.isFace ? id : generateId(),
            v: Math.floor(Math.random() * 2000000000) - 1000000000,
            b: `${layer.x}|${layer.y}|${layer.w}|${layer.h}`,
            t: layer.isFace ? label : "",
            e: {
              be: {
                fe: true, // Fill enabled to mask shadows/background
              fu: getFillType(node.type),
              be: isBox,
                bu: getStrokeType(node.style),
                du: node.style?.weight === "dashed" ? "3|3|0" : node.style?.weight === "dotted" ? "1|3|0" : "1|0|0",
                rc: node.style?.corner === "rounded" ? "YYYY" : "NNNN",
              },
              tha: layer.isFace ? tha : 1,
              tva: layer.isFace ? tva : 0,
            },
            te: layer.isFace ? te : false,
          });
        }
      } else {
        const box: MonoBox = {
          type: "T",
          i: id,
          v: Math.floor(Math.random() * 2000000000) - 1000000000,
          b: `${node.x}|${node.y}|${node.w}|${node.h}`,
          t: label,
          e: {
            be: {
              fe: true, // Fill enabled to mask background
            fu: getFillType(node.type),
            be: isBox,
              bu: getStrokeType(node.style),
              du: node.style?.weight === "dashed" ? "3|3|0" : (node.style?.weight === "dotted" ? "1|3|0" : "1|0|0"),
              rc: node.style?.corner === "rounded" ? "YYYY" : "NNNN",
            },
            tha,
            tva,
          },
          te,
        };
      boxes.push(box);
      }
    }

  const hubs = traceMap.traces.filter((trace) => trace.type === "hub");
  for (const edge of traceMap.traces.filter((trace) => trace.type === "line")) {
    const lineId = generateId();
    const snapPolyline = [...(edge.path || [])];
    const termini = [edge.source, edge.target];
    const terminalHubs = termini.map((terminus, i) => {
      const point = i === 0 ? snapPolyline[0] : snapPolyline.at(-1);
      if (!point) return undefined;
      const attached = attachedPoint(point, terminus?.dir);
      const hub = hubs.find((candidate) => candidate.x === attached.x && candidate.y === attached.y);
      if (hub) {
        const hubPoint = { x: hub.x, y: hub.y };
        if (i === 0) snapPolyline.unshift(hubPoint);
        else snapPolyline.push(hubPoint);
      }
      return hub;
    });
    const ps = snapPolyline[0];
    const pe = snapPolyline.at(-1)!;
    if (!ps || !pe) continue;
    const junctions = simplifyPath(snapPolyline);

    // Determine starting/ending orientation based on first movement
    const ps2 = snapPolyline[1];
    const pe2 = snapPolyline.at(-2)!;
    const sDir = ps2 ? (ps.x === ps2.x ? "V" : "H") : "H";
    const eDir = pe2 ? (pe.x === pe2.x ? "V" : "H") : "H";

    const tInfo = termini.map((terminus, i) => {
      const char = terminalHubs[i]?.text || terminus?.text || "";
      const type = getArrowType(char);
      return { type, enabled: char !== "" };
    });

    const line: MonoLine = {
      type: "L",
      i: lineId,
      v: Math.floor(Math.random() * 2000000000) - 1000000000,
      ps: `${sDir}|${ps.x}|${ps.y}`,
      pe: `${eDir}|${pe.x}|${pe.y}`,
      jps: junctions.map((p: Loc) => `${p.x}|${p.y}`),
      e: {
        su: getStrokeType(edge.style),
        ase: tInfo[0].enabled,
        asu: tInfo[0].type,
        aee: tInfo[1].enabled,
        aeu: tInfo[1].type,
        du: edge.style?.weight === "dashed" ? "3|3|0" : (edge.style?.weight === "dotted" ? "1|3|0" : "1|0|0"),
      },
      em: true,
    };
    lines.push(line);

      /**
       * Note on Monosketch Connectors:
       * 
       * Even with precise 'r' coordinates (inclusive formula: (loc - box) / (dim - 1)) and 
       * optimized 'jps' (no intermediate locked cells), Monosketch appears to have a 
       * deserialization bug where it fails to re-anchor edges on file load. 
       * 
       * The coordinates exported here are mathematically correct for his grid system, 
       * but you may still see "floating" edges until they are nudged in the UI.
       */

    [edge.source, edge.target].forEach((_terminus, i) => {
          const pt = i === 0 ? ps : pe;
      const attached = attachedPoint(pt, _terminus?.dir);
      const target = connectorTraces.filter((trace) => borders(trace, pt) || borders(trace, attached)).sort(compareByArea)[0];
      if (target) {
        const anchor = borders(target, pt) ? pt : attached;
        const rx = target.w > 1 ? (anchor.x - target.x) / (target.w - 1) : 0.5;
        const ry = target.h > 1 ? (anchor.y - target.y) / (target.h - 1) : 0.5;
          connectors.push({
          i: lineId,
          a: i + 1,
          t: nodeToId.get(target)!,
          r: `${rx}|${ry}`,
          o: "0|0",
          });
        }
      });

      // Export edge rawLabels as standalone text boxes
    edge.rawLabels?.forEach((segment) => {
        extBoxes.push({
          type: "T",
          i: generateId(),
          v: Math.floor(Math.random() * 2000000000) - 1000000000,
          b: `${segment.x}|${segment.y}|${segment.w}|${segment.h}`,
          /**
           * We use the same NBSP trick as box rawLabels to ensure the text 
           * is opaque and "masks" any lines underneath it.
           */
          t: (segment.text ?? "").replace(/ /g, "\u00A0"),
          e: {
            be: { fe: false, fu: "F1", be: false, bu: "S1", du: "1|0|0", rc: "NNNN" },
            tha: 1, tva: 1, // Default to center-center for standalone rawLabels
          },
          te: true,
        });
      });
  }

  const format: MonoFormat = {
    root: {
      i: generateId(),
      v: Math.floor(Math.random() * 2000000000) - 1000000000,
      ss: [...boxes, ...lines, ...extBoxes] as MonoShape[], // Boxes first ensures anchors are defined before lines
    },
    extra: {
      name,
    },
    version: 2,
    modified_timestamp_millis: now,
    connectors: connectors,
  };

  return JSON.stringify(format, null, 4);
}

function calculateAlignmentBasic(container: Rect, label: Rect): { h: number; v: number } {
  const mid = midpoint(label);
  const snap = (value: number) => value < 0.33 ? 0 : value > 0.66 ? 1 : 0.5;
  return {
    h: snap((mid.x - container.x) / container.w),
    v: snap((mid.y - container.y) / container.h),
  };
}

function attachedPoint(point: Loc, direction: number | undefined): Loc {
  if (direction === 1) return { x: point.x, y: point.y - 1 };
  if (direction === 2) return { x: point.x + 1, y: point.y };
  if (direction === 4) return { x: point.x, y: point.y + 1 };
  if (direction === 8) return { x: point.x - 1, y: point.y };
  return point;
}

function splitTextRows(trace: TraceBox): TraceBox[] {
  const rows = trace.text?.split("\n") ?? [""];
  return rows.map((text, row) => ({
    ...trace,
    y: trace.y + row,
    w: text.length,
    h: 1,
    text,
  }));
}
