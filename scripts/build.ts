import { readFile } from "node:fs/promises";
import { build, type BuildOptions, context, type Plugin } from "esbuild";

const rawAssets: Plugin = {
  name: "raw-assets",
  setup(builder) {
    builder.onLoad({ filter: /.*/, namespace: "file" }, async (args) => {
      if (args.suffix !== "?raw") return;
      return { contents: await readFile(args.path, "utf8"), loader: "text", watchFiles: [args.path] };
    });
  },
};

const common: BuildOptions = { bundle: true, format: "esm", logLevel: "info", plugins: [rawAssets] };
const runtime = { ...common, platform: "node", target: "node20" } as const;
const core = { ...runtime, entryPoints: ["package-topos/topos-core.ts"] };
const cli = { ...runtime, entryPoints: ["package-topos/cli.ts"], external: ["#topos-core"] };
const packageBundles: BuildOptions[] = [
  { ...core, outfile: "package-topos/dist/topos-core.js" },
  { ...cli, outfile: "package-topos/dist/topos.js" },
];
const extensionBundles: BuildOptions[] = [
  {
    ...runtime,
    entryPoints: ["vscode-topos/src/extension.ts"],
    outfile: "vscode-topos/out/extension.js",
    external: ["vscode", "#topos-core"],
  },
  {
    ...common,
    entryPoints: ["vscode-topos/src/webview/main.ts"],
    outfile: "vscode-topos/out/webview.js",
    platform: "browser",
  },
  { ...core, outfile: "vscode-topos/out/topos-core.js" },
  { ...cli, outfile: "vscode-topos/out/topos.js" },
];
const bundles = process.argv.includes("--package") ? packageBundles : [...extensionBundles, ...packageBundles];

if (process.argv.includes("--watch")) {
  await Promise.all(bundles.map(async (options) => {
    const builder = await context(options);
    await builder.watch();
  }));
} else {
  await Promise.all(bundles.map((options) => build(options)));
}
