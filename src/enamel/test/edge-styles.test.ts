import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { parseTopos } from "../../topos.ts";
import { buildSvgTree } from "../svg.ts";
import { matchChildEl } from "../../jsonml/assert.ts";
import { attrs, XmlEl, textContent } from "../../jsonml/jsonml.ts";
import { buildBlockArrowPolygon } from "../edge.ts";
import { ANIMATION_DURATION_SECONDS } from "../animation.ts";
import { CHAR_WIDTH, nodeRenderedBoundsPx } from "../geometry.ts";

function descendantsByTag(element: XmlEl, wantedTag: string): XmlEl[] {
  const descendants: XmlEl[] = [];
  for (const child of element.slice(2)) {
    if (!Array.isArray(child)) continue;
    const childElement = child as XmlEl;
    if (childElement[0] === wantedTag) descendants.push(childElement);
    descendants.push(...descendantsByTag(childElement, wantedTag));
  }
  return descendants;
}

/**
 * Enamel Block Arrows Tests
 * Verifies block arrow geometry, bidirectional support, and pattern injection.
 */

Deno.test("block arrow polygon: unidirectional", () => {
  assertEquals(buildBlockArrowPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }], false), [
    { x: 0, y: 9 },
    { x: 78, y: 9 },
    { x: 78, y: 16 },
    { x: 100, y: 0 },
    { x: 78, y: -16 },
    { x: 78, y: -9 },
    { x: 0, y: -9 },
  ]);
});

Deno.test("block arrow polygon: bidirectional", () => {
  assertEquals(buildBlockArrowPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }], true), [
    { x: 0, y: 0 },
    { x: 22, y: 16 },
    { x: 22, y: 9 },
    { x: 78, y: 9 },
    { x: 78, y: 16 },
    { x: 100, y: 0 },
    { x: 78, y: -16 },
    { x: 78, y: -9 },
    { x: 22, y: -9 },
    { x: 22, y: -16 },
  ]);
});

Deno.test("block arrows connect the flat tail without clearance", () => {
  const input = `\
┌───┐             ┌───┐
│ A ├────────────▶│ B │
└───┘             └───┘

:legend
[A] -> [B]: block
`;
  const ast = parseTopos(input);
  const root = matchChildEl(buildSvgTree(ast), "g", { class: "tp-root" });
  const polygon = matchChildEl(matchChildEl(root, "g", { class: "tp-block" }), "polygon", { class: "tp tpc-shape" });
  const points = String(attrs(polygon).points).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const source = nodeRenderedBoundsPx(ast.nodes.find((node) => node.label === "A")!);
  const target = nodeRenderedBoundsPx(ast.nodes.find((node) => node.label === "B")!);

  assertAlmostEquals(points[0], source.x + source.w);
  assertAlmostEquals(Math.max(...points.filter((_, index) => index % 2 === 0)), target.x - 2);
});

Deno.test("block arrow polygon: ignores coincident points", () => {
  assertEquals(buildBlockArrowPolygon([{ x: 5, y: 5 }, { x: 5, y: 5 }], false), []);
});

Deno.test("block arrows: short spans fall back to a standard arrow", () => {
  const input = `\
┌─┐ ┌─┐
│A├─▶B│
└─┘ └─┘

:legend
[A] -> [B]: block
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-block" });

  matchChildEl(edge, "path", {
    class: "tp tpc-shape",
    "marker-end": "url(#tpc-arr-triangle)",
  });
});

Deno.test("block chevrons: default density distributes static chevrons over the body", () => {
  const input = `\
┌───┐             ┌───┐
│ A │────────────▶│ B │
└───┘             └───┘

:legend
[A] -> [B]: block chevron
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-block tp-chevron" });
  matchChildEl(edge, "polygon", { class: "tp tpc-shape" });
  const chevrons = edge.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tp-chevron")
  );

  assertEquals(chevrons.length > 1, true);
  for (const chevron of chevrons) {
    const motion = matchChildEl(chevron, "animateMotion");
    const [from, to] = String(attrs(motion).keyPoints).split(";");
    assertEquals(from, to);
    assertEquals(Number(from) > 0 && Number(from) < 1, true);
  }
});

Deno.test("block chevrons: animation follows and faces reverse travel", () => {
  const input = `\
┌───┐             ┌───┐
│ A │────────────▶│ B │
└───┘             └───┘

:legend
[A] -> [B]: block chevron animate-reverse
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-block tp-chevron tp-animate-reverse" });
  const chevrons = edge.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tp-chevron")
  );
  const chevron = chevrons[0];
  const motion = matchChildEl(chevron, "animateMotion");

  const [from, to] = String(attrs(motion).keyPoints).split(";").map(Number);
  assertEquals(from < 1 && to > 0 && from > to, true);
  assertEquals(attrs(motion).rotate, "auto-reverse");
  assertEquals(new Set(chevrons.map((item) => attrs(matchChildEl(item, "animateMotion")).begin)).size, chevrons.length);
});

Deno.test("animation: bidirectional block chevrons and spark retain both arrowheads", () => {
  const input = `\
┌───┐             ┌───┐
│ A │◀───────────▶│ B │
└───┘             └───┘

┌───┐             ┌───┐
│ C │◀───────────▶│ D │
└───┘             └───┘

:legend
[A] <-> [B]: block chevron animate particle-density=5
[C] <-> [D]: spark animate particle-count=3
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const flow = matchChildEl(root, "g", { class: "tp-block tp-chevron tp-animate" });
  const spark = matchChildEl(root, "g", { class: "tp-spark tp-animate" });

  const flowBody = matchChildEl(flow, "polygon", { class: "tp tpc-shape" });
  assertEquals(String(attrs(flowBody).points).split(" ").length, 10);
  const flowMotions = flow.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tp-chevron")
  ).map((chevron) => attrs(matchChildEl(chevron, "animateMotion")));
  assertEquals(
    new Set(flowMotions.map((motion) => Number(String(motion.keyPoints).split(";")[0]) > 0.5)),
    new Set([false, true]),
  );
  const sparkBody = matchChildEl(spark, "path", { class: "tp tpc-shape" });
  assertEquals(attrs(sparkBody)["marker-start"], attrs(sparkBody)["marker-end"]);
  assertEquals(attrs(sparkBody)["marker-start"] !== undefined, true);
  const sparkMotions = spark.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tpc-particle")
  ).map((particle) => attrs(matchChildEl(particle, "animateMotion")));
  assertEquals(sparkMotions.length, 3);
  assertEquals(
    new Set(sparkMotions.map((motion) => Number(String(motion.keyPoints).split(";")[0]) > 0.5)),
    new Set([false, true]),
  );
});

Deno.test("animation: particle balance distributes travel direction", () => {
  const input = `\
┌───┐             ┌───┐
│ A │◀───────────▶│ B │
└───┘             └───┘

┌───┐             ┌───┐
│ C │────────────▶│ D │
└───┘             └───┘

┌───┐             ┌───┐
│ E │◀───────────▶│ F │
└───┘             └───┘

:legend
[A] <-> [B]: spark animate particle-count=4 particle-balance=75
[C] -> [D]: spark animate particle-count=4 particle-balance=25
[E] <-> [F]: spark animate particle-count=4 particle-balance=0.75
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const reverseCounts = root.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "g" && String(attrs(child).class).includes("tp-spark")
  ).map((edge) => {
    return edge.slice(2).filter((child): child is XmlEl =>
      Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tpc-particle")
    ).filter((particle) => attrs(matchChildEl(particle, "animateMotion")).rotate === "auto-reverse").length;
  });

  assertEquals(reverseCounts, [1, 3, 1]);
});

Deno.test("animation: balanced directions distribute independently along the path", () => {
  const input = `\
┌───┐             ┌───┐
│ A │◀───────────▶│ B │
└───┘             └───┘

:legend
[A] <-> [B]: spark particle-count=4
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-spark" });
  const positions = edge.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tpc-particle")
  ).map((particle) => attrs(matchChildEl(particle, "animateMotion")).keyPoints);

  assertEquals(positions[0], positions[2]);
  assertEquals(positions[1], positions[3]);
  assertEquals(positions[0] === positions[1], false);
});

Deno.test("block arrows: local pattern injection", () => {
  const input = `\
┌───┐             ┌───┐
│ A │────────────▶│ B │
└───┘             └───┘

:legend
[A] -> [B]: block hatch
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edgeGrp = matchChildEl(root, "g", { class: "tp-block" });

  matchChildEl(edgeGrp, "pattern", { id: "tpc-pat-hatch-0" });

  const polygon = matchChildEl(edgeGrp, "polygon", { class: "tp tpc-shape" });
  const style = attrs(polygon).style as string;
  assertEquals(style.includes("fill: url(#tpc-pat-hatch-"), true, "Polygon should reference the local pattern");
});

Deno.test("block arrows: with label", () => {
  const input = `\
┌───┐     ┌───┐
│ A │────▶│ B │
└───┘     └───┘

:legend
[A] -> [B]: block "Link"
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edgeGrp = matchChildEl(root, "g", { class: "tp-block" });

  const label = matchChildEl(edgeGrp, "text", { class: "tpc-label" });
  assertEquals(attrs(label).x !== undefined, true, "Label should have an x coordinate");
  assertEquals(textContent(label).includes("Link"), true, "Label text should be present");
});

Deno.test("block arrows: support bends", () => {
  const input = `\
┌───┐   
│ A │
└───┘
  │
  └──▶ [B]

:legend
[A] -> [B]: block
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });

  const edgeGrp = matchChildEl(root, "g", { class: "tp-block" });

  const className = attrs(edgeGrp).class;
  assertEquals(
    typeof className === "string" && className.includes("block"),
    true,
    "Zigzag edge should support block",
  );

  // Should render a polygon, not a path, and ignore the traced target gap.
  const polygon = matchChildEl(edgeGrp, "polygon", { class: "tpc-shape" });
  const targetBounds = nodeRenderedBoundsPx(ast.nodes.find((node) => node.label === "B")!);
  const xs = String(attrs(polygon).points).split(/[ ,]/).filter(Boolean).map(Number).filter((_, i) => i % 2 === 0);
  assertEquals(ast.edges[0].target.offset, 2);
  assertAlmostEquals(Math.max(...xs), targetBounds.x - 2, 0.1);
});

Deno.test("animation: dashed animate composes on an edge without particles", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

:legend
[A] -> [B]: dashed animate
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-dashed tp-animate" });
  matchChildEl(edge, "path", { class: "tpc-shape" });
  assertEquals(String(attrs(edge).style).startsWith("--tp-animation-delay: -"), true);
});

Deno.test("animation: speed controls dashed and dotted flow", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

┌───┐   ┌───┐
│ C │──▶│ D │
└───┘   └───┘

:legend
[A] -> [B]: dashed animate animation-speed=0.5
[C] -> [D]: dotted animate animation-speed=2
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const slow = matchChildEl(root, "g", { class: "tp-dashed tp-animate" });
  const fast = matchChildEl(root, "g", { class: "tp-dotted tp-animate" });

  assertEquals(String(attrs(slow).style).includes("--tp-animation-duration: 10s"), true);
  assertEquals(String(attrs(fast).style).includes("--tp-animation-duration: 2.5s"), true);
});

Deno.test("animation: spark animate emits a deterministically phased path particle", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

:legend
[A] -> [B]: spark animate
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-animate tp-spark" });
  const particle = matchChildEl(edge, "use", { class: "tpc-particle tp-spark" });
  const motion = matchChildEl(particle, "animateMotion");

  assertEquals(attrs(motion).path, attrs(matchChildEl(edge, "path", { class: "tpc-shape" })).d);
  assertEquals(String(attrs(motion).begin).startsWith("-"), true);
  assertEquals(attrs(motion).repeatCount, "indefinite");

  const secondTree = buildSvgTree(parseTopos(input));
  const secondRoot = matchChildEl(secondTree, "g", { class: "tp-root" });
  const secondEdge = matchChildEl(secondRoot, "g", { class: "tp-animate tp-spark" });
  const secondParticle = matchChildEl(secondEdge, "use", { class: "tpc-particle tp-spark" });
  assertEquals(attrs(matchChildEl(secondParticle, "animateMotion")).begin, attrs(motion).begin);
});

Deno.test("animation: particle travel speed is independent of path length", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

┌───┐             ┌───┐
│ C │────────────▶│ D │
└───┘             └───┘

:legend
[A] -> [B]: spark animate
[C] -> [D]: packet animate
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const motions = ["tp-spark", "tp-packet"].map((className) => {
    const edge = matchChildEl(root, "g", { class: className });
    const particle = matchChildEl(edge, "use", { class: "tpc-particle" });
    return attrs(matchChildEl(particle, "animateMotion"));
  });
  const pathLength = (path: unknown) => {
    const coordinates = [...String(path).matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    return Math.hypot(coordinates[2] - coordinates[0], coordinates[3] - coordinates[1]);
  };
  const speeds = motions.map((motion) => pathLength(motion.path) / Number.parseFloat(String(motion.dur)));

  assertAlmostEquals(speeds[0], speeds[1]);
});

Deno.test("animation: named particle random is position-independent while numeric random is identity-mixed", () => {
  const input = `\
┌───┐         ┌───┐
│ A │────────▶│ B │
└───┘         └───┘

      ┌───┐         ┌───┐
      │ C │────────▶│ D │
      └───┘         └───┘

:legend
[A] -> [B]: spark particle-count=3 particle-random=stable
[C] -> [D]: spark particle-count=3 particle-random=stable
`;
  const phases = (source: string) => {
    const svgTree = buildSvgTree(parseTopos(source));
    const root = matchChildEl(svgTree, "g", { class: "tp-root" });
    return root.slice(2).filter((child): child is XmlEl =>
      Array.isArray(child) && child[0] === "g" && String(attrs(child).class).includes("tp-spark")
    ).map((edge) =>
      edge.slice(2).filter((child): child is XmlEl =>
        Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tpc-particle")
      ).map((particle) => attrs(matchChildEl(particle, "animateMotion")).keyPoints)
    );
  };

  const named = phases(input);
  assertEquals(named[0], named[1]);
  const randomPhases = named[0].map((keyPoints) => Number(String(keyPoints).split(";")[0]));
  assertEquals(Math.max(...randomPhases) - Math.min(...randomPhases) > 0.25, true);
  const sortedPhases = randomPhases.toSorted((a, b) => a - b);
  assertEquals(sortedPhases.slice(1).every((phase, i) => phase - sortedPhases[i] > 0.05), true);
  const numeric = phases(input.replaceAll("particle-random=stable", "particle-random=2"));
  assertEquals(JSON.stringify(numeric[0]) === JSON.stringify(numeric[1]), false);
});

Deno.test("animation: chevron and packet particles use compendium symbols", () => {
  const input = `\
┌───┐             ┌───┐
│ A │────────────▶│ B │
└───┘             └───┘

┌───┐             ┌───┐
│ C │────────────▶│ D │
└───┘             └───┘

:legend
[A] -> [B]: chevron animate particle-scale=2
[C] -> [D]: packet animate particle-scale=1.5
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const chevronEdge = matchChildEl(root, "g", { class: "tp-chevron tp-animate" });
  const packetEdge = matchChildEl(root, "g", { class: "tp-packet tp-animate" });
  const chevron = matchChildEl(chevronEdge, "use", { class: "tpc-particle tp-chevron" });
  const packet = matchChildEl(packetEdge, "use", { class: "tpc-particle tp-packet" });

  assertEquals(attrs(chevron).href, "#tpc-particle-chevron");
  assertEquals(attrs(chevron).x, -20);
  assertEquals(attrs(chevron).width, 40);
  assertEquals(attrs(matchChildEl(chevron, "animateMotion")).rotate, "auto");
  assertEquals(attrs(packet).href, "#tpc-particle-packet");
  assertEquals(attrs(packet).x, -15);
  assertEquals(attrs(packet).width, 30);
});

Deno.test("animation: filter variants are local and deterministically desynchronized", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

:legend
[A] -> [B]: sketch animate
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-sketch tp-animate" });
  const filter = matchChildEl(edge, "filter", { id: "tpc-flt-sketch-animate-0" });
  const animations = descendantsByTag(filter, "animate");
  const delay = String(attrs(edge).style).match(/--tp-animation-delay: ([^;]+)/)?.[1];

  assertEquals(attrs(edge).filter, "url(#tpc-flt-sketch-animate-0)");
  assertEquals(animations.length, 2);
  assertEquals(delay?.startsWith("-"), true);
  for (const animate of animations) assertEquals(attrs(animate).begin, delay);
});

Deno.test("animation: render parameter disables authored animation", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

:legend animation=false
[A] -> [B]: dashed sketch animate ping
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-dashed tp-sketch tp-animate tp-ping" });

  assertEquals(attrs(svgTree).class, "tp-animation-disabled");
  assertEquals(attrs(edge).filter, "url(#tpc-flt-sketch)");
  const particle = descendantsByTag(edge, "use");
  assertEquals(particle.length, 1);
  assertEquals(attrs(particle[0]).href, "#tpc-particle-ping");
  assertEquals(attrs(particle[0]).class, "tp tpc-particle tp-ping");
  assertEquals(descendantsByTag(edge, "animate").length, 0);
  const motion = descendantsByTag(edge, "animateMotion");
  assertEquals(motion.length, 1);
  assertEquals(attrs(motion[0]).repeatCount, "indefinite");
  const [start, end] = String(attrs(motion[0]).keyPoints).split(";");
  assertEquals(start, end);

  const fenced = buildSvgTree(parseTopos(input.replace(":legend animation=false", ":legend")), {
    parameters: { theme: "light", animation: "false" },
    override: true,
  });
  assertEquals(attrs(fenced).class, "tp-animation-disabled");
});

Deno.test("animation: static particles are distributed along the path", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

:legend
[A] -> [B]: spark particle-count=3 particle-phase=25
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-spark" });
  const particles = edge.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tpc-particle")
  );

  assertEquals(particles.length, 3);
  const positions = particles.map((particle) => {
    const motion = matchChildEl(particle, "animateMotion");
    const [from, to] = String(attrs(motion).keyPoints).split(";").map(Number);
    assertEquals(from, to);
    assertEquals(attrs(motion).keyTimes, "0;1");
    assertEquals(attrs(motion).calcMode, "linear");
    return from;
  });
  assertEquals(positions.every((position) => position > 0 && position < 1), true);
  assertEquals(positions[0] < positions[1] && positions[1] < positions[2], true);
});

Deno.test("animation: authored particle phase replaces automatic timing phase", () => {
  const input = `\
┌───┐         ┌───┐
│ A │────────▶│ B │
└───┘         └───┘

      ┌───┐         ┌───┐
      │ C │────────▶│ D │
      └───┘         └───┘

:legend
[A] -> [B]: spark animate particle-phase=50
[C] -> [D]: spark animate particle-phase=50
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const motions = root.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "g" && String(attrs(child).class).includes("tp-spark")
  ).map((edge) => attrs(matchChildEl(matchChildEl(edge, "use", { class: "tpc-particle" }), "animateMotion")));

  assertEquals(motions.length, 2);
  assertEquals(motions[0].begin, motions[1].begin);
  assertAlmostEquals(Number.parseFloat(String(motions[0].begin)), -Number.parseFloat(String(motions[0].dur)) / 2, 0.01);
});

Deno.test("animation: static ping remains stationary and delegates its pulse to the compendium", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

:legend
[A] -> [B]: ping
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-ping" });
  const particle = matchChildEl(edge, "use", { class: "tpc-particle tp-ping" });

  const [from, to] = String(attrs(matchChildEl(particle, "animateMotion")).keyPoints).split(";");
  assertEquals(from, to);
  assertEquals(attrs(particle).style, undefined);
});

Deno.test("animation: reverse, speed, count, and random spacing configure particles", () => {
  const input = `\
┌───┐   ┌───┐
│ A │──▶│ B │
└───┘   └───┘

:legend
[A] -> [B]: spark animate-reverse animation-speed=2 particle-count=3 particle-random=2
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edge = matchChildEl(root, "g", { class: "tp-animate-reverse tp-spark" });
  const particles = edge.slice(2).filter((child): child is XmlEl =>
    Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tpc-particle")
  );

  assertEquals(particles.length, 3);
  for (const particle of particles) {
    const motion = matchChildEl(particle, "animateMotion");
    const coordinates = String(attrs(motion).path).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const pathLength = Math.hypot(coordinates[2] - coordinates[0], coordinates[3] - coordinates[1]);
    const expectedDuration = ANIMATION_DURATION_SECONDS * pathLength / (10 * CHAR_WIDTH) / 2;
    assertAlmostEquals(Number.parseFloat(String(attrs(motion).dur)), expectedDuration);
    const [from, to] = String(attrs(motion).keyPoints).split(";").map(Number);
    assertEquals(from < 1 && to > 0 && from > to, true);
  }
});

Deno.test("animation: box particles follow the rendered rectangle", () => {
  const input = `\
┌───────────┐
│ Box       │
└───────────┘

:legend
Box: spark animate
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const box = matchChildEl(root, "g", { class: "tp-box tp-spark tp-animate" });
  const particle = matchChildEl(box, "use", { class: "tpc-particle tp-spark" });
  assertEquals(String(attrs(matchChildEl(particle, "animateMotion")).path).endsWith("Z"), true);
});

Deno.test("animation: phase zero starts at a sharp box corner", () => {
  const input = `\
┌───────────┐
│ Box       │
└───────────┘

:legend
Box: spark particle-phase=0
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const box = matchChildEl(root, "g", { class: "tp-box tp-spark" });
  const shape = matchChildEl(box, "rect", { class: "tp tpc-shape" });
  const motion = matchChildEl(matchChildEl(box, "use", { class: "tpc-particle tp-spark" }), "animateMotion");
  assertEquals(attrs(motion).keyPoints, "0;0");
  assertEquals(String(attrs(motion).path).startsWith(`M ${attrs(shape).x},${attrs(shape).y} `), true);
});

Deno.test("animation: box particles follow rounded and polygon perimeters", () => {
  const rounded = buildSvgTree(parseTopos(`\
┌───────────┐
│ Pill      │
└───────────┘

:legend
Pill: pill spark
`));
  const roundedRoot = matchChildEl(rounded, "g", { class: "tp-root" });
  const pill = matchChildEl(roundedRoot, "g", { class: "tp-box tp-pill tp-spark" });
  const pillShape = matchChildEl(pill, "rect", { class: "tp tpc-shape" });
  const pillMotion = matchChildEl(matchChildEl(pill, "use", { class: "tpc-particle tp-spark" }), "animateMotion");
  const pillAttrs = attrs(pillShape);
  assertEquals(
    String(attrs(pillMotion).path).startsWith(`M ${Number(pillAttrs.x) + Number(pillAttrs.rx)},${pillAttrs.y} `),
    true,
  );
  assertEquals(String(attrs(pillMotion).path).includes(" A "), true);

  const polygon = buildSvgTree(parseTopos(`\
┌───────────┐
│ Trapez    │
└───────────┘

:legend
Trapez: trapez spark
`));
  const polygonRoot = matchChildEl(polygon, "g", { class: "tp-root" });
  const trapez = matchChildEl(polygonRoot, "g", { class: "tp-box tp-trapez tp-spark" });
  const trapezShape = matchChildEl(trapez, "polygon", { class: "tp tpc-shape" });
  const trapezMotion = matchChildEl(matchChildEl(trapez, "use", { class: "tpc-particle tp-spark" }), "animateMotion");
  assertEquals(attrs(trapezMotion).path, `M ${String(attrs(trapezShape).points).replaceAll(" ", " L ")} Z`);
});

Deno.test("animation: particle density scales count with path length", () => {
  const input = `\
┌───────────┐
│ Box       │
└───────────┘

:legend
Box: spark particle-density=2
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const box = matchChildEl(root, "g", { class: "tp-box tp-spark" });
  const particles = box.slice(2).filter((child) =>
    Array.isArray(child) && child[0] === "use" && String(attrs(child).class).includes("tpc-particle")
  );

  assertEquals(particles.length > 1, true);
});

Deno.test("block arrows: shared filters", () => {
  const input = `\
┌───┐             ┌───┐
│ A │────────────▶│ B │
└───┘             └───┘

:legend
[A] -> [B]: block chalk
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edgeGrp = matchChildEl(root, "g", { class: "tp-block" });

  const polygon = matchChildEl(edgeGrp, "polygon", { class: "tp tpc-shape" });
  assertEquals(attrs(edgeGrp).filter, "url(#tpc-flt-chalk)", "Fat edge group should receive the filter");
  assertEquals(attrs(polygon).filter, undefined);
});

Deno.test("edge styles: ray draws a straight line between node centers", () => {
  const input = `\
┌───┐   
│ A │
└───┘
  │
  └──▶ [B]

:legend
[A] -> [B]: ray
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edgeGrp = matchChildEl(root, "g", { class: "tp-ray" });
  const path = matchChildEl(edgeGrp, "path", { class: "tp tpc-shape" });
  const d = attrs(path).d as string;
  // It should be a single line segment from center to center (trimmed), so M and one L.
  const commands = d.split(" ").filter((c) => c === "M" || c === "L" || c === "Q" || c === "Z");
  assertEquals(commands.length, 2, "Ray edge should be a single straight segment (M ... L ...)");
});

Deno.test("edge styles: path preserves split stem junctions", () => {
  const input = `\
A ───┬──▶ B
     │
     └──┬──▶ C
        │
        ▼
        D
`;
  const svgTree = buildSvgTree(parseTopos(input));
  const paths = descendantsByTag(svgTree, "path")
    .filter((path) => attrs(path).class === "tp tpc-shape")
    .map((path) => attrs(path).d);

  assertEquals(paths, [
    "M 28.8,12 L 129.6,12",
    "M 79.2,12 L 79.2,60 L 172.8,60",
    "M 122.4,60 L 122.4,120",
  ]);
});

Deno.test("edge styles: taut draws a straight line between node anchors", () => {
  const input = `\
┌───┐   
│ A │
└───┘
  │
  └──▶ [B]

:legend
[A] -> [B]: taut
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });
  const edgeGrp = matchChildEl(root, "g", { class: "tp-taut" });
  const path = matchChildEl(edgeGrp, "path", { class: "tp tpc-shape" });
  const d = attrs(path).d as string;
  // It should be a single line segment from anchor to anchor (trimmed), so M and one L.
  const commands = d.split(" ").filter((c) => c === "M" || c === "L" || c === "Q" || c === "Z");
  assertEquals(commands.length, 2, "Taut edge should be a single straight segment (M ... L ...)");
  const targetBounds = nodeRenderedBoundsPx(ast.nodes.find((node) => node.label === "B")!);
  const [x, y] = d.split(" ").at(-1)!.split(",").map(Number);
  assertAlmostEquals(x, targetBounds.x - 2, 0.02);
  assert(y >= targetBounds.y && y <= targetBounds.y + targetBounds.h);
});

Deno.test("edge styles: ray handles double branching from the resolved source", () => {
  const input = `\
A ───┬──▶ B
     │
     └──┬──▶ C
        │
        ▼
        D

:legend
*: ray
`;
  const ast = parseTopos(input);
  const svgTree = buildSvgTree(ast);
  const root = matchChildEl(svgTree, "g", { class: "tp-root" });

  const edges = (root as XmlEl).slice(2).filter((c): c is XmlEl =>
    Array.isArray(c) && c[0] === "g" && String(attrs(c).class || "").includes("tp-edge")
  );
  assertEquals(edges.length, 3, "Expected 3 edges to be rendered");

  const sourceBounds = nodeRenderedBoundsPx(ast.nodes.find((node) => node.label === "A")!);

  for (const edgeGrp of edges) {
    const path = matchChildEl(edgeGrp, "path", { class: "tp tpc-shape" });
    const d = attrs(path).d as string;
    const commands = d.split(" ").filter((c) => c === "M" || c === "L" || c === "Q" || c === "Z");
    assertEquals(commands.length, 2, "Ray branch edge should be a single straight segment");

    const [x, y] = d.split(" ")[1].split(",").map(Number);
    const onHorizontalBorder = (y === sourceBounds.y || y === sourceBounds.y + sourceBounds.h) &&
      x >= sourceBounds.x && x <= sourceBounds.x + sourceBounds.w;
    const onVerticalBorder = (x === sourceBounds.x || x === sourceBounds.x + sourceBounds.w) &&
      y >= sourceBounds.y && y <= sourceBounds.y + sourceBounds.h;
    assert(onHorizontalBorder || onVerticalBorder, "Ray branch should originate on the resolved source boundary");
  }
});
