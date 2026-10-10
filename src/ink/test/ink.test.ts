import { test } from "node:test";
import { deepStrictEqual as assertEquals } from "node:assert/strict";
import { Dir } from "../../geo.ts";
import { projectTracesToGrid } from "../ink.ts";
import { renderToText } from "../ast-ink.ts";
import { parseTopos } from "../../topos.ts";
import { traceMap } from "../../trace/trace-map.ts";

function assertRoundTrip(source: string) {
  const lines = source.split('\n');
  const normSource = lines
    .map(l => l.trimEnd())
    .filter((l, i, a) => !((i === 0 || i === a.length - 1) && l === ''))
    .join('\n');

  const ast = parseTopos(normSource);
  const projected = renderToText(ast);
  assertEquals(projected, normSource);

  const traces = traceMap(normSource);
  const projectedTraces = projectTracesToGrid(traces).text;
  assertEquals(projectedTraces, normSource);
}

test("ink: simple round-trip (boxes and rawLabels)", () => {
  assertRoundTrip(`
┌───────┐
│ Topos │
└───────┘`);
});

test("ink: visible space glyph round-trips", () => {
  assertRoundTrip("A␠B");
  assertRoundTrip("A⍽B");
});

test("ink: ascii boxes", () => {
  assertRoundTrip(`
+-------+
| ASCII |
+-------+`);
});

test("ink: mixed pens", () => {
  assertRoundTrip(`
 ┏━━━━━━┓ ┌──────┐
 ┃ Bold ┃ │Single│
 ┗━━━━━━┛ └──────┘`);
});

test("ink: single line preserves a bold box tee", () => {
  const source = `\
┏━━━┓
┃ C ┠───>
┗━━━┛`;
  const traces = traceMap(source);
  const line = traces.traces.find((trace) => trace.type === "line");

  assertEquals(line?.source?.dir, Dir.None);
  assertEquals(projectTracesToGrid(traces).text, source);
});

test("ink: malformed box candidates round-trip", async (t) => {
  const cases = [
    {
      name: "broken rounded bottom corner",
      source: `\
╭────╮
│ A  │
 ╰───╯`,
    },
    {
      name: "broken double bottom corner",
      source: `\
╔════╗
║ B  ║
 ╚═══╝`,
    },
    {
      name: "horizontal lines only",
      source: `\
---------
---------`,
    },
    {
      name: "vertical lines only",
      source: `\
||
||`,
    },
    {
      name: "broken corner",
      source: `\
+----+
| A  |
 ----+`,
    },
    {
      name: "missing bottom edge",
      source: `\
+----+
| A  |`,
    },
    {
      name: "broken top edges",
      source: `\
┌─    X     │───┐
└───────────────┘
┌─│   X      ───┐
└───────────────┘
┌─│   X     │───┐
└───────────────┘`,
    },
    {
      name: "valid and invalid boxes together",
      source: `\
┌─────┐  +----+
│ OK  │  | No |
└─────┘  +--- +`,
    },
  ];

  for (const { name, source } of cases) {
    await t.test(name, () => assertRoundTrip(source));
  }
});

test("ink: simple edge", () => {
  assertRoundTrip(`
  ┌───┐  ┌───┐
  │ A ├──┤ B │
  └───┘  └───┘`);
});

test("ink: directed arrow", () => {
  assertRoundTrip(`
  ┌───┐    ┌───┐
  │ A ├───>│ B │
  └───┘    └───┘`);
});

test("ink: complex grid junction", () => {
  assertRoundTrip(`
┌─┬─┐
│ │ │
├─┼─┤
│ │ │
└─┴─┘`);
});


test("ink: nested boxes", () => {
  assertRoundTrip(`
┌───────────┐
│ Parent    │
│  ┌─────┐  │
│  │Child│  │
│  └─────┘  │
└───────────┘`);
});

test("ink: crossing edges (bridge)", () => {
  assertRoundTrip(`
  A     B
  │     │
──┼─────┼──
  │     │
  C     D`);
});

test("ink: editor default map", () => {
  assertRoundTrip(`
┌─────────────┐    ┌──────────┐
│ API Gateway ├───>│  Worker  │
└──────┬──────┘    └────┬─────┘
       │                │
       v                v
   ┌────────┐      ┌──────────┐
   │ Cache  │      │ Database │
   └────────┘      └──────────┘`);
});

test("ink: Extreme Connections round-trip", () => {
  assertRoundTrip(`
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
         `);
});

test("ink: preserves padding and empty lines", () => {
  assertRoundTrip(`\
   
  ┌───┐
  └───┘
   
    ┌───┐
    └───┘  
`);
});

test("ink: stack boxes", () => {
  assertRoundTrip(`\
   ┌────────────────┐    
   │ ┌──────────────┴─┐  
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └────────────────┘
`);
});

test("ink: stack boxes 2", () => {
  assertRoundTrip(`\
   ┌─STACK────────┐    
   │┌─────────────┴┐  
   ││┌─────────────┴┐
   └┤│       2      │
    └┤              │
     └──────────────┘
`);
});

test("ink: stack boxes all directions", () => {
  assertRoundTrip(`\
   ┌────────────────┐
   │ ┌──────────────┴─┐
   │ │ ┌──────────────┴─┐
   └─┤ │       1        │
     └─┤                │
       └───────┬────────┘
               │
               ▼
   ┌────────────────┐
   │┌───────────────┴┐
   ││┌───────────────┴┐
   └┤│       2        │
    └┤                │
     └────────────────┘

      ┌────────────────┐
    ┌─┴──────────────┐ │
  ┌─┴──────────────┐ │ │
  │       3        │ ├─┘
  │                ├─┘
  └────────────────┘

  ┌────────────────┐
  │       4        ├─┐
  │                │ ├─┐
  └─┬──────────────┘ │ │
    └─┬──────────────┘ │
      └────────────────┘

     ┌──────────────┐
    ┌┤              │
   ┌┤│      5       │
   ││└─────────────┬┘
   │└─────────────┬┘
   └──────────────┘
`);
});

test("ink: 2x2 Junction Grid", () => {
  assertRoundTrip(`\
┌─────────┬─────────┐
│  Box A  │  Box B  │
├─────────┼─────────┤
│  Box C  │  Box D  │
└─────────┴─────────┘
`);
});

test("ink: trace projection preserves mixed parent and cell styles", () => {
  const source = `\
┏━━━━━┯━━━━━┓
┃  A  │  B  ┃
┠─────┼─────┨
┃  C  │  D  ┃
┗━━━━━┷━━━━━┛`;

  assertEquals(projectTracesToGrid(traceMap(source)).text, source);
});

test("ink: 3x1 Junction Grid (ASCII)", () => {
  assertRoundTrip(`
+---+
| A |
+---+
| B |
+---+
| C |
+---+
`);
});

test("ink: 2x2 Junction Grid (Double Unicode)", () => {
  assertRoundTrip(`
╔════WXYZ═══╗
║  W  ║  X  ║
╠═════╬═════╣
║  Y  ║  Z  ║
╚═════╩═════╝`);
});

test("Is it a grid?", () => {
  assertRoundTrip(`
┌────────┬───────┐
│   B    │       │
├────────┘       │
│       A        │
│       ┌────────┤
│       │   C    │
└───────┴────────┘
`);
});

test("ink: showcase.topos", () => {
  const source = `
                      Topos Engine

╔══ Input ═╗
║   :map   ║
╚════╤═════╝
     │
     │       ╔══ TextGrid ═══╗        ┌── Grammar ──┐
     └──────▶║   claimMask   ║◀──────▶│  Traits     │
             ║   textGrid    ║        │  Directions │
             ╚═══════╤═══════╝        └─────────────┘
                     │
┏━━━━━━━━━━━━━━━━━━━━┿━━━━━━ Trace ━━━━━━━━━━━━━━━━━━━┓
┃                    │                                ┃
┃  ┌─────────────────▼────────────────┐               ┃
┃  │          perimeterAnt            │               ┃
┃  └─────────────────┬────────────────┘               ┃
┃                    │                                ┃
┃  ┌─────────────────▼────────────────┐               ┃
┃  │           arrowMouse             │               ┃
┃  └─────────────────┬────────────────┘               ┃
┃                    │                                ┃
┃  ┌─────────────────▼────────────────┐               ┃
┃  │           textTurtle             │               ┃
┃  └─────────────────┬────────────────┘               ┃
┃                    │                                ┃
┗━━━━━━━━━━━━━━━━━━━━┿━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                     ▼
┏━━━━━━━━━━━━━━━━━━━━┯━━━━━ Refine ━━━━━━━━━━━━━━━━━━━━┓
┃                    │                                 ┃
┃  ┌─────────────────▼────────────────┐                ┃
┃  │          buildNodeTree           │                ┃
┃  └─────────────────┬────────────────┘                ┃
┃                    │                                 ┃
┃  ┌─────────────────▼────────────────┐                ┃
┃  │           resolveEdges           │                ┃
┃  └─────────────────┬────────────────┘                ┃
┃                    │                                 ┃
┗━━━━━━━━━━━━━━━━━━━━┿━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                     ▼
┏━━━━━━━━━━━━━━━━━━━━┯━━━━━━━━ Ink ━━━━━━━━━━━━━━━━━━━━┓
┃                    │                                 ┃
┃           ┌────────┴─────────┬─────────────┐         ┃
┃           │                  │             │         ┃
┃           ▼                  ▼             ▼         ┃
┃     ╭──────────╮       ╭──────────╮  ╭──────────╮    ┃
┃     │  Clean   │       │  Sketch  │  │   Mono   │    ┃
┃     ╰─────┬────╯       ╰─────┬────╯  ╰─────┬────╯    ┃
┃           └───────◎──────────┘             │         ┃
┃                   │                        │         ┃
┃             ┌─────▼──────┐                 │         ┃
┃             │   JSONML   │                 │         ┃
┃             └─────┬──────┘                 │         ┃
┃                   │                        │         ┃
┗━━━━━━━━━━━━━━━━━━━┿━━━━━━━━━━━━━━━━━━━━━━━━┿━━━━━━━━━┛
                    ▼                        ▼          
              ╔════════════╗          ╔════════════╗    
              ║    SVG     ║          ║ MonoSketch ║    
              ╚════════════╝          ╚════════════╝`;
  // Showcase has trailing spaces on lines that matter for layout bounding/trimming. Re-run assertRoundTrip with the raw block.
  assertRoundTrip(source);
});

test("ink: spiral.topos", () => {
  assertRoundTrip(`
┌───────────────────────T
│ ┌─────────────────────┐
│ │ ┌─────────────────┐ │
│ │ │ ┌─────────────┐ │ │
│ │ │ │ ┌─────────┐ │ │ │
│ │ │ │ │ ┌─────┐ │ │ │ │
│ │ │ │ │ │ X ┐ │ │ │ │ │
│ │ │ │ │ └───┘ │ │ │ │ │
│ │ │ │ └───────┘ │ │ │ │
│ │ │ └───────────┘ │ │ │
│ │ └───────────────┘ │ │
│ └───────────────────┘ │
└───────────────────────┘`);
});

test("ink: 4x4 Junction Grid", () => {
  assertRoundTrip(`
┌───ABCDEFGHIJKLMNOP────┐
│  A  │  B  │  C  │  D  │
├─────┼─────┼─────┼─────┤
│  E  │  F  │  G  │  H  │
├─────┼─────┼─────┼─────┤
│  I  │  J  │  K  │  L  │
├─────┼─────┼─────┼─────┤
│  M  │  N  │  O  │  P  │
└─────┴─────┴─────┴─────┘`);
});

test("ink: dashed box", () => {
  assertRoundTrip(`
┌┄┄┄┄┄┄┄┐
┆ Dashed┆
└┄┄┄┄┄┄┄┘`);
});

test("ink: dotted box", () => {
  assertRoundTrip(`\
┌┈┈┈┈┈┈┈┐
┊ Dotted┊
└┈┈┈┈┈┈┈┘`);
});

test("ink: inline nodes", () => {
  assertRoundTrip(`\
[ A (B) <C> ]
[D] --> [ E ]`);
});

test("ink: sigils round-trip", () => {
  assertRoundTrip(`\
┌───────────────────────┐
│ System #id @type      │
│                       │
│ [ Node .red ]         │
│                       │
│ Prose line .tag       │
└───────────────────────┘`);
});

test("ink: ceiling sigils round-trip", () => {
  assertRoundTrip(`
┌─ System .class@Sys ─┐
│                     │
└─────────────────────┘`);
});

test("ink: half-wires round-trip from traces", () => {
  const source = `\
[A]──[B]
[A]╶╴[B]
[A]◀─╴╶─⯈[B]`;

  assertEquals(projectTracesToGrid(traceMap(source)).text, source);
});

test("ink: projection identifies contiguous Slate color spans", () => {
  const source = `\
┌─┐  A──▶●
│X│
└─┘`;

  assertEquals(projectTracesToGrid(traceMap(source)).spans, [
    { start: 0, end: 3, role: "box" },
    { start: 5, end: 6, role: "text" },
    { start: 6, end: 8, role: "line" },
    { start: 8, end: 10, role: "glyph" },
    { start: 11, end: 12, role: "box" },
    { start: 12, end: 13, role: "text" },
    { start: 13, end: 14, role: "box" },
    { start: 15, end: 18, role: "box" },
  ]);
});

test("ink: projection identifies inline nodes separately from text", () => {
  assertEquals(projectTracesToGrid(traceMap("[Inline] plain")).spans, [
    { start: 0, end: 8, role: "inline" },
    { start: 9, end: 14, role: "text" },
  ]);
});

test("ink: projection identifies text controls but keeps inline nodes uniform", () => {
  assertEquals(projectTracesToGrid(traceMap("# A⏎\n[B#]")).spans, [
    { start: 0, end: 1, role: "control" },
    { start: 1, end: 3, role: "text" },
    { start: 3, end: 4, role: "control" },
    { start: 5, end: 9, role: "inline" },
  ]);
});

test("ink: box-line junction has a mixed projection role", () => {
  const source = `\
┌──┐
│ A├──▶ B
└──┘`;
  const projection = projectTracesToGrid(traceMap(source));
  const junction = projection.lines[0].length + 1 + 3;
  const junctionSpan = projection.spans.find((span) => span.start <= junction && span.end > junction);

  assertEquals(junctionSpan?.role, "mixed");
});

test("ink: file tree stems preserve authored tee glyphs", () => {
  const source = `\
root/
├── alpha/
│   ├── one.ts
│   └── two.ts
└── beta/`;

  assertEquals(projectTracesToGrid(traceMap(source)).text, source);
});

test("ink: hubs round-trip", () => {
  assertRoundTrip(`
            ■ Top
            │
            ▼
 □─────────>◎<────────────□
            │
            │
            │
            ▼
            ◇ Bottom`);
});


test("ink: standalone note with continuation round-trip", () => {
  assertRoundTrip(`\
┌─────────────────────────┐          
│  This is line one that  │          
│ wraps with ⏎ carret.    │          
│  Usage line paragraph   │          
│ symbol.¶ The End.       │          
└─────────────────────────┘`);
});

test("ink: AST round-trip (Rovers test case)", () => {
  assertRoundTrip(`
 ┌─ROVERS────────────────┐
 │   [ Opportunity  ]    │
 │   [ Perseverance ]    │
 │   [  Curiosity   ]    │
 │   [   Spirit     ]    │
 └───────────────────────┘`);
});
