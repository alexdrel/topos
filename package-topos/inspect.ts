import { activeEidosValues, type Topos } from "#topos-core";

interface InspectedTopos {
  root: Topos["root"];
  parameters: Topos["parameters"];
  palette: Topos["palette"];
}

export function inspectAnnotated(ast: Topos): string {
  const nodeIds = indexNodes(ast.root, ast.edges);
  const edgeIds = indexStemEdges(ast.edges);
  const emptyTextLines = new WeakSet<object>();
  const formattedSegments = new WeakSet<object>();
  const inspected: InspectedTopos = {
    root: ast.root,
    parameters: ast.parameters,
    palette: ast.palette,
  };

  return JSON.stringify(
    inspected,
    function (key, value) {
      return inspectField.call(
        this,
        key,
        value,
        nodeIds,
        edgeIds,
        emptyTextLines,
        formattedSegments,
      );
    },
    2,
  ) + "\n";
}

function inspectField(
  this: Record<string, unknown>,
  key: string,
  value: unknown,
  nodeIds: WeakMap<object, string>,
  edgeIds: WeakMap<object, string>,
  emptyTextLines: WeakSet<object>,
  formattedSegments: WeakSet<object>,
): unknown {
  if (
    key === "parent" || key === "links" || key === "nodes" ||
    key === "rawLabels" || key === "header" || key === "glyph"
  ) return undefined;
  if (
    (key === "source" || key === "target") &&
    typeof value === "object" && value !== null
  ) {
    const { node, ...fields } = value as Record<string, unknown>;
    if (typeof node === "object" && node !== null && nodeIds.has(node)) {
      const label = (node as Record<string, unknown>).label;
      return {
        $ref: nodeIds.get(node),
        ...(typeof label === "string" && label ? { label } : {}),
        ...fields,
      };
    }
  }
  if (
    key === "node" && typeof value === "object" && value !== null &&
    nodeIds.has(value)
  ) {
    const label = (value as Record<string, unknown>).label;
    return {
      $ref: nodeIds.get(value),
      ...(typeof label === "string" && label ? { label } : {}),
    };
  }
  if (
    key === "stem" && typeof value === "object" && value !== null &&
    edgeIds.has(value)
  ) {
    return { $ref: edgeIds.get(value) };
  }
  if (typeof value === "object" && value !== null) {
    const id = nodeIds.get(value) ?? edgeIds.get(value);
    if (isRect(value)) {
      const { x, y, w, h, ...fields } = value;
      return {
        ...(id ? { $id: id } : {}),
        ...(x === 0 && y === 0 && w === 0 && h === 0 ? {} : { xywh: `${x},${y},${w},${h}` }),
        ...fields,
      };
    }
    if (id) return { $id: id, ...value };
  }
  if (
    value === false &&
    (key === "bold" || key === "italic" || key === "strike" || key === "code")
  ) return undefined;
  if (key === "offset" && value === 0) return undefined;
  if (key === "isPort" && value === false) return undefined;
  if (key === "dir" && typeof value === "number") return directionName(value);
  if (key === "text" && !formattedSegments.has(this)) return undefined;
  if (key === "segmentedText") {
    if (isPlainText(value, this)) return undefined;
    return inspectSegmentedText(value, emptyTextLines, formattedSegments);
  }
  if (key === "style") return undefined;
  if (key === "polyline" && Array.isArray(value)) {
    return value.map((point) => `${point.x},${point.y}`).join(" ");
  }
  if (key === "eidos") {
    return withoutEidosDefaults(value);
  }
  if (Array.isArray(value) && value.length === 0) {
    return emptyTextLines.has(value) ? value : undefined;
  }
  if (
    typeof value === "object" && value !== null &&
    Object.keys(value).length === 0
  ) return undefined;
  return value;
}

function isRect(
  value: object,
): value is Record<string, unknown> & {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const rect = value as Record<string, unknown>;
  return typeof rect.x === "number" && typeof rect.y === "number" &&
    typeof rect.w === "number" && typeof rect.h === "number";
}

function directionName(direction: number): string {
  return ({ 0: "None", 1: "N", 2: "E", 4: "S", 8: "W" })[direction] ??
    String(direction);
}

function indexNodes(
  root: Topos["root"],
  edges: Topos["edges"],
): WeakMap<object, string> {
  const referenced = new WeakSet<object>();
  for (const edge of edges) {
    if (edge.source.node) referenced.add(edge.source.node);
    if (edge.target.node) referenced.add(edge.target.node);
  }

  const ids = new WeakMap<object, string>();
  let nextId = 0;

  function visit(node: Topos["root"]): void {
    if (referenced.has(node)) ids.set(node, `n${nextId++}`);
    for (const child of node.children) visit(child);
  }

  visit(root);
  return ids;
}

function indexStemEdges(edges: Topos["edges"]): WeakMap<object, string> {
  const stems = new WeakSet<object>();
  for (const edge of edges) {
    if (edge.source.stem) stems.add(edge.source.stem);
    if (edge.target.stem) stems.add(edge.target.stem);
  }

  const ids = new WeakMap<object, string>();
  let nextId = 0;
  for (const edge of edges) {
    if (stems.has(edge)) ids.set(edge, `e${nextId++}`);
  }
  return ids;
}

function withoutEidosDefaults(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const filtered: Record<string, unknown> = {};
  for (
    const { axis, value: eidosValue, scope, isDefault } of activeEidosValues(
      value,
    )
  ) {
    if (isDefault) continue;
    if (scope) {
      const scoped = (filtered[scope] ??= {}) as Record<string, string>;
      scoped[axis] = eidosValue;
    } else {
      filtered[axis] = eidosValue;
    }
  }
  return Object.keys(filtered).length ? filtered : undefined;
}

function isPlainText(
  value: unknown,
  entity: Record<string, unknown>,
): boolean {
  if (!Array.isArray(value)) return false;
  const lines: string[] = [];
  for (const line of value) {
    if (!Array.isArray(line)) return false;
    let text = "";
    for (const segment of line) {
      if (typeof segment !== "object" || segment === null) return false;
      if (!isPlainSegment(segment)) return false;
      text += String((segment as { text?: unknown }).text ?? "");
    }
    lines.push(text);
  }
  const text = lines.join("\n");
  return text === entity.text || text === entity.label;
}

function inspectSegmentedText(
  value: unknown,
  emptyTextLines: WeakSet<object>,
  formattedSegments: WeakSet<object>,
): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((line) => {
    if (!Array.isArray(line)) return line;
    const inspectedLine = line.map((segment) => {
      if (typeof segment !== "object" || segment === null) return segment;
      if (isPlainSegment(segment)) {
        return String((segment as { text?: unknown }).text ?? "");
      }
      formattedSegments.add(segment);
      return segment;
    });
    if (inspectedLine.length === 0) emptyTextLines.add(inspectedLine);
    return inspectedLine;
  });
}

function isPlainSegment(segment: object): boolean {
  return Object.entries(segment).every(([key, value]) =>
    key === "text" ||
    ((key === "bold" || key === "italic" || key === "strike" ||
      key === "code") && value === false)
  );
}
