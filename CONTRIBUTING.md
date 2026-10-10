# Contributing to Topos

Thank you for helping improve Topos. The repository is MIT-licensed except for the proprietary visual editor in `src-editor/`. See [`LICENSE`](LICENSE) for the complete terms.

## Contribution Terms

### MIT-licensed components

Contributions anywhere outside `src-editor/` are accepted under the repository's MIT License. This includes:

- `src/` — parser, Map and Legend model, refinement, and SVG renderer.
- `package-topos/` — command-line package and core bundle entry point.
- `vscode-topos/` — VS Code integration source.
- `www/`, `scripts/`, `docs/`, `examples/`, and repository documentation.

By submitting a contribution outside `src-editor/`, you agree that it may be distributed under the MIT License.

### Topos visual editor

The interactive visual editor lives in `src-editor/` and is proprietary. Contributions to it require the contributor to grant Alex Drel a perpetual, worldwide, non-exclusive, royalty-free, transferable license to use, modify, and distribute the contribution as part of Topos.

Add this comment to the pull request to accept those terms:

> I agree to the Topos visual editor contribution terms in CONTRIBUTING.md.

You retain copyright in your contribution and confirm that you have the right to grant this license.

## Development Setup

Topos uses Node.js 26 or later for TypeScript checking, tests, asset generation, and esbuild builds of the command-line package and VS Code extension. Run `npm ci` from the repository root to install the development dependencies. `npm run serve` starts the Vite development server for the web editor and Slate harness.

The shared engine lives in `src/`, the visual editor in `src-editor/`, and the primary production host in `vscode-topos/`.

## Verification

Run the checks relevant to your change:

```sh
npm test
npm run fmt:check
```

GitHub Actions runs these checks and builds the extension and CLI on Linux, macOS, and Windows with Node.js 26 for every push and pull request.

Every platform also validates VSIX packaging without uploading an artifact. After building, `npm run ext:package` writes the installable extension to `tmp/topos.vsix`.

## Releases

The workspace, extension, and npm package share one version. Update all three manifests and the root lockfile together, then push a matching `v<version>` tag. The release workflow runs on macOS, validates and packages both products, creates a draft GitHub Release with the VSIX, publishes `@alexdrel/topos` to npm, and makes the GitHub Release public. Marketplace publishing remains manual.

Before the first automated npm release, configure the package's npm trusted publisher for GitHub owner `alexdrel`, repository `topos`, workflow `release.yml`, and allow direct publishing. This uses GitHub OIDC rather than a stored npm token. If npm publishing fails, the GitHub Release remains a draft for inspection.

## Builds

For extension or webview changes, also rebuild the packaged bundles:

```sh
npm run ext:compile
```

`npm run build` (also available as `ext:compile`) rebuilds the extension host, webview, core, CLI, and npm package bundles. Extension documentation and media use symlinks to the canonical project files. `npm run ext:watch` rebuilds bundles as their source files change. Generated files under `vscode-topos/out/` and `package-topos/dist/` should not be edited by hand.

If a change affects Compendium definitions or generated rendering assets, use the corresponding generation task rather than editing generated files:

```sh
npm run gen:compendium
```

Keep changes focused, preserve existing source and formatting conventions, and include tests for behavior that can regress.
