import { assertEquals } from "@std/assert";
import { parseLegend, parseLegendBlock } from "../parse.ts";

const ANY = { kind: "any" } as const;

Deno.test("legend parse: selectors and comments", () => {
  const rules = parseLegendBlock(`
// A comment
MARS > * : soft
`);

  assertEquals(rules.length, 1);
  const tree = rules[0].selectors[0];
  assertEquals("op" in tree, true);
  if ("op" in tree && "left" in tree) {
    assertEquals(tree.op, ">");
    assertEquals(tree.left, { kind: "label", value: "MARS" });
    assertEquals(tree.right, ANY);
  }
});

Deno.test("legend parse: quotes group exact multi-word selectors", () => {
  const rules = parseLegendBlock(`
"Link label" : red
"API Gateway" -> "Deep Space Network" : dashed
`);

  assertEquals(rules[0].selectors[0], { kind: "label", value: "Link label" });
  assertEquals(rules[1].selectors[0], {
    op: "->",
    left: { kind: "label", value: "API Gateway" },
    right: { kind: "label", value: "Deep Space Network" },
  });
});

Deno.test("legend parse: selector and annotation tokenizers protect colons in values", () => {
  const [rule] = parseLegendBlock('[:map] : "Section: map"');
  assertEquals(rule.selectors, [{ kind: "label", value: ":map", bracket: "[]" }]);
  assertEquals(rule.annotation.text, "Section: map");
});

Deno.test("legend parse: wildcard kinds and edge wildcards", () => {
  const rules = parseLegendBlock(`
[*] : rounded
(*) : ghost
<*> : blue
{*} : red
*-* : soft
*--* : gray
*<->* : green
`);

  assertEquals(rules.length, 7);
  assertEquals(rules[0].selectors[0], { kind: "any", bracket: "[]" });
  assertEquals(rules[1].selectors[0], { kind: "any", bracket: "()" });
  assertEquals(rules[2].selectors[0], { kind: "any", bracket: "<>" });
  assertEquals(rules[3].selectors[0], { kind: "any", bracket: "{}" });
  // *-* → compound { op: "-", left: ANY, right: ANY }
  const anyEdge = rules[4].selectors[0];
  assertEquals("op" in anyEdge, true);
  if ("op" in anyEdge && "left" in anyEdge) {
    assertEquals(anyEdge.op, "-");
    assertEquals(anyEdge.left, ANY);
    assertEquals(anyEdge.right, ANY);
  }
  // *--* → compound { op: "--", left: ANY, right: ANY }
  const undirected = rules[5].selectors[0];
  assertEquals("op" in undirected, true);
  if ("op" in undirected) {
    assertEquals(undirected.op, "--");
  }
  const bidirectional = rules[6].selectors[0];
  assertEquals("op" in bidirectional, true);
  if ("op" in bidirectional) {
    assertEquals(bidirectional.op, "<->");
  }
});

Deno.test("legend parse: unbound endpoints and unambiguous wildcard edges", () => {
  const rules = parseLegendBlock(`
_ : ghost
*-B : blue
A-* : purple
A-B : red
*->* : green
*--* : gray
*<->* : soft
`);

  assertEquals(rules[0].selectors[0], { kind: "unbound" });
  assertEquals(rules[1].selectors[0], {
    op: "-",
    left: ANY,
    right: { kind: "label", value: "B" },
  });
  assertEquals(rules[2].selectors[0], {
    op: "-",
    left: { kind: "label", value: "A" },
    right: ANY,
  });
  assertEquals(rules[3].selectors[0], { kind: "label", value: "A-B" });
  assertEquals(rules[4].selectors[0], { op: "->", left: ANY, right: ANY });
  assertEquals(rules[5].selectors[0], { op: "--", left: ANY, right: ANY });
  assertEquals(rules[6].selectors[0], { op: "<->", left: ANY, right: ANY });
});

Deno.test("legend parse: relation selectors", () => {
  const rules = parseLegendBlock(`
[Parent] >> *--* : dashed
[A] -> [B] : blue
[C] -- [D] : gray
[E] - [F] : soft
`);

  assertEquals(rules.length, 4);

  const tree = rules[0].selectors[0];
  assertEquals("op" in tree, true);
  if ("op" in tree && "left" in tree) {
    assertEquals(tree.op, ">>");
    assertEquals(tree.left, { kind: "label", value: "Parent", bracket: "[]" });
    assertEquals("op" in tree.right, true);
  }

  const directed = rules[1].selectors[0];
  assertEquals("op" in directed, true);
  if ("op" in directed && "left" in directed) {
    assertEquals(directed.op, "->");
    assertEquals(directed.left, { kind: "label", value: "A", bracket: "[]" });
    assertEquals(directed.right, { kind: "label", value: "B", bracket: "[]" });
  }

  const und = rules[2].selectors[0];
  assertEquals("op" in und, true);
  if ("op" in und) {
    assertEquals(und.op, "--");
  }

  const anyDir = rules[3].selectors[0];
  assertEquals("op" in anyDir, true);
  if ("op" in anyDir && "left" in anyDir) {
    assertEquals(anyDir.op, "-");
    assertEquals(anyDir.left, { kind: "label", value: "E", bracket: "[]" });
    assertEquals(anyDir.right, { kind: "label", value: "F", bracket: "[]" });
  }
});

Deno.test("legend parse: malformed lines are ignored and later lines still parse", () => {
  const rules = parseLegendBlock(`
[A] : blue
[A] [B] : .bad
region *
[B] : red
`);

  assertEquals(rules.length, 2);
  assertEquals(rules[0].selectors, [{ kind: "label", value: "A", bracket: "[]" }]);
  assertEquals(rules[0].annotation.eidos, { color: "blue" });
  assertEquals(rules[1].selectors, [{ kind: "label", value: "B", bracket: "[]" }]);
  assertEquals(rules[1].annotation.eidos, { color: "red" });
});

Deno.test("legend parse: visual scopes and label placement", () => {
  const rules = parseLegendBlock(`
[A] : red soft fill=blue,solid stroke=red,strong label=purple label=left,ceiling
[B] : left=25% top=75%
[C] : label=middle,left,align-center
`);

  assertEquals(rules[0].annotation.eidos, {
    color: "red", intensity: "soft",
    fill: { color: "blue", intensity: "solid" },
    stroke: { color: "red", intensity: "strong" },
    label: { color: "purple", textHorizontal: "left", textVertical: "ceiling" },
  });
  assertEquals(rules[1].annotation.eidos, undefined);
  assertEquals(rules[1].annotation.properties, { left: "25%", top: "75%" });
  assertEquals(rules[2].annotation.eidos, { label: { textHorizontal: "left", textVertical: "middle", textAlign: "align-center" } });
});

Deno.test("legend parse: scoped values allow whitespace after equals", () => {
  const [rule] = parseLegendBlock("[A]: label = solid, red");
  assertEquals(rule.annotation.eidos, { label: { intensity: "solid", color: "red" } });
});

Deno.test("legend parse: empty property assignment does nothing", () => {
  const rules = parseLegendBlock(`
[A]: fill-color=
[B]: fill-color="   "
[C]: fill-color= , red
  `);
  assertEquals(rules[0].annotation.properties, undefined);
  assertEquals(rules[1].annotation.properties, undefined);
  assertEquals(rules[2].annotation.properties, { "fill-color": ",red" });
});

Deno.test("legend parse: repeated assignment whitespace returns values to root scope", () => {
  const rules = parseLegendBlock(`
[A]: fill=    animate
[B]: label= solid,  red
`);
  assertEquals(rules[0].annotation.eidos, { animation: "animate" });
  assertEquals(rules[1].annotation.eidos, { label: { intensity: "solid" }, color: "red" });
});

Deno.test("legend parse: palette declarations override built-in colors", () => {
  assertEquals(parseLegend(`\
/blue: #0057b8
/purple: color-mix(in oklch, #c00 80%, black)
/soft: ignored
/brand: ignored
/blue: navy // final override
A: red`).palette, {
    blue: "navy",
    purple: "color-mix(in oklch, #c00 80%, black)",
  });
});

Deno.test("legend parse: stack assignment preserves its numeric tuple", () => {
  const rules = parseLegendBlock(`
[A] : stack=3
[B] : stack=4,-2
[C] : stack=5,1,-1
[D] : stack
[E] : stack=3,,-1
`);

  assertEquals(rules.slice(0, 3).map((rule) => rule.annotation.properties), [
    { stack: "3" },
    { stack: "4,-2" },
    { stack: "5,1,-1" },
  ]);
  assertEquals(rules[3].annotation.eidos, { layering: "stack" });
  assertEquals(rules[4].annotation.properties, { stack: "3,,-1" });
});

Deno.test("legend parse: unknown words in annotation become classes", () => {
  const rules = parseLegendBlock(`
[A] : blue foo @type
`);
  assertEquals(rules.length, 1);
  assertEquals(rules[0].selectors, [{ kind: "label", value: "A", bracket: "[]" }]);
  assertEquals(rules[0].annotation.eidos, { color: "blue" });
  assertEquals(rules[0].annotation.semanticType, "type");
  assertEquals(rules[0].annotation.classes, ["foo"]);
});

Deno.test("legend parse: unknown properties are ignored", () => {
  const [rule] = parseLegendBlock("[A]: invented=value");
  assertEquals(rule.annotation.properties, undefined);
});

Deno.test("legend parse: animation and particle eidos", () => {
  const rules = parseLegendBlock(`
*: block chevron animate
[*]: packet
`);
  assertEquals(rules[0].annotation.eidos, { edgeBody: "block", particle: "chevron", animation: "animate" });
  assertEquals(rules[1].annotation.eidos, { particle: "packet" });
});

Deno.test("legend parse: wildcard selectors", () => {
  const rules = parseLegendBlock(`
%long para% : blue
[API%] : red
`);
  assertEquals(rules.length, 2);
  assertEquals(rules[0].selectors[0], { kind: "substring", value: "long para" });
  assertEquals(rules[1].selectors[0], { kind: "startswith", value: "API", bracket: "[]" });
});

Deno.test("legend parse: caret parent operators", () => {
  const rules = parseLegendBlock(`
^#n1 : red
^^%long para% : blue
`);
  assertEquals(rules.length, 2);
  assertEquals(rules[0].selectors[0], {
    op: "^",
    right: { kind: "id", value: "n1" }
  });
  assertEquals(rules[1].selectors[0], {
    op: "^",
    right: {
      op: "^",
      right: { kind: "substring", value: "long para" }
    }
  });
});

Deno.test("legend parse: spaceless edge operators and dashed words", () => {
  const rules = parseLegendBlock(`
BB->AA : blue
BB--AA : green
class-name : red
`);
  assertEquals(rules.length, 3);

  const rule1 = rules[0].selectors[0];
  assertEquals("op" in rule1 && "left" in rule1, true);
  if ("op" in rule1 && "left" in rule1) {
    assertEquals(rule1.op, "->");
    assertEquals(rule1.left, { kind: "label", value: "BB" });
    assertEquals(rule1.right, { kind: "label", value: "AA" });
  }

  const rule2 = rules[1].selectors[0];
  assertEquals("op" in rule2 && "left" in rule2, true);
  if ("op" in rule2 && "left" in rule2) {
    assertEquals(rule2.op, "--");
    assertEquals(rule2.left, { kind: "label", value: "BB" });
    assertEquals(rule2.right, { kind: "label", value: "AA" });
  }

  const rule3 = rules[2].selectors[0];
  assertEquals(rule3, { kind: "label", value: "class-name" });
});

Deno.test("legend parse: unary caret ^ and synthesis operators priority", () => {
  const rules = parseLegendBlock(`
^%para% ~> ^%wraps% : blue
`);
  assertEquals(rules.length, 1);
  const rule = rules[0].selectors[0];
  assertEquals("op" in rule && "left" in rule, true);
  if ("op" in rule && "left" in rule) {
    assertEquals(rule.op, "~>");
    assertEquals(rule.left, {
      op: "^",
      right: { kind: "substring", value: "para" }
    });
    assertEquals(rule.right, {
      op: "^",
      right: { kind: "substring", value: "wraps" }
    });
  }
});

Deno.test("legend parse: annotation is optional", () => {
  const rules = parseLegendBlock(`
A
A -> B
A ~> B
`);
  assertEquals(rules.length, 3);
  for (const rule of rules) assertEquals(rule.annotation, {});
});

Deno.test("legend parse: quoted URLs preserve comment-like slashes", () => {
  const [rule] = parseLegendBlock('#docs: href="https://example.com/very/long/path" // documentation');
  assertEquals(rule.annotation.properties, { href: "https://example.com/very/long/path" });
});
