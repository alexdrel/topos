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

Topos uses [Deno](https://deno.com/) for checking, testing, generation, and bundling. Run commands from the repository root; Deno resolves the declared dependencies automatically.

The shared engine lives in `src/`, the visual editor in `src-editor/`, and the primary production host in `vscode-topos/`.

## Verification

Run the checks relevant to your change:

```sh
deno task test
deno task ext:check
```

For extension or webview changes, also rebuild the packaged bundles:

```sh
deno task ext:compile
```

`ext:compile` regenerates packaged assets, copies the canonical `docs/Topos Guide.md` into the extension, and rebuilds the extension host, webview, core, and CLI bundles. Generated files under `vscode-topos/out/` and `package-topos/dist/` should not be edited by hand.

If a change affects Compendium definitions or generated rendering assets, use the corresponding generation task rather than editing generated files:

```sh
deno task gen:compendium
```

Keep changes focused, preserve existing source and formatting conventions, and include tests for behavior that can regress.
