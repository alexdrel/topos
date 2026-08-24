import { parseHeaderTail, parseTopos, renderToSVG, type StringParameters } from "#topos-core";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { errorMessage, escapeHtml } from "./util.ts";

interface MarkdownToken {
  content: string;
  info: string;
  attrGet(name: string): string | null;
}

interface MarkdownEnvironment {
  currentDocument?: { fsPath: string };
}

type TokenRenderer = (
  tokens: MarkdownToken[],
  idx: number,
  options: unknown,
  env: MarkdownEnvironment,
  self: unknown,
) => string;

interface MarkdownIt {
  renderer: {
    rules: {
      fence?: TokenRenderer;
      image?: TokenRenderer;
    };
  };
}

const HOST_SURFACE = {
  theme: "host",
  bg: "transparent",
  paper: "var(--vscode-editor-background)",
  ink: "var(--vscode-editor-foreground)",
};

const INFO_TOKEN_PATTERN = /[\w-]+="[^"]*"|"[^"]*"|\S+/g;

function markdownParameters(parameters: StringParameters) {
  return parameters.theme === "light" || parameters.theme === "dark" ? parameters : { ...HOST_SURFACE, ...parameters };
}

export function parseToposFenceInfo(info: string) {
  const [language, ...tail] = info.trim().match(INFO_TOKEN_PATTERN) ?? [];
  if (language?.toLowerCase() !== "topos") return undefined;
  const override = tail.includes("!");
  return { ...parseHeaderTail(tail.filter((token) => token !== "!").join(" ")), override };
}

export function createMarkdownItExtender() {
  return function extendMarkdownIt(md: MarkdownIt): MarkdownIt {
    return extendMarkdownItWithTopos(md);
  };
}

export function extendMarkdownItWithTopos(md: MarkdownIt): MarkdownIt {
  const defaultFence = md.renderer.rules.fence;
  const defaultImage = md.renderer.rules.image;

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const tail = parseToposFenceInfo(token.info);
    if (!tail) {
      return defaultFence?.(tokens, idx, options, env, self) ??
        `<pre><code>${escapeHtml(token.content)}</code></pre>`;
    }

    try {
      const ast = parseTopos(token.content);
      const fence: StringParameters = { ...tail.parameters, title: tail.title };
      const svg = renderToSVG(ast, { parameters: markdownParameters(fence), override: tail.override, xmlDeclaration: false });
      return `<div id="topos-fence-${idx}-${fenceKey(token)}" class="topos-markdown-preview">${svg}</div>`;
    } catch (error) {
      return `<pre class="topos-markdown-error"><code>${escapeHtml(errorMessage(error))}</code></pre>`;
    }
  };

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const source = token.attrGet("src");
    if (source && /\.topos(?:[?#]|$)/i.test(source)) {
      const rendered = renderLinkedTopos(token, source, env);
      if (rendered) return rendered;
    }
    return defaultImage?.(tokens, idx, options, env, self) ?? "";
  };

  return md;
}

function renderLinkedTopos(token: MarkdownToken, source: string, env: MarkdownEnvironment) {
  try {
    const [address, fragment = ""] = source.split("#", 2);
    if (/^[a-z][a-z\d+.-]*:/i.test(address) || !env.currentDocument) return;

    const filename = resolve(dirname(env.currentDocument.fsPath), decodeURIComponent(address.split("?", 1)[0]));
    const parameters: StringParameters = { title: token.attrGet("title") ?? undefined, ...Object.fromEntries(new URLSearchParams(fragment)) };
    const content = readFileSync(filename, "utf8");
    const ast = parseTopos(content);
    const svg = renderToSVG(ast, { parameters: markdownParameters(parameters), override: !!parameters.override, xmlDeclaration: false });
    return `<span class="topos-markdown-preview">${svg}</span>`;
  } catch {
    return;
  }
}

function fenceKey(token: MarkdownToken): string {
  // VS Code morphs preview HTML in place, but patched SVG animateMotion nodes do not reliably restart.
  // Changing the keyed wrapper replaces the whole SVG whenever the fence source or parameters change.
  let hash = 2166136261;
  for (const char of `${token.info}\0${token.content}`) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
