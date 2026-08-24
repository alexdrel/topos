import { splitToposLines, type ToposSections } from "../../src/topos.ts";

export interface TextLines {
  text: string;
  lines: string[];
}

export class ToposDocument {
  private sections!: ToposSections;
  private eol!: "\n" | "\r\n";
  private sourceText: string | undefined;
  private mapText!: string;
  private legendText!: string;

  constructor(source = "") {
    this.load(source);
  }

  get source(): string {
    if (this.sourceText !== undefined) return this.sourceText;

    const { map, legend } = this.sections;
    let source = map.header;
    if (map.content.length) source += `${source ? this.eol : ""}${map.content.join(this.eol)}`;
    if (legend) {
      if (map.header || map.content.length) source += this.eol;
      source += legend.header;
      if (legend.content.length) source += `${this.eol}${legend.content.join(this.eol)}`;
    }
    return this.sourceText = source;
  }

  get mapSource(): string {
    return this.mapText;
  }

  get legendSource(): string {
    return this.legendText;
  }

  matchesSource(source: string): boolean {
    return source === this.source;
  }

  load(source: string): void {
    const lines = source.split(/\r?\n/);
    this.eol = source.match(/\r?\n/)?.[0] === "\r\n" ? "\r\n" : "\n";
    this.sourceText = source;
    this.sections = splitToposLines(lines);
    const mapLines = this.sections.map.content.map((line) => line.trimEnd());
    while (mapLines.at(-1) === "") mapLines.pop();
    this.mapText = mapLines.join("\n");
    const legend = this.sections.legend;
    this.legendText = legend ? `${legend.header}${legend.content.length ? `\n${legend.content.join("\n")}` : ""}` : "";
  }

  setMapProjection(projection: TextLines): void {
    if (projection.text === this.mapText) return;
    const oldLines = this.sections.map.content;
    let contentEnd = oldLines.length;
    while (contentEnd && !oldLines[contentEnd - 1].trimEnd()) contentEnd--;

    this.mapText = projection.text;
    this.sections.map.content = projection.lines.slice();
    for (let index = contentEnd; index < oldLines.length; index++) this.sections.map.content.push("");
    this.sourceText = undefined;
  }

  setLegendSource(source: TextLines | null): boolean {
    if ((source?.text ?? "") === this.legendText) return false;
    if (!source?.text) {
      this.sections.legend = undefined;
      this.legendText = "";
      this.sourceText = undefined;
      return true;
    }

    const first = source.lines[0] ?? "";
    const hasHeader = /^:legend(?:\s|$)/.test(first);
    const legend = { header: hasHeader ? first : ":legend", content: hasHeader ? source.lines.slice(1) : source.lines };
    this.sections.legend = legend;
    this.legendText = hasHeader ? source.text : `:legend\n${source.text}`;
    this.sourceText = undefined;
    return true;
  }

  mergeLegendSource(source: string): void {
    const legend = splitToposLines(source.split(/\r?\n/)).legend;
    if (!legend) return;
    let text: string;
    if (!this.sections.legend) {
      text = `${legend.header}${legend.content.length ? `\n${legend.content.join("\n")}` : ""}`.trim();
    } else {
      const existing = new Set(this.sections.legend.content);
      const addition = legend.content.filter((line) => !existing.has(line)).join("\n").trim();
      if (!addition) return;
      text = `${this.legendText.trimEnd()}\n${addition}`;
    }
    this.setLegendSource({ text, lines: text.split("\n") });
  }
}
