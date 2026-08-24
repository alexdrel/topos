import { assertEquals } from "@std/assert";
import { testParseDiagram, testCompleted, flushPendingWrites, matchChild } from "../../test/test-utils.ts";
import { parseTopos } from "../../topos.ts";

Deno.test.afterEach(flushPendingWrites);

Deno.test("Region: outer borders grow beyond content without shifting it", (t) => {
  const map = `\
## R
┌───┐
│ A │
└───┘`;

  const diagram = testParseDiagram(t, map);
  const region = matchChild(diagram.root, { label: "R", nodeType: "region" }, 0, 1);
  const box = matchChild(region, { label: "A", nodeType: "box" }, 0, 1);

  assertEquals(box.x, 0);
  assertEquals(region.x, -1);
  assertEquals(region.x + region.w, box.x + box.w + 1);
  assertEquals(diagram.root.x, -1);
  assertEquals(diagram.root.x + diagram.root.w, region.x + region.w);
  testCompleted(t);
});

Deno.test("Region: outer left margin is independent of content spacing", (t) => {
  for (
    const map of [
      `\
 ## R1

 [ A ]      [ B ]       [ C ]`,
      `\
 ## R1

[ A ]       [ B ]       [ C ]`,
    ]
  ) {
    const diagram = testParseDiagram(t, map);
    const region = matchChild(diagram.root, { label: "R1", nodeType: "region" }, 0, 1);
    const boxA = region.children.find((node) => node.label === "A" && node.nodeType === "inline")!;

    assertEquals(boxA.x - region.x, 1);
  }
  testCompleted(t);
});

Deno.test("Region: explicit zero viewport padding does not preserve source indentation", () => {
  const diagram = parseTopos(`\
:map
  ## R1

  [ A ]
:legend padx=0
`);
  const region = diagram.nodes.find((node) => node.label === "R1" && node.nodeType === "region")!;
  const boxA = diagram.nodes.find((node) => node.label === "A" && node.nodeType === "inline")!;

  assertEquals(boxA.x - region.x, 1);
});

Deno.test("Region: authored space between its label and content is preserved", () => {
  const diagram = parseTopos(`\
## R1

   [ A ] [ B ] [ C ]
`);
  const region = diagram.nodes.find((node) => node.label === "R1" && node.nodeType === "region")!;
  const boxA = diagram.nodes.find((node) => node.label === "A" && node.nodeType === "inline")!;

  assertEquals(boxA.x - region.x, 3);
});

Deno.test("Region: explicit selectors promote root notes into regions", (t) => {
  const map = `\
## EARTH                                          ## MARS

   ┌─────────────────┐                             ┌──────────────┐
   │ Mission Control │---------------------------->│ Mars Orbiter │
   └─────────────────┘                             └──────────────┘`;

  const diagram = testParseDiagram(t, map);
  const earth = matchChild(diagram.root, { label: "EARTH", nodeType: "region" }, 0, 2);
  const mars = matchChild(diagram.root, { label: "MARS", nodeType: "region" }, 1, 2);
  const mission = matchChild(
    earth,
    { label: "Mission Control", nodeType: "box" },
    0,
    1,
  );
  const orbiter = matchChild(mars, { label: "Mars Orbiter", nodeType: "box" }, 0, 1);

  assertEquals(earth.h > mission.y + mission.h - earth.y, true);
  assertEquals(mars.h > orbiter.y + orbiter.h - mars.y, true);
  testCompleted(t);
});

Deno.test("Region: 2x2 layouts assign lower-row content to lower regions", (t) => {
  const map = `\
## EARTH ORBIT                                     ## MARS ORBIT

  ┌──────┐  ┌────────┐                                ┌──────────────────────────┐
  │ TDRS │──│ Relay  ◀────────────────────────────────┤       Mars Orbiter       │
  └──────┘  └───┬────┘                                └──────────────────────────┘
                │                                                 ▲
                │                                                 │
  ┌────────┐    │                                                 │
  │ Hubble ├────┘                                                 │
  └────────┘                                                      │
                                                                  │
## EARTH                                           ## MARS        │
                                                                  │
  ┌──────────────────────────┐                                    │
  │     Mission Control      ├────────────────────────────────────┘
  │                          │◄────Telemetry─╮  ┌─ROVERS──────────────────────────┐
  └──────────────────────────┘               │  │                                 │
                                             ╰──┤    Opportunity                  │
                                                │                                 │
                                                │    Curiosity                    │
  ┌─OBSERVATORIES────────────┐                  │                                 │
  │                          │                  └─────────────────────────────────┘
  │  ┌────────┐  ┌────────┐  │
  │  │   US   │  │   EU   │  │
  │  └────────┘  └────────┘  │
  └──────────────────────────┘`;

  const diagram = testParseDiagram(t, map);
  const earth = matchChild(diagram.root, { label: "EARTH", nodeType: "region" }, 2, 4);
  const mars = matchChild(diagram.root, { label: "MARS", nodeType: "region" }, 3, 4);

  matchChild(earth, { label: "Mission Control", nodeType: "box" }, 0, 2);
  matchChild(earth, { label: "OBSERVATORIES", nodeType: "box" }, 1, 2);
  matchChild(mars, { label: "ROVERS", nodeType: "box" }, 0, 1);
  testCompleted(t);
});

Deno.test("Region: 2x2 layouts with skewed labels 1", (t) => {
  const map = `\
## EARTH ORBIT                                     ## MARS ORBIT
            ┌────────┐                          ┌──────────────────┐
            │  TDRS  ◀──────────────────────────┤   Mars Orbiter   │
            └───┬────┘                          └────────▲───▲─────┘
                │                                        │   │
                │                                        │   │
                │       ┌────────────────────────────────┘   │
                │       │                                    │
                │       │                                    │
## EARTH        │       │                        ## MARS     │
                │       │                                    │
                │       │                                    │
                ▼       │                                    │
    ┌─OBSERVATORIES─────┴──────┐                ┌─ROVERS─────▼──────┐
    │                          │                │                   │
    │  ┌────────┐  ┌────────┐  │                │   Opportunity     │
    │  │   US   │  │   EU   │  ◀──Telemetry─────┤   Perseverance    │
    │  └────────┘  └────────┘  │                │   Curiosity       │
    └───────────▲──────────────┘                │   Spirit          │
                │                               └───────────────────┘
                │
                │
    ┌───────────▼──────────────┐
    │     Mission Control      │
    │                          │
    └──────────────────────────┘
`;

  const diagram = testParseDiagram(t, map);
  const _earthOrbit = matchChild(diagram.root, { label: "EARTH ORBIT", nodeType: "region" }, 0, 4);
  const _marsOrbit = matchChild(diagram.root, { label: "MARS ORBIT", nodeType: "region" }, 1, 4);
  const earth = matchChild(diagram.root, { label: "EARTH", nodeType: "region" }, 2, 4);
  const mars = matchChild(diagram.root, { label: "MARS", nodeType: "region" }, 3, 4);

  matchChild(earth, { label: "OBSERVATORIES", nodeType: "box" }, 0, 2);
  matchChild(earth, { label: "Mission Control", nodeType: "box" }, 1, 2);
  matchChild(mars, { label: "ROVERS", nodeType: "box" }, 0, 1);
  testCompleted(t);
});

Deno.test("Region: 2x2 layouts with skewed labels 2", (t) => {
  const map = `\
## EARTH ORBIT                                     ## MARS ORBIT
            ┌────────┐                          ┌──────────────────┐
            │  TDRS  ◀──────────────────────────┤   Mars Orbiter   │
            └───┬────┘                          └────────▲───▲─────┘
                │                                        │   │
                │                                        │   │
                │       ┌────────────────────────────────┘   │
                │       │                                    │
                │       │                                    │
## EARTH        │       │                                    │
                │       │                        ## MARS     │
                │       │                                    │
                ▼       │                                    │
    ┌─OBSERVATORIES─────┴──────┐                ┌─ROVERS─────▼──────┐
    │                          │                │                   │
    │  ┌────────┐  ┌────────┐  │                │   Opportunity     │
    │  │   US   │  │   EU   │  ◀──Telemetry─────┤   Perseverance    │
    │  └────────┘  └────────┘  │                │   Curiosity       │
    └───────────▲──────────────┘                │   Spirit          │
                │                               └───────────────────┘
                │
                │
    ┌───────────▼──────────────┐
    │     Mission Control      │
    │                          │
    └──────────────────────────┘
`;

  const diagram = testParseDiagram(t, map);
  const _earthOrbit = matchChild(diagram.root, { label: "EARTH ORBIT", nodeType: "region" }, 0, 4);
  const _marsOrbit = matchChild(diagram.root, { label: "MARS ORBIT", nodeType: "region" }, 1, 4);
  const earth = matchChild(diagram.root, { label: "EARTH", nodeType: "region" }, 2, 4);
  const mars = matchChild(diagram.root, { label: "MARS", nodeType: "region" }, 3, 4);

  matchChild(earth, { label: "OBSERVATORIES", nodeType: "box" }, 0, 2);
  matchChild(earth, { label: "Mission Control", nodeType: "box" }, 1, 2);
  matchChild(mars, { label: "ROVERS", nodeType: "box" }, 0, 1);
  testCompleted(t);
});

Deno.test("Region: pure column layouts resolve correctly", (t) => {
  const map = `\
          ## EARTH                                       ## MARS


  ┌─────────────────┐                                        ┌──────────────┐
  │ Mission Control │ ────────Daily Route Program───────────⯈│ Mars Orbiter │
  └─────────────────┘                                        └──────┬───────┘
                                                                    │
                                                                    ▼
                                                             ┌─ROVERS───────┐
                                                             │              │
                                                             │  Opportunity │
                                                             │              │
                                                             │   Curiosity  │
                                                             │              │
                                                             └──────────────┘`;

  const diagram = testParseDiagram(t, map);
  const earth = matchChild(diagram.root, { label: "EARTH", nodeType: "region" }, 0, 2);
  const mars = matchChild(diagram.root, { label: "MARS", nodeType: "region" }, 1, 2);

  matchChild(earth, { label: "Mission Control", nodeType: "box" }, 0, 1);
  matchChild(mars, { label: "Mars Orbiter", nodeType: "box" }, 0, 2);
  testCompleted(t);
});

Deno.test("Region: vertical layouts leave top header notes outside the first region", (t) => {
  const map = `\
  # Top-Level Header Note

## FILTERS

   ┌─────────┐
   │  xkcd   │
   └─────────┘`;

  const diagram = testParseDiagram(t, map);
  const filters = matchChild(diagram.root, { label: "FILTERS", nodeType: "region" }, 0, 1);

  // The header note is promoted to root labels and is outside the FILTERS region.
  assertEquals(diagram.root.label, "Top-Level Header Note");
  assertEquals(filters.y, 2);

  // The xkcd box should be inside the FILTERS region.
  matchChild(filters, { label: "xkcd", nodeType: "box" });
  testCompleted(t);
});

Deno.test("Region: distinct vertically stacked regions do not merge on large maps", (t) => {
  const map = `\
  # Top-Level Header Note

## FILTERS

   ┌─────────┐
   │  xkcd   │
   └─────────┘

## SYMBOLS

   ┌─────────┐
   │  file   │
   └─────────┘` + "\n".repeat(80);

  const diagram = testParseDiagram(t, map);

  // We expect exactly 2 distinct region children stacked vertically.
  const filters = matchChild(diagram.root, { label: "FILTERS", nodeType: "region" }, 0, 2);
  const symbols = matchChild(diagram.root, { label: "SYMBOLS", nodeType: "region" }, 1, 2);

  assertEquals(filters.y < symbols.y, true);
  assertEquals(filters.y + filters.h <= symbols.y, true);
  testCompleted(t);
});

Deno.test("Region: mixed-columns layout allows grids and varying widths", (t) => {
  const map = `\
  ## R1

     [ A ] [ B ] [ C ]

  ## R2.A          ## R2.B

     [ D ] [ E ]   [ F ] [ G ]

  ## R3.A          ## R3.B

     [ H ] [ I ]   [ J ] [ K ]

  ## R4

     [ L ] [ M ] [ N ]

  ## R5.A   ## R5.B   ## R5.C

     [ O ]  [ P ]     [ Q ]

  ## R6.A   ## R6.B   ## R6.C

     [ R ]  [ S ]     [ T ]

  ## R7.A   ## R7.B   ## R7.C

     [ U ]  [ V ]     [ W ]`;

  const diagram = testParseDiagram(t, map);

  // 15 regions: R1, R2.A/B, R3.A/B, R4, R5.A/B/C, R6.A/B/C, R7.A/B/C
  const r1 = matchChild(diagram.root, { label: "R1", nodeType: "region" }, 0, 15);
  const r2a = matchChild(diagram.root, { label: "R2.A", nodeType: "region" }, 1, 15);
  const r2b = matchChild(diagram.root, { label: "R2.B", nodeType: "region" }, 2, 15);
  const r3a = matchChild(diagram.root, { label: "R3.A", nodeType: "region" }, 3, 15);
  const r3b = matchChild(diagram.root, { label: "R3.B", nodeType: "region" }, 4, 15);
  const r4 = matchChild(diagram.root, { label: "R4", nodeType: "region" }, 5, 15);
  const r5a = matchChild(diagram.root, { label: "R5.A", nodeType: "region" }, 6, 15);
  const r5b = matchChild(diagram.root, { label: "R5.B", nodeType: "region" }, 7, 15);
  const r5c = matchChild(diagram.root, { label: "R5.C", nodeType: "region" }, 8, 15);
  const r6a = matchChild(diagram.root, { label: "R6.A", nodeType: "region" }, 9, 15);
  const r6b = matchChild(diagram.root, { label: "R6.B", nodeType: "region" }, 10, 15);
  const r6c = matchChild(diagram.root, { label: "R6.C", nodeType: "region" }, 11, 15);
  const r7a = matchChild(diagram.root, { label: "R7.A", nodeType: "region" }, 12, 15);
  const r7b = matchChild(diagram.root, { label: "R7.B", nodeType: "region" }, 13, 15);
  const r7c = matchChild(diagram.root, { label: "R7.C", nodeType: "region" }, 14, 15);

  // R1 and R4 are full-width (start at same x as r1, end at same right edge)
  assertEquals(r1.x, r4.x, "R1 and R4 share left edge (full-width)");
  assertEquals(r1.x + r1.w, r4.x + r4.w, "R1 and R4 share right edge (full-width)");
  assertEquals([r1, r2a, r3a, r4, r5a, r6a, r7a].map((region) => region.x), Array(7).fill(r1.x), "Every row shares its outer left edge");
  assertEquals(
    [r1, r2b, r3b, r4, r5c, r6c, r7c].map((region) => region.x + region.w),
    Array(7).fill(r1.x + r1.w),
    "Every row shares its outer right edge",
  );

  // R2 and R3 form a 2-col block: .A columns align, .B columns align
  assertEquals(r2a.x, r3a.x, "R2.A and R3.A share left edge");
  assertEquals(r2a.w, r3a.w, "R2.A and R3.A have same width");
  assertEquals(r2b.x, r3b.x, "R2.B and R3.B share left edge");
  assertEquals(r2b.w, r3b.w, "R2.B and R3.B have same width");

  // R5/R6/R7 form a 3-col block: all A/B/C columns align vertically and have same width
  assertEquals(r5a.x, r6a.x, "R5.A and R6.A share left edge");
  assertEquals(r6a.x, r7a.x, "R6.A and R7.A share left edge");
  assertEquals(r5b.x, r6b.x, "R5.B and R6.B share left edge");
  assertEquals(r6b.x, r7b.x, "R6.B and R7.B share left edge");
  assertEquals(r5c.x, r6c.x, "R5.C and R6.C share left edge");
  assertEquals(r6c.x, r7c.x, "R6.C and R7.C share left edge");

  assertEquals(r5a.w, r6a.w, "R5.A and R6.A have same width");
  assertEquals(r6a.w, r7a.w, "R6.A and R7.A have same width");
  assertEquals(r5b.w, r6b.w, "R5.B and R6.B have same width");
  assertEquals(r6b.w, r7b.w, "R6.B and R7.B have same width");
  assertEquals(r5c.w, r6c.w, "R5.C and R6.C have same width");
  assertEquals(r6c.w, r7c.w, "R6.C and R7.C have same width");

  // Rows are stacked top-to-bottom
  assertEquals(r1.y < r2a.y, true, "R1 is above R2");
  assertEquals(r2a.y < r3a.y, true, "R2 is above R3");
  assertEquals(r3a.y < r4.y, true, "R3 is above R4");
  assertEquals(r4.y < r5a.y, true, "R4 is above R5");
  assertEquals(r5a.y < r6a.y, true, "R5 is above R6");
  assertEquals(r6a.y < r7a.y, true, "R6 is above R7");

  // Rows don't overlap vertically
  assertEquals(r1.y + r1.h <= r2a.y, true, "R1 and R2 don't overlap");
  assertEquals(r4.y + r4.h <= r5a.y, true, "R4 and R5 don't overlap");

  // Content is reparented to the correct region (including E/I in R2.A/R3.A)
  matchChild(r2a, { label: "D", nodeType: "inline" }, 0, 2);
  matchChild(r2a, { label: "E", nodeType: "inline" }, 1, 2);
  matchChild(r2b, { label: "F", nodeType: "inline" }, 0, 2);
  matchChild(r2b, { label: "G", nodeType: "inline" }, 1, 2);
  matchChild(r3a, { label: "H", nodeType: "inline" }, 0, 2);
  matchChild(r3a, { label: "I", nodeType: "inline" }, 1, 2);
  matchChild(r3b, { label: "J", nodeType: "inline" }, 0, 2);
  matchChild(r3b, { label: "K", nodeType: "inline" }, 1, 2);

  testCompleted(t);
});

Deno.test("Region: mixed-columns layout with shifted column seed", (t) => {
  const map = `\
  ## R1

     [ A ] [ B ] [ C ]

  ## R2.A        ## R2.B

     [ D ] [ E ]   [ F ] [ G ]

  ## R3.A          ## R3.B

     [ H ] [ I ]   [ J ] [ K ]`;

  const diagram = testParseDiagram(t, map);

  const r2a = matchChild(diagram.root, { label: "R2.A", nodeType: "region" }, 1, 5);
  const r2b = matchChild(diagram.root, { label: "R2.B", nodeType: "region" }, 2, 5);
  const r3a = matchChild(diagram.root, { label: "R3.A", nodeType: "region" }, 3, 5);
  const r3b = matchChild(diagram.root, { label: "R3.B", nodeType: "region" }, 4, 5);

  // Content is reparented to the correct region (including E/I in R2.A/R3.A)
  matchChild(r2a, { label: "D", nodeType: "inline" }, 0, 2);
  matchChild(r2a, { label: "E", nodeType: "inline" }, 1, 2);
  matchChild(r2b, { label: "F", nodeType: "inline" }, 0, 2);
  matchChild(r2b, { label: "G", nodeType: "inline" }, 1, 2);
  matchChild(r3a, { label: "H", nodeType: "inline" }, 0, 2);
  matchChild(r3a, { label: "I", nodeType: "inline" }, 1, 2);
  matchChild(r3b, { label: "J", nodeType: "inline" }, 0, 2);
  matchChild(r3b, { label: "K", nodeType: "inline" }, 1, 2);

  testCompleted(t);
});

Deno.test("Region: mixed-columns layout where box is pushed to right column", (t) => {
  const map = `\
  ## R2.A      ## R2.B

     [ D ] [ E ]   [ F ] [ G ]`;

  const diagram = testParseDiagram(t, map);

  const r2a = matchChild(diagram.root, { label: "R2.A", nodeType: "region" }, 0, 2);
  const r2b = matchChild(diagram.root, { label: "R2.B", nodeType: "region" }, 1, 2);

  // D is in R2.A
  matchChild(r2a, { label: "D", nodeType: "inline" }, 0, 1);

  // E, F, G are in R2.B
  matchChild(r2b, { label: "E", nodeType: "inline" }, 0, 3);
  matchChild(r2b, { label: "F", nodeType: "inline" }, 1, 3);
  matchChild(r2b, { label: "G", nodeType: "inline" }, 2, 3);

  testCompleted(t);
});
