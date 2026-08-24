import { FormattedLine, FormattedSegment } from "../topos.ts";

export function parseCodeText(text: string): FormattedLine[] {
  return text.split("\n").map((line) => line ? [{ text: line, code: true }] : []);
}

function scanFormatted(text: string): FormattedLine[] {
  const lines: FormattedLine[] = [];
  let current: FormattedSegment[] = [];
  let bold = false;
  let italic = false;
  let strike = false;
  let buf = "";
  let pendingParagraph = text.startsWith("¶");
  if (pendingParagraph) text = text.slice(1).trimStart();

  const flush = () => {
    if (buf) current.push({ text: buf, bold, italic, strike, code: false });
    buf = "";
  };

  const endLine = () => {
    flush();
    if (pendingParagraph && current.length > 0) {
      current[0] = { ...current[0], paragraph: true };
    }
    lines.push(current);
    current = [];
    pendingParagraph = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === "\\" && i + 1 < text.length) {
      buf += text[i + 1];
      i++;
      continue;
    }

    if (ch === "\n") {
      endLine();
      if (text[i + 1] === "¶") {
        pendingParagraph = true;
        i++;
      }
      continue;
    }

    if (ch === "`") {
      const close = text.indexOf("`", i + 1);
      if (close === -1) {
        buf += ch; // no closing backtick — treat as literal
        continue;
      }
      flush();
      const codeText = text.slice(i + 1, close);
      if (codeText) current.push({ text: codeText, bold, italic, strike, code: true });
      i = close;
      continue;
    }

    if (ch === "[") {
      const labelEnd = text.indexOf("](", i + 1);
      const hrefEnd = labelEnd === -1 ? -1 : text.indexOf(")", labelEnd + 2);
      const label = labelEnd === -1 ? "" : text.slice(i + 1, labelEnd);
      const href = hrefEnd === -1 ? "" : text.slice(labelEnd + 2, hrefEnd);
      if (label && href) {
        flush();
        current.push({
          text: label,
          ...(href.startsWith("#") ? { linkRef: href.slice(1) } : { href }),
          bold,
          italic,
          strike,
          code: false,
        });
        i = hrefEnd;
        continue;
      }
    }

    if (ch === "~" && text[i + 1] === "~") {
      flush();
      strike = !strike;
      i++;
      continue;
    }

    if (ch === "*" || ch === "_") {
      if (text[i + 1] === ch) {
        flush();
        bold = !bold;
        i++;
      } else {
        flush();
        italic = !italic;
      }
      continue;
    }

    buf += ch;
  }
  if (buf || current.length > 0 || !pendingParagraph) endLine();

  return lines;
}

export function parseText(text?: string): FormattedLine[] | undefined {
  if (!text) return undefined;

  return scanFormatted(cleanProseText(text));
}

export function parseLiteralText(text?: string): FormattedLine[] | undefined {
  if (!text) return undefined;
  return text.split("\n").map((line) => line ? [{ text: line }] : []);
}

function cleanProseText(text: string): string {
  let cleaned = text.trim().replaceAll("␠", " ").replaceAll("⍽", " ");

  if (/[⏎↵¶]/.test(cleaned)) {
    cleaned = cleaned
      .replace(/\s*\n\s*/g, " ")
      .replace(/(?<!^)\s*¶\s*/g, "\n¶")
      .replace(/\s*[⏎↵]\s*/g, "\n");
  } else {
    // no sigils: raw \n still honored as a break, but strip stray
    // spaces touching it — parity with the old per-line .trim()
    cleaned = cleaned.replace(/\s*\n\s*/g, "\n");
  }
  cleaned = cleaned.replace(/^##?\s+/, "");
  return cleaned;
}
