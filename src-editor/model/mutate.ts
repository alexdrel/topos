/**
 * Public mutation API.
 *
 * Implementations live in focused modules; this barrel preserves the original
 * import path for editor consumers.
 */
export * from "./mutate/box.ts";
export * from "./mutate/inline.ts";
export * from "./mutate/label.ts";
export * from "./mutate/line.ts";
export * from "./mutate/trace.ts";
