import { Dir, type Loc } from "../geo.ts";
import { TraceBox } from "./types.ts";

// Define a common base type for AntEvent
interface BaseAntEvent extends Loc {
  antId: string;
  kind?: TraceBox["type"];
  dir?: Dir;
}

export type AntEvent =
  | (BaseAntEvent & { type: "spawn"; kind: string })
  | (BaseAntEvent & { type: "move"; dir: Dir; char: string })
  | (BaseAntEvent & { type: "jump" })
  | (BaseAntEvent & { type: "branch"; dir: Dir })
  | (BaseAntEvent & { type: "backtrack" })
  | (BaseAntEvent & { type: "success"; pathLength: number })
  | (BaseAntEvent & { type: "abort"; reason: string });

export interface BlackBox {
  record(event: AntEvent): void;
  getEvents(): AntEvent[];
}

export class DefaultBlackBox implements BlackBox {
  private events: AntEvent[] = [];

  record(event: AntEvent) {
    this.events.push(event);
  }

  getEvents(): AntEvent[] {
    return this.events;
  }
}
