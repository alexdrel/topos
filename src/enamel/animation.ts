import type { Loc, Rect } from "../geo.ts";
import { appendChild, type XmlEl } from "../jsonml/jsonml.ts";
import { svgEl } from "../jsonml/svg.ts";
import type { Annotated } from "../topos.ts";
import { CHAR_WIDTH } from "./geometry.ts";
import type { Registry } from "./svg.ts";

export const ANIMATION_DURATION_SECONDS = 5;
const PARTICLE_BASE_PATH_LENGTH = 10 * CHAR_WIDTH;
const PARTICLE_SYMBOL_SIZE = 20;
const PARTICLE_SYMBOL_RADIUS = PARTICLE_SYMBOL_SIZE / 2;

export interface FilterAnimation {
  begin: string;
  speed: number;
  reverse: boolean;
}

export interface EntityAnimation {
  style: Record<string, string | undefined>;
  filterArgs?: FilterAnimation;
  particles: XmlEl[];
}

export interface MotionPath {
  path?: string;
  pathLength?: number;
  bidirectional?: boolean;
}

interface PathMotionOptions {
  phase: number;
  authoredPhase: boolean;
  duration: number;
  inset: number;
  reverse: boolean;
  timingIdentity: string;
}

export function animation(entity: Annotated & Loc, registry: Registry, motion: MotionPath = {}): EntityAnimation {
  const identity = `${entity.x},${entity.y}`;
  const speed = animationSpeed(entity);
  const animated = isAnimated(entity) && !registry.animationDisabled;
  const duration = ANIMATION_DURATION_SECONDS / speed;
  const begin = animated ? randomBegin(identity, duration) : undefined;
  return {
    style: {
      "--tp-animation-delay": begin,
      "--tp-animation-duration": animated ? `${duration}s` : undefined,
    },
    filterArgs: animated
      ? {
        begin: begin!,
        speed,
        reverse: entity.eidos?.animation === "animate-reverse",
      }
      : undefined,
    particles: motion.path && motion.pathLength !== undefined
      ? renderPathParticles(motion.path, motion.pathLength, entity, identity, speed, motion.bidirectional ?? false, registry, animated)
      : [],
  };
}

function isAnimated(entity: Annotated): boolean {
  return entity.eidos?.animation === "animate" || entity.eidos?.animation === "animate-reverse";
}

function animationSpeed(entity: Annotated): number {
  const value = entity.properties?.["animation-speed"];
  if (value === "slow") return 0.5;
  if (value === "fast") return 2;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

export function rectMotionPath(rect: Rect): string {
  const { x, y, w, h } = rect;
  return `M ${x},${y} H ${x + w} V ${y + h} H ${x} Z`;
}

function renderPathParticles(
  path: string,
  pathLength: number,
  entity: Annotated,
  identity: string,
  speed: number,
  bidirectional: boolean,
  registry: Registry,
  animated: boolean,
): XmlEl[] {
  const particleType = entity.eidos?.particle;
  if (!particleType || particleType === "no-particle") return [];
  const defaultCount = entity.eidos?.edgeBody === "block" ? Math.round(pathLength * 5 / (10 * CHAR_WIDTH)) : 1;
  const requestedCount = pathItemCount(entity, pathLength, defaultCount);
  const count = bidirectional ? Math.max(2, requestedCount) : requestedCount;
  const forwardCount = Math.round(count * particleBalance(entity, bidirectional) / 100);
  const random = entity.properties?.["particle-random"];
  const numericRandom = Number(random);
  const randomSeed = random === undefined ? undefined : Number.isFinite(numericRandom) ? `${identity}|${random}` : `fixed|${random}`;
  const timingIdentity = random !== undefined && !Number.isFinite(numericRandom) ? randomSeed! : identity;
  const phaseProperty = entity.properties?.["particle-phase"];
  const numericPhase = Number(phaseProperty);
  const authoredPhase = phaseProperty !== undefined && Number.isFinite(numericPhase);
  const phaseOffset = authoredPhase ? numericPhase / 100 : 0;
  const duration = ANIMATION_DURATION_SECONDS * pathLength / PARTICLE_BASE_PATH_LENGTH / speed;
  const symbolId = `tpc-particle-${particleType}`;
  const scale = particleScale(entity);
  const inset = path.trimEnd().endsWith("Z") ? 0 : Math.min(0.25, PARTICLE_SYMBOL_RADIUS * scale / pathLength);
  const reverseCount = count - forwardCount;
  const particleGap = PARTICLE_SYMBOL_SIZE * scale / pathLength;
  const phases = [
    ...particlePhases(forwardCount, randomSeed && `${randomSeed}:forward`, phaseOffset, particleGap),
    ...particlePhases(reverseCount, randomSeed && `${randomSeed}:reverse`, phaseOffset, particleGap),
  ];
  const particles: XmlEl[] = [];
  registry.symbols.add(symbolId);

  for (let i = 0; i < count; i++) {
    const phase = phases[i];
    const particle = svgEl("use", {
      x: -PARTICLE_SYMBOL_RADIUS * scale,
      y: -PARTICLE_SYMBOL_RADIUS * scale,
      width: PARTICLE_SYMBOL_SIZE * scale,
      height: PARTICLE_SYMBOL_SIZE * scale,
      href: `#${symbolId}`,
      class: `tp tpc-particle tp-${particleType}`,
    });
    const reverse = motionReversed(entity, i >= forwardCount);
    appendPathMotion(particle, path, animated, { phase, authoredPhase, duration, inset, reverse, timingIdentity });
    particles.push(particle);
  }
  return particles;
}

function appendPathMotion(element: XmlEl, path: string, animated: boolean, options: PathMotionOptions): void {
  const { phase, authoredPhase, duration, inset, reverse, timingIdentity } = options;
  const start = inset;
  const end = 1 - inset;
  const position = start + phase * (end - start);
  const automaticPhase = authoredPhase ? 0 : Math.abs(Number.parseFloat(randomBegin(timingIdentity, duration)));
  const begin = animated ? `${-(phase * duration + automaticPhase).toFixed(2)}s` : undefined;
  appendChild(
    element,
    svgEl("animateMotion", {
      path,
      dur: `${duration}s`,
      begin,
      repeatCount: "indefinite",
      rotate: reverse ? "auto-reverse" : "auto",
      keyPoints: animated ? (reverse ? `${end};${start}` : inset ? `${start};${end}` : undefined) : `${position};${position}`,
      keyTimes: animated && !reverse && !inset ? undefined : "0;1",
      calcMode: animated && !reverse && !inset ? undefined : "linear",
    }),
  );
}

function motionReversed(entity: Annotated, reverse: boolean): boolean {
  return (entity.eidos?.animation === "animate-reverse") !== reverse;
}

function pathItemCount(entity: Annotated, pathLength: number, defaultCount: number): number {
  const count = Number(entity.properties?.["particle-count"]);
  if (Number.isFinite(count) && count > 0) return Math.max(1, Math.floor(count));
  const density = Number(entity.properties?.["particle-density"]);
  if (Number.isFinite(density) && density > 0) return Math.max(1, Math.round(pathLength * density / (10 * CHAR_WIDTH)));
  return Math.max(1, defaultCount);
}

function particleScale(entity: Annotated): number {
  const scale = Number(entity.properties?.["particle-scale"]);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function particleBalance(entity: Annotated, bidirectional: boolean): number {
  const balance = Number(entity.properties?.["particle-balance"]);
  if (!Number.isFinite(balance)) return bidirectional ? 50 : 100;
  return Math.min(100, Math.max(0, balance <= 1 ? balance * 100 : balance));
}

function particlePhases(count: number, randomSeed: string | undefined, offset: number, particleGap: number): number[] {
  if (count === 0) return [];
  if (!randomSeed) return Array.from({ length: count }, (_, i) => wrapPhase(i / count + offset));
  const minGap = Math.min(particleGap, 0.8 / count);
  const phases: number[] = [];
  for (let i = 0; i < count; i++) {
    let bestPhase = 0;
    let bestGap = -1;
    for (let attempt = 0; attempt < 3; attempt++) {
      const phase = stablePhase(`${randomSeed}:${i}:${attempt}`);
      const gap = phases.length === 0 ? 1 : Math.min(...phases.map((other) => Math.abs(phase - other)));
      if (gap > bestGap) [bestPhase, bestGap] = [phase, gap];
      if (gap >= minGap) break;
    }
    phases.push(bestPhase);
  }
  return phases.map((phase) => wrapPhase(phase + offset));
}

function wrapPhase(phase: number): number {
  return ((phase % 1) + 1) % 1;
}

function randomBegin(identity: string, duration: number): string {
  const phase = stablePhase(identity);
  return `-${(phase * duration).toFixed(2)}s`;
}

function stablePhase(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}
