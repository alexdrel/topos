import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { basename, join, relative, resolve } from "node:path";
import deno from "@deno/vite-plugin";
import { defineConfig, type Plugin } from "vite";

const TOPOS_WATCH_IGNORED = ["**/examples/failed-tests/**", "**/src/enamel/compendium/compendium.topos"];

function toposPlugin(): Plugin {
  const root = resolve(process.cwd());
  const casesRoot = resolve(root, "examples");
  const compendiumPath = resolve(root, "src/enamel/compendium/compendium.topos");

  function respond(res: ServerResponse, status: number, contentType: string, body: string) {
    res.statusCode = status;
    res.setHeader("Content-Type", `${contentType}; charset=utf-8`);
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  }

  function serveFile(res: ServerResponse, path: string) {
    try {
      respond(res, 200, "text/plain", readFileSync(path, "utf8"));
    } catch {
      respond(res, 404, "text/plain", "Not found");
    }
  }

  function listCasePaths(): string[] {
    if (!existsSync(casesRoot)) return [];
    const out: string[] = [];

    function walk(current: string) {
      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const abs = join(current, entry.name);
        if (entry.isDirectory()) {
          walk(abs);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".topos")) continue;
        out.push(relative(casesRoot, abs).replaceAll("\\", "/"));
      }
    }

    walk(casesRoot);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }

  function casePath(url: string | undefined): string | undefined {
    try {
      return decodeURIComponent(new URL(url ?? "/", "http://localhost").pathname.slice(1));
    } catch {
      return undefined;
    }
  }

  function isUnderCasesRoot(target: string): boolean {
    const rel = relative(casesRoot, target);
    return rel === "" || (!rel.startsWith("..") && !rel.includes(":"));
  }

  function isUnderRoot(target: string): boolean {
    const rel = relative(root, target);
    return rel === "" || (!rel.startsWith("..") && !rel.includes(":"));
  }

  function pngPage(svgPath: string): string {
    const filename = basename(svgPath, ".svg") + ".png";
    const source = JSON.stringify(svgPath);
    const download = JSON.stringify(filename);
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename}</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { display: grid; justify-items: center; gap: 1rem; margin: 2rem; }
      canvas { width: min(80vmin, 512px); height: auto; background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 / 20px 20px; }
      button { padding: 0.5rem 1rem; font: inherit; }
    </style>
  </head>
  <body>
    <canvas></canvas>
    <button type="button" disabled>Save ${filename}</button>
    <p role="status">Rendering PNG…</p>
    <script type="module">
      const canvas = document.querySelector("canvas");
      const button = document.querySelector("button");
      const status = document.querySelector("[role=status]");
      const image = new Image();

      function save() {
        canvas.toBlob((blob) => {
          if (!blob) {
            status.textContent = "Could not encode PNG.";
            return;
          }
          const anchor = document.createElement("a");
          anchor.href = URL.createObjectURL(blob);
          anchor.download = ${download};
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
          status.textContent = "PNG ready. Use the button to save it again.";
        }, "image/png");
      }

      image.addEventListener("load", () => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context || canvas.width === 0 || canvas.height === 0) {
          status.textContent = "SVG has no renderable size.";
          return;
        }
        context.drawImage(image, 0, 0);
        button.disabled = false;
        button.addEventListener("click", save);
        save();
      });
      image.addEventListener("error", () => status.textContent = "Could not load SVG.");
      image.src = ${source};
    </script>
  </body>
</html>`;
  }

  return {
    name: "topos-endpoints",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET") return next();

        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.searchParams.has("png") || !url.pathname.endsWith(".svg")) return next();

        let path: string;
        try {
          path = decodeURIComponent(url.pathname);
        } catch {
          respond(res, 400, "text/plain", "Invalid path");
          return;
        }

        const abs = resolve(root, `.${path}`);
        if (!isUnderRoot(abs) || !existsSync(abs)) {
          respond(res, 404, "text/plain", "Not found");
          return;
        }

        respond(res, 200, "text/html", pngPage(path));
      });

      server.middlewares.use("/__topos/cases/", (req, res, next) => {
        if (req.method !== "GET") return next();

        const path = casePath(req.url);
        if (path === "") {
          respond(res, 200, "application/json", JSON.stringify(listCasePaths()));
          return;
        }
        if (path === undefined) {
          respond(res, 400, "text/plain", "Invalid path");
          return;
        }

        const abs = resolve(casesRoot, path);
        if (!isUnderCasesRoot(abs) || !abs.endsWith(".topos")) {
          respond(res, 400, "text/plain", "Invalid path");
          return;
        }
        serveFile(res, abs);
      });

      server.middlewares.use("/__topos/compendium", (req, res, next) => {
        if (req.method !== "GET") return next();
        serveFile(res, compendiumPath);
      });
    },
  };
}

function wwwPlugin(): Plugin {
  const editorPath = resolve(process.cwd(), "www/editor.html");

  return {
    name: "www-entry",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = new URL(req.url ?? "/", "http://localhost").pathname;
        if (req.method !== "GET" || !["/", "/www", "/www/"].includes(path)) return next();

        try {
          const source = readFileSync(editorPath, "utf8").replace("<head>", '<head>\n    <base href="/www/" />');
          const html = await server.transformIndexHtml("/www/editor.html", source);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [deno(), toposPlugin(), wwwPlugin()],
  server: {
    watch: {
      ignored: TOPOS_WATCH_IGNORED,
    },
  },
});
