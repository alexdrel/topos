import { assert } from "@std/assert";
import { testParseDiagram, testCompleted, flushPendingWrites } from '../../test/test-utils.ts';

import { matchChild, matchEdge } from '../../test/test-utils.ts';

Deno.test.afterEach(flushPendingWrites);


Deno.test("Mars Rover Diagram", (t) => {
  const diagram = `\
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
                                                             └──────────────┘
`;

  const root = testParseDiagram(t, diagram).root;
  const earth = matchChild(root, { label: "EARTH", nodeType: "region", $children: 1 }, 0, 2);
  const mars = matchChild(root, { label: "MARS", nodeType: "region", $children: 2 }, 1, 2);

  const missionControl = matchChild(earth, { label: "Mission Control" }, 0, 1);
  const marsOrbiter = matchChild(mars, { label: "Mars Orbiter" }, 0, 2);
  const rovers = matchChild(mars, { label: "ROVERS", $children: 2 }, 1, 2);

  matchEdge(root, { direction: 'uni', source: missionControl, target: marsOrbiter }, 0, 1);
  matchEdge(mars, { direction: 'uni', source: marsOrbiter, target: rovers }, 0, 1);

  matchChild(rovers, { label: "Opportunity" }, 0, 2);
  matchChild(rovers, { label: "Curiosity" }, 1, 2);
  testCompleted(t);
});

Deno.test("Sample Arch", (t) => {
  const diagram = `\
                  ╭┈┈┈┈┈┈┈┈┈┈┈┈┈┈Back-End┈┈┈┈┈┈┈┈┈┈┈┈┈┈╮
  ┏━━━━━━━━┓      ┊                                    ┊
  ┃        ┃      ┊     ┌─────────┐          ┌──────┐  ┊
  ┃ Client ┠──┬───┼────▶│ Gateway │┄┄┄┄┄┄┄┄┄▶│ Auth │  ┊
  ┃        ┃  │   ┊     └────┬────┘          └──────┘  ┊
  ┗━━━━━━━━┛  │   ┊          │                         ┊
              │   ┊          ▼                         ┊
              │   ┊   ┏━━━━━━━━━━━━━━┓                 ┊
  ┏━━━━━━━━┓  │   ┊   ┃ Service Mesh ┃                 ┊
  ┃        ┃  │   ┊   ┗━━━━━━┯━━━━━━━┛                 ┊
  ┃   Web  ┠──┘   ┊          │                         ┊
  ┃        ┃      ┊          ├─────────────┐           ┊
  ┗━━━━━━━━┛      ┊          │             │           ┊
                  ┊          │             │           ┊
                  ┊          ▼             ▽           ┊
                  ┊     ┌──────────┐   ┌───────┐       ┊
                  ┊     │ Postgres │   │ Redis │       ┊
                  ┊     └──────────┘   └───────┘       ┊
                  ┊                                    ┊
                  ╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈╯
`;
  const root = testParseDiagram(t, diagram).root;
  const backend = matchChild(root, { label: "Back-End", nodeType: "box", $children: 5 }, 0, 3);
  const client = matchChild(root, { label: "Client", nodeType: "box" }, 1, 3);
  const web = matchChild(root, { label: "Web", nodeType: "box" }, 2, 3);

  const gateway = matchChild(backend, { label: "Gateway", nodeType: "box" }, 0, 5);
  const auth = matchChild(backend, { label: "Auth", nodeType: "box" }, 1, 5);
  const serviceMesh = matchChild(backend, { label: "Service Mesh", nodeType: "box" }, 2, 5);
  const postgres = matchChild(backend, { label: "Postgres", nodeType: "box" }, 3, 5);
  const redis = matchChild(backend, { label: "Redis", nodeType: "box" }, 4, 5);

  const clientGateway = matchEdge(root, { direction: "uni", source: client, target: gateway }, 0, 2);
  const webBranch = matchEdge(root, { direction: "none", source: client, target: web }, 1, 2);
  matchEdge(backend, { direction: "uni", source: gateway, target: auth }, 0, 4);
  matchEdge(backend, { direction: "uni", source: gateway, target: serviceMesh }, 1, 4);
  const postgresStem = matchEdge(backend, { direction: "uni", source: serviceMesh, target: postgres }, 2, 4);
  const redisBranch = matchEdge(backend, { direction: "uni", source: serviceMesh, target: redis }, 3, 4);

  assert(webBranch.source.stem === clientGateway);
  assert(redisBranch.source.stem === postgresStem);
  testCompleted(t);
});

Deno.test("Extreme Connections", (t) => {
  const diagram = `
   ╭────────────────────────────────────╮
   │                Top                 │
   │                ┏━━━━━━━━━━━━━━━┓   │
   │      ┌─────────┨               ┃   │
   │  ╔═══●════╗    ┃               ┃   │
   │  ║        ║    ┃      CC       ┃   │
   │  ║   DD   ║    ┃               ┃   │
   │  ║        ║    ┃               ┃   │
   │  ╚═════□══╝    ┗━━━━━━━━▲━━━━━━┛   │
   │        │                ┃          │
   ╰────────┼────────────────╂──────────╯
            │                ┃
            │                ┃
            └──────┐         ┗━━Foo━┓
                   │                ┃
         ┏━━━━━━━━━┿━━ Bottom ━━━━━━╋━━━━━━━━━━┓
         ┃         │                ┃          ┃
         ┃         │                ┃          ┃
         ┃    ┌────▼─────┐      ┌───◆───┐      ┃
         ┃    │          │      │       │      ┃
         ┃    │    AA    ├─────▶│  BB   │      ┃
         ┃    │          │      │       │      ┃
         ┃    └────▲─────┘      └───┬───┘      ┃
         ┃         │                │          ┃
         ┃         └─────── Bar ────┘          ┃
         ┃                                     ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
`;

  // Parse
  const root = testParseDiagram(t, diagram).root;

  // Verify Boxes
  // Top Level
  const top = matchChild(root, { label: "Top" }, 0, 2);
  const bottom = matchChild(root, { label: "Bottom" }, 1, 2);

  // Top Level Boxes
  const cc = matchChild(top, { label: "CC" }, 0, 2);
  const dd = matchChild(top, { label: "DD" }, 1, 2);
  const ddTopPort = matchChild(dd, { nodeType: "hub", glyph: "●" }, 0, 2);
  const ddBottomPort = matchChild(dd, { nodeType: "hub", glyph: "□" }, 1, 2);

  // Bottom Level Boxes
  const aa = matchChild(bottom, { label: "AA" }, 0, 2);
  const bb = matchChild(bottom, { label: "BB" }, 1, 2);
  const bbPort = matchChild(bb, { nodeType: "hub", glyph: "◆" }, 0, 1);

  // Verify Edges
  // 1. DD port to CC (line with corner) - inside Top
  matchEdge(top, { direction: 'none', source: ddTopPort, target: cc }, 0, 1);

  // 2. DD port to AA (junction path) - crossing boundary, remains in Root
  matchEdge(root, { direction: 'uni', source: ddBottomPort, target: aa }, 1, 2);

  // 3. AA to BB (direct arrow) - inside Bottom
  matchEdge(bottom, { direction: 'uni', source: aa, target: bb }, 0, 2);

  // 4. BB port to CC (with Foo label) - crossing boundary, remains in Root
  matchEdge(root, { label: "Foo", direction: 'uni', source: bbPort, target: cc }, 0, 2);

  // 5. BB to AA (path through junction) - bottom
  matchEdge(bottom, { label: "Bar", direction: 'uni', source: bb, target: aa }, 1, 2);
  testCompleted(t);
});
