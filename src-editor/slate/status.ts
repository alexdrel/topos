import type { EditorModel } from "../model/model.ts";

export interface SlateStatus {
  mapWidth: number;
  mapHeight: number;
  selection?: { x: number | null; y: number | null; width: number | null; height: number | null };
}

export function buildSlateStatus(model: EditorModel): SlateStatus {
  const selection = model.selection;
  const common = (key: "x" | "y" | "w" | "h"): number | null => {
    const value = selection[0]?.[key];
    return value !== undefined && selection.every((trace) => trace[key] === value) ? value : null;
  };
  return {
    mapWidth: model.projection.width,
    mapHeight: model.projection.height,
    selection: selection.length === 0 ? undefined : { x: common("x"), y: common("y"), width: common("w"), height: common("h") },
  };
}

export function formatSlateStatus(status: SlateStatus): string {
  const map = `${status.mapWidth} × ${status.mapHeight}`;
  const selection = status.selection;
  if (!selection) return map;
  if (selection.x === null && selection.y === null && selection.width === null && selection.height === null) return map;
  const value = (number: number | null) => number ?? "…";
  const geometry = [];
  if (selection.height === 1) {
    if (selection.width !== null && selection.width !== 1) geometry.push(String(selection.width));
  } else if (selection.width !== null || selection.height !== null) {
    if (selection.width !== 1 || selection.height !== 1) geometry.push(`${value(selection.width)} × ${value(selection.height)}`);
  }
  if (selection.x !== null || selection.y !== null) geometry.push(`@ ${value(selection.x)},${value(selection.y)}`);
  if (geometry.length === 0) return map;
  return `${geometry.join(" ")} · ${map}`;
}
