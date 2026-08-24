import { assertEquals } from "@std/assert";
import { ToposDocument } from "../document.ts";

function setMap(document: ToposDocument, text: string): void {
  document.setMapProjection({ text, lines: text ? text.split("\n") : [] });
}

function setLegend(document: ToposDocument, text: string): void {
  document.setLegendSource(text ? { text, lines: text.split("\n") } : null);
}

Deno.test("ToposDocument preserves untouched source exactly", () => {
  const source = ':map "Title"\r\n(A)  \r\n\r\n:legend theme=dark\r\n[A]: blue  \r\n';
  const document = new ToposDocument(source);

  assertEquals(document.source, source);
  assertEquals(document.mapSource, "(A)");
  assertEquals(document.legendSource, ":legend theme=dark\n[A]: blue  \n");
});

Deno.test("ToposDocument uses the first line ending when editing mixed source", () => {
  const document = new ToposDocument("(A)\r\n(B)\n:legend\r\n[A]: blue");

  assertEquals(document.source, "(A)\r\n(B)\n:legend\r\n[A]: blue");
  setMap(document, "(C)");
  assertEquals(document.source, "(C)\r\n:legend\r\n[A]: blue");
});

Deno.test("ToposDocument preserves CRLF when edited", () => {
  const document = new ToposDocument("(A)\r\n:legend\r\n[A]: blue");

  setMap(document, "(B)\n(C)");

  assertEquals(document.source, "(B)\r\n(C)\r\n:legend\r\n[A]: blue");
});

Deno.test("ToposDocument preserves trailing blank map lines across map edits", () => {
  const document = new ToposDocument("(A)\n\n\n:legend\n[A]: blue");

  setMap(document, "(B)\n\n(C)");
  assertEquals(document.source, "(B)\n\n(C)\n\n\n:legend\n[A]: blue");

  setMap(document, "(B)");
  assertEquals(document.source, "(B)\n\n\n:legend\n[A]: blue");
});

Deno.test("ToposDocument preserves trailing blank map lines without a legend", () => {
  const document = new ToposDocument("(A)\n\n");

  setMap(document, "(B)");

  assertEquals(document.source, "(B)\n\n");
});

Deno.test("ToposDocument terminates an explicit map header before inserting content", () => {
  const document = new ToposDocument(":map");

  setMap(document, "(A)");

  assertEquals(document.source, ":map\n(A)");
});

Deno.test("ToposDocument creates and removes a legend section", () => {
  const document = new ToposDocument("(A)");

  setLegend(document, ":legend theme=dark\n[A]: blue");
  assertEquals(document.source, "(A)\n:legend theme=dark\n[A]: blue");

  setLegend(document, "");
  assertEquals(document.source, "(A)");
});

Deno.test("ToposDocument treats only the first legend editor line as a header", () => {
  const document = new ToposDocument("(A)");

  setLegend(document, "[A]: blue\n:legend is content here");

  assertEquals(document.source, "(A)\n:legend\n[A]: blue\n:legend is content here");
});

Deno.test("ToposDocument preserves the legend's final newline", () => {
  const document = new ToposDocument("(A)");

  setLegend(document, ":legend\n[A]: blue\n");

  assertEquals(document.legendSource, ":legend\n[A]: blue\n");
  assertEquals(document.source, "(A)\n:legend\n[A]: blue\n");
});

Deno.test("ToposDocument appends another legend while preserving its own header", () => {
  const document = new ToposDocument("(A)\n:legend\n[A]: blue");

  document.mergeLegendSource(":legend theme=dark\n[B]: red");

  assertEquals(document.source, "(A)\n:legend\n[A]: blue\n[B]: red");
});

Deno.test("ToposDocument does not append existing legend lines", () => {
  const document = new ToposDocument("(A)\n:legend\n[A]: blue");

  document.mergeLegendSource(":legend\n[A]: blue\n[B]: red");

  assertEquals(document.source, "(A)\n:legend\n[A]: blue\n[B]: red");
});

Deno.test("ToposDocument merges a CRLF legend", () => {
  const document = new ToposDocument("(A)\n:legend\n[A]: blue");

  document.mergeLegendSource(":legend\r\n[A]: blue\r\n[B]: red\r\n");

  assertEquals(document.source, "(A)\n:legend\n[A]: blue\n[B]: red");
});

Deno.test("ToposDocument preserves an appended legend header when creating the section", () => {
  const document = new ToposDocument("(A)");

  document.mergeLegendSource(":legend theme=dark\n[B]: red");

  assertEquals(document.source, "(A)\n:legend theme=dark\n[B]: red");
});

Deno.test("ToposDocument mutates sections without editor transaction state", () => {
  const document = new ToposDocument("(A)");

  document.mergeLegendSource(":legend\n[A]: blue");

  assertEquals(document.source, "(A)\n:legend\n[A]: blue");
});
