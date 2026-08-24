import { assertEquals, assertThrows } from "@std/assert";
import { renderParameters } from "../../render.ts";

function options(
  parameters: Record<string, string | undefined> = { theme: "light" },
  override = false,
  transparent = true,
) {
  return { parameters, override, transparent };
}

Deno.test("render parameters: external parameters extend or override diagram parameters", () => {
  const authored = { ink: "yellow", paper: "pink" };
  const cases = [
    { theme: "light", override: false, ink: "yellow", paper: "pink" },
    { theme: "dark", override: false, ink: "yellow", paper: "pink" },
    { theme: "light", override: true, ink: "#111111", paper: "#fdfaf6" },
    { theme: "dark", override: true, ink: "#ffffff", paper: "#1a1a1a" },
  ];

  for (const expected of cases) {
    const rendered = renderParameters(
      authored,
      options({ theme: expected.theme }, expected.override),
    );
    assertEquals(
      { ink: rendered.ink, paper: rendered.paper },
      { ink: expected.ink, paper: expected.paper },
    );
  }
});

Deno.test("render parameters: undefined values do not override authored parameters", () => {
  const rendered = renderParameters(
    { ink: "yellow", paper: "pink", font: "serif" },
    options({ ink: "white", paper: "black", font: undefined }, true),
  );

  assertEquals(rendered.ink, "white");
  assertEquals(rendered.paper, "black");
  assertEquals(rendered.font, "serif");
});

Deno.test("render parameters: priority replaces the scale and width axis", () => {
  const diagram = renderParameters(
    { ink: "yellow", paper: "pink", width: "2400" },
    options({ scale: "2" }),
  );
  const exportOverride = renderParameters(
    { ink: "yellow", paper: "pink", width: "2400" },
    options({ scale: "2" }, true),
  );

  assertEquals({ scale: diagram.scale, width: diagram.width }, { scale: undefined, width: "2400" });
  assertEquals({ scale: exportOverride.scale, width: exportOverride.width }, { scale: "2", width: undefined });
});

Deno.test("render parameters: theme shorthand does not survive expansion", () => {
  const rendered = renderParameters({}, options({ theme: "dark" }));

  assertEquals(rendered.theme, undefined);
  assertEquals(rendered.paper, "#1a1a1a");
  assertEquals(rendered.ink, "#ffffff");
});

Deno.test("render parameters: opaque background supplies missing paper in either parameter set", () => {
  const authored = renderParameters(
    { bg: "#202020" },
    options({ theme: "light" }),
  );
  const external = renderParameters(
    {},
    options({ theme: "light", bg: "navy" }),
  );

  assertEquals(authored.paper, "#202020");
  assertEquals(external.paper, "navy");
});

Deno.test("render parameters: explicit paper wins over background and theme paper", () => {
  const rendered = renderParameters(
    {},
    options({ theme: "dark", bg: "navy", paper: "beige" }),
  );

  assertEquals(rendered.paper, "beige");
});

Deno.test("render parameters: light and dark background names use canonical paper colors", () => {
  const light = renderParameters(
    { bg: "light" },
    { parameters: { theme: "dark" }, override: false },
  );
  const dark = renderParameters(
    {},
    { parameters: { theme: "light", bg: "dark" }, override: false },
  );

  assertEquals({ bg: light.bg, paper: light.paper }, { bg: "#fdfaf6", paper: "#fdfaf6" });
  assertEquals({ bg: dark.bg, paper: dark.paper }, { bg: "#1a1a1a", paper: "#1a1a1a" });
});

Deno.test("render parameters: transparent background never supplies paper", () => {
  const rendered = renderParameters(
    { bg: "transparent" },
    options({ theme: "dark" }),
  );

  assertEquals(rendered.paper, "#1a1a1a");
});

Deno.test("render parameters: transparent output retains concrete paper", () => {
  const rendered = renderParameters(
    {},
    options({ theme: "dark", bg: "navy" }, false, true),
  );

  assertEquals(rendered.bg, "transparent");
  assertEquals(rendered.paper, "navy");
});

Deno.test("render parameters: omitted transparency uses the merged background", () => {
  const opaque = renderParameters(
    {},
    { parameters: { theme: "light", bg: "navy" }, override: false },
  );
  const transparent = renderParameters(
    {},
    { parameters: { theme: "dark", bg: "transparent" }, override: false },
  );

  assertEquals(opaque.bg, "navy");
  assertEquals(opaque.paper, "navy");
  assertEquals(transparent.bg, "transparent");
  assertEquals(transparent.paper, "#1a1a1a");
});

Deno.test("render parameters: opaque output preserves opaque background or uses paper", () => {
  assertEquals(
    renderParameters({ bg: "#123456" }, options({ theme: "light" }, false, false)).bg,
    "#123456",
  );
  assertEquals(
    renderParameters({ bg: "transparent" }, options({ theme: "light" }, false, false)).bg,
    "#fdfaf6",
  );
  assertEquals(
    renderParameters({}, options({ theme: "light" }, false, false)).bg,
    "#fdfaf6",
  );
});

Deno.test("render parameters: concrete host parameters extend a neutral diagram", () => {
  const rendered = renderParameters(
    { ink: "yellow" },
    options({ paper: "#002b36", ink: "#839496" }),
  );

  assertEquals(rendered.paper, "#002b36");
  assertEquals(rendered.ink, "yellow");
  assertEquals(rendered.bg, "transparent");
});

Deno.test("render parameters: incomplete external parameters are rejected", () => {
  assertThrows(
    () => renderParameters({}, options({})),
    Error,
    "Rendering requires concrete ink and paper parameters",
  );
});
