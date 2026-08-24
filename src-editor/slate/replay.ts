import { Dir, type Loc } from "../../src/geo.ts";
import type { XmlEl } from "../../src/jsonml/jsonml.ts";
import type { AntEvent } from "../../src/trace/recorder.ts";
import { traceMap } from "../../src/trace/trace-map.ts";
import { htmlEl, mount, svgEl } from "./dom.ts";
import type { GridMetrics } from "./grid.ts";
import type { Slate } from "./slate.ts";

interface Segment {
  from: Loc;
  to: Loc;
  type: "move" | "backtrack" | "jump" | "rejected";
}

interface Agent {
  segments: Segment[];
  head: Loc | null;
  status: "active" | "backtrack" | "success" | "abort";
  angle: number;
  kind: string;
}

const DIR_ANGLE: Partial<Record<Dir, number>> = {
  [Dir.N]: 270,
  [Dir.E]: 0,
  [Dir.S]: 90,
  [Dir.W]: 180,
};

export class TraceReplay {
  private readonly events: AntEvent[];
  private readonly panel: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly timeline: HTMLInputElement;
  private readonly counter: HTMLElement;
  private readonly agents = new Map<string, Agent>();
  private tick = 0;
  private animationFrame?: number;
  private playFrame = 0;

  constructor(private readonly slate: Slate, text: string) {
    this.events = traceMap(text, { record: true }).events ?? [];
    const node = htmlEl(
      "div",
      { class: this.slate.surface.chrome ? "slate-replay slate-replay-with-chrome" : "slate-replay" },
      htmlEl("button", { type: "button", class: "qi-btn", title: "Play trace replay", "data-part": "play" }, "▶"),
      htmlEl("input", { type: "range", value: "0", "data-part": "timeline" }),
      htmlEl("span", { class: "slate-replay-counter", "data-part": "counter" }, `0 / ${this.events.length}`),
      htmlEl("button", { type: "button", class: "qi-btn", title: "Close trace replay", "data-part": "close" }, "×"),
    );
    this.panel = mount(node) as HTMLElement;
    this.playButton = this.panel.querySelector("[data-part=play]")!;
    this.timeline = this.panel.querySelector("[data-part=timeline]")!;
    this.counter = this.panel.querySelector("[data-part=counter]")!;
    this.timeline.max = String(this.events.length);
    this.panel.addEventListener("mousedown", (event) => event.stopPropagation());
    this.panel.addEventListener("keydown", (event) => event.stopPropagation());
    globalThis.addEventListener("keydown", this.onKeyDown, true);
    this.playButton.addEventListener("click", () => this.togglePlay());
    this.timeline.addEventListener("input", () => this.setTick(Number(this.timeline.value)));
    this.panel.querySelector("[data-part=close]")!.addEventListener("click", () => this.slate.closeReplay());
    this.slate.containerEl.classList.add("replaying");
    this.slate.containerEl.inert = true;
    this.slate.surface.appendViewportElement(this.panel);
    this.play();
  }

  public overlay(metrics: GridMetrics): XmlEl[] {
    const cx = metrics.charWidth / 2;
    const cy = metrics.charHeight / 2;
    const nodes: XmlEl[] = [];
    const paths = new Map<string, string[]>();

    for (const agent of this.agents.values()) {
      for (const segment of agent.segments) {
        const className = `slate-replay-segment slate-replay-${segment.type} slate-replay-${agent.status} slate-replay-${agent.kind}`;
        const commands = paths.get(className) ?? [];
        commands.push(
          `M ${segment.from.x * metrics.charWidth + cx} ${segment.from.y * metrics.charHeight + cy}` +
            ` L ${segment.to.x * metrics.charWidth + cx} ${segment.to.y * metrics.charHeight + cy}`,
        );
        paths.set(className, commands);
      }
    }

    for (const [className, commands] of paths) {
      nodes.push(svgEl("path", { d: commands.join(" "), class: className, fill: "none" }));
    }

    for (const agent of this.agents.values()) {
      if (!agent.head) continue;
      const x = agent.head.x * metrics.charWidth + cx;
      const y = agent.head.y * metrics.charHeight + cy;
      const emoji = agent.kind === "text" ? "🐢" : agent.kind === "line" ? "🐁" : "🐜";
      let transform: string | undefined;
      if (agent.kind === "text") {
        if (agent.angle === 0) transform = `translate(${2 * x} 0) scale(-1 1)`;
      } else {
        transform = `rotate(${agent.angle + 180} ${x} ${y})`;
      }
      nodes.push(svgEl("text", {
        x,
        y,
        transform,
        class: `slate-replay-head slate-replay-${agent.status}`,
        fill: "currentColor",
        "font-size": 20,
        "text-anchor": "middle",
        "dominant-baseline": "central",
      }, emoji));
    }
    return nodes;
  }

  public dispose(): void {
    this.pause();
    globalThis.removeEventListener("keydown", this.onKeyDown, true);
    this.slate.containerEl.classList.remove("replaying");
    this.slate.containerEl.inert = false;
    this.panel.remove();
  }

  private apply(event: AntEvent): void {
    let agent = this.agents.get(event.antId);
    if (!agent) {
      agent = { segments: [], head: null, status: "active", angle: 0, kind: "box" };
      this.agents.set(event.antId, agent);
    }
    if (event.kind) agent.kind = event.kind;
    if (event.dir !== undefined) agent.angle = DIR_ANGLE[event.dir] ?? agent.angle;
    const previous = agent.head;

    switch (event.type) {
      case "spawn":
        agent.head = event;
        agent.status = "active";
        break;
      case "move":
        agent.head = event;
        if (previous) agent.segments.push({ from: previous, to: event, type: "move" });
        agent.status = "active";
        break;
      case "jump":
        agent.head = event;
        if (previous) agent.segments.push({ from: previous, to: event, type: "jump" });
        agent.status = "active";
        break;
      case "backtrack":
        agent.head = event;
        if (previous) {
          const rejected = agent.segments.findLast((segment) =>
            (segment.type === "move" || segment.type === "jump") && segment.to.x === previous.x && segment.to.y === previous.y
          );
          if (rejected) rejected.type = "rejected";
          agent.segments.push({ from: previous, to: event, type: "backtrack" });
        }
        agent.status = "backtrack";
        break;
      case "success":
        agent.status = "success";
        break;
      case "abort":
        agent.status = "abort";
        break;
      case "branch":
        break;
      default: {
        const unknown: never = event;
        throw new Error(`Unknown trace replay event: ${JSON.stringify(unknown)}`);
      }
    }
  }

  private setTick(tick: number): void {
    const next = Math.max(0, Math.min(tick, this.events.length));
    if (next < this.tick) {
      this.agents.clear();
      this.tick = 0;
    }
    while (this.tick < next) this.apply(this.events[this.tick++]);
    this.timeline.value = String(this.tick);
    this.counter.textContent = `${this.tick} / ${this.events.length}`;
    this.slate.surface.renderOverlay(this.overlay(this.slate.metrics));
  }

  private togglePlay(): void {
    this.animationFrame === undefined ? this.play() : this.pause();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      event.preventDefault();
      event.stopPropagation();
      this.togglePlay();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.slate.closeReplay();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      this.pause();
      this.setTick(this.tick + (event.key === "ArrowLeft" ? -1 : 1));
    }
  };

  private play(): void {
    if (this.animationFrame !== undefined || this.events.length === 0) return;
    if (this.tick === this.events.length) this.setTick(0);
    this.playButton.textContent = "Ⅱ";
    this.playButton.title = "Pause trace replay";
    this.playFrame = 0;
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  private pause(): void {
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
    this.playButton.textContent = "▶";
    this.playButton.title = "Play trace replay";
  }

  private animate = (): void => {
    const framesPerEvent = this.events.length < 300 ? 3 : this.events.length < 600 ? 2 : 1;
    this.playFrame++;
    if (this.playFrame % framesPerEvent === 0) this.setTick(this.tick + 1);
    if (this.tick === this.events.length) this.pause();
    else this.animationFrame = requestAnimationFrame(this.animate);
  };
}
