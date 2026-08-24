import { assertEquals } from "@std/assert";
import { spec, Trait, weightFor } from "../grammar.ts";
import { Dir } from "../geo.ts";

// ─── spec() correctness ───────────────────────────────────────────────────────

Deno.test("spec: single wire glyphs have correct masks", () => {
  assertEquals(spec('─').mask, Dir.E | Dir.W);
  assertEquals(spec('│').mask, Dir.N | Dir.S);
  assertEquals(spec('┌').mask, Dir.BR);
  assertEquals(spec('┐').mask, Dir.BL);
  assertEquals(spec('└').mask, Dir.TR);
  assertEquals(spec('┘').mask, Dir.TL);
  assertEquals(spec('├').mask, Dir.N | Dir.S | Dir.E);
  assertEquals(spec('┤').mask, Dir.N | Dir.S | Dir.W);
  assertEquals(spec('┬').mask, Dir.S | Dir.E | Dir.W);
  assertEquals(spec('┴').mask, Dir.N | Dir.E | Dir.W);
  assertEquals(spec('┼').mask, Dir.All);
});

Deno.test("spec: bold wire glyphs have correct masks", () => {
  assertEquals(spec('━').mask, Dir.E | Dir.W);
  assertEquals(spec('┃').mask, Dir.N | Dir.S);
  assertEquals(spec('┏').mask, Dir.BR);
  assertEquals(spec('┓').mask, Dir.BL);
  assertEquals(spec('┗').mask, Dir.TR);
  assertEquals(spec('┛').mask, Dir.TL);
  assertEquals(spec('┣').mask, Dir.N | Dir.S | Dir.E);
  assertEquals(spec('┫').mask, Dir.N | Dir.S | Dir.W);
  assertEquals(spec('┳').mask, Dir.S | Dir.E | Dir.W);
  assertEquals(spec('┻').mask, Dir.N | Dir.E | Dir.W);
  assertEquals(spec('╋').mask, Dir.All);
});

Deno.test("spec: double wire glyphs have correct masks", () => {
  assertEquals(spec('═').mask, Dir.E | Dir.W);
  assertEquals(spec('║').mask, Dir.N | Dir.S);
  assertEquals(spec('╔').mask, Dir.BR);
  assertEquals(spec('╗').mask, Dir.BL);
  assertEquals(spec('╚').mask, Dir.TR);
  assertEquals(spec('╝').mask, Dir.TL);
  assertEquals(spec('╠').mask, Dir.N | Dir.S | Dir.E);
  assertEquals(spec('╣').mask, Dir.N | Dir.S | Dir.W);
  assertEquals(spec('╦').mask, Dir.S | Dir.E | Dir.W);
  assertEquals(spec('╩').mask, Dir.N | Dir.E | Dir.W);
  assertEquals(spec('╬').mask, Dir.All);
});

Deno.test("spec: corner sharpness only on corner masks", () => {
  // Actual corners get PenCorner
  assertEquals(spec('┌').corner, 'sharp');
  assertEquals(spec('┐').corner, 'sharp');
  assertEquals(spec('└').corner, 'sharp');
  assertEquals(spec('┘').corner, 'sharp');
  assertEquals(spec('┏').corner, 'sharp');
  assertEquals(spec('╔').corner, 'sharp');
  assertEquals(spec('╭').corner, 'rounded');
  assertEquals(spec('╰').corner, 'rounded');
  // Non-corners get undefined
  assertEquals(spec('├').corner, undefined); // T-junction
  assertEquals(spec('┼').corner, undefined); // cross
  assertEquals(spec('─').corner, undefined); // horizontal
  assertEquals(spec('│').corner, undefined); // vertical
});

Deno.test("spec: wire glyphs have Wire trait", () => {
  for (const c of '─│┌┐└┘├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋═║╔╗╚╝╠╣╦╩╬') {
    assertEquals(spec(c).trait & Trait.Wire, Trait.Wire, `Expected Wire trait on '${c}'`);
  }
});

Deno.test("spec: weight uses composite Dir keys", () => {
  // Uniform horizontal
  const hSpec = spec('─');
  assertEquals(weightFor(hSpec, Dir.E), 'single');
  assertEquals(weightFor(hSpec, Dir.W), 'single');

  // Uniform vertical
  const vSpec = spec('│');
  assertEquals(weightFor(vSpec, Dir.N), 'single');
  assertEquals(weightFor(vSpec, Dir.S), 'single');

  // Bold
  assertEquals(weightFor(spec('━'), Dir.E), 'bold');
  assertEquals(weightFor(spec('┃'), Dir.N), 'bold');

  // Double
  assertEquals(weightFor(spec('═'), Dir.E), 'double');
  assertEquals(weightFor(spec('║'), Dir.N), 'double');
});

// ─── spec(): mixed-pen dirWeight ─────────────────────────────────────────────

Deno.test("spec: mixed junctions have per-direction weights", () => {
  const specTee = spec('┯');  // bold H, single S
  assertEquals(weightFor(specTee, Dir.E), 'bold');
  assertEquals(weightFor(specTee, Dir.W), 'bold');
  assertEquals(weightFor(specTee, Dir.S), 'single');
  assertEquals(specTee.mask, Dir.S | Dir.E | Dir.W);

  const specTeeDown = spec('┷');  // bold H, single N
  assertEquals(weightFor(specTeeDown, Dir.E), 'bold');
  assertEquals(weightFor(specTeeDown, Dir.N), 'single');
  assertEquals(specTeeDown.mask, Dir.N | Dir.E | Dir.W);

  const specCross = spec('┿');  // bold H, single V
  assertEquals(weightFor(specCross, Dir.E), 'bold');
  assertEquals(weightFor(specCross, Dir.N), 'single');
  assertEquals(specCross.mask, Dir.All);

  const specTeeR = spec('┠');  // bold V, single E
  assertEquals(weightFor(specTeeR, Dir.N), 'bold');
  assertEquals(weightFor(specTeeR, Dir.E), 'single');
  assertEquals(specTeeR.mask, Dir.N | Dir.S | Dir.E);

  const specTeeHeavyRight = spec('┝');  // single V, bold E
  assertEquals(weightFor(specTeeHeavyRight, Dir.N), 'single');
  assertEquals(weightFor(specTeeHeavyRight, Dir.E), 'bold');
  assertEquals(specTeeHeavyRight.mask, Dir.N | Dir.S | Dir.E);
});

Deno.test("spec: double/single mixed junctions have per-direction weights", () => {
  const specCrossH = spec('╤');  // double H, single S
  assertEquals(weightFor(specCrossH, Dir.E), 'double');
  assertEquals(weightFor(specCrossH, Dir.S), 'single');
  assertEquals(specCrossH.mask, Dir.S | Dir.E | Dir.W);

  const specCrossV = spec('╥');  // double S, single H
  assertEquals(weightFor(specCrossV, Dir.S), 'double');
  assertEquals(weightFor(specCrossV, Dir.E), 'single');
  assertEquals(specCrossV.mask, Dir.S | Dir.E | Dir.W);

  const specTE = spec('╞');  // double E, single N|S
  assertEquals(weightFor(specTE, Dir.E), 'double');
  assertEquals(weightFor(specTE, Dir.N), 'single');
  assertEquals(specTE.mask, Dir.N | Dir.S | Dir.E);
});
