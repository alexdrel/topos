import type { SlateContextCommand } from "../../../src-editor/slate/context-command.ts";

export interface AppearanceConfig {
  fontSizePercent: number;
  family: string;
  selectionColor: string;
  selectionScale: number;
  rulerGridVisible: boolean;
}

export interface StatusConfig {
  text: string;
  tooltip?: string;
  command?: string;
}

export interface SlateSessionState {
  rulerGridVisible?: boolean;
  fontSizeDelta?: number;
  scrollLeft?: number;
  scrollTop?: number;
}

export type HostToWebviewMessage =
  | ({ type: "appearance" } & AppearanceConfig)
  | { type: "sessionState"; state: SlateSessionState }
  | { type: "update"; text: string }
  | { type: "paste"; text: string }
  | { type: "toggleReplay" }
  | { type: "slateContextCommand"; command: SlateContextCommand };

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "change"; text: string }
  | { type: "copy"; text: string }
  | { type: "paste" }
  | ({ type: "status" } & StatusConfig)
  | { type: "sessionStateUpdate"; state: SlateSessionState }
  | { type: "command"; command: "editLegend" | "openGuide" };
