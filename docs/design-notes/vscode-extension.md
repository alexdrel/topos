# VS Code Extension

`vscode-topos/` is the primary production host for Topos. It integrates plain `.topos` documents, the Slate visual editor, rendered views, Markdown diagrams, export, the Topos CLI, and the installed guide into VS Code-compatible IDEs.

The extension adapts the shared Topos engine and editor to VS Code. Document semantics belong in the shared project; native buffers, tabs, commands, clipboard access, webviews, and terminal integration belong here.

## Runtime boundaries

The extension has two isolated runtimes:

- The **extension host** runs with Node and the VS Code API. It owns documents, commands, native clipboard access, rendering, export, previews, and CLI installation.
- The **webview** runs in a browser sandbox. It contains Slate and communicates with the extension host through typed messages. It has no filesystem, Node, or VS Code API access.

Compilation produces four bundles:

| Bundle              | Entry point                   | Purpose                                                         |
| ------------------- | ----------------------------- | --------------------------------------------------------------- |
| `out/extension.js`  | `src/extension.ts`            | Extension activation, providers, commands, previews, and export |
| `out/topos-core.js` | `package-topos/topos-core.ts` | Shared MIT parser, annotation, and SVG renderer                 |
| `out/topos.js`      | `package-topos/cli.ts`        | Command-line interface using `topos-core.js`                    |
| `out/webview.js`    | `src/webview/main.ts`         | Browser bundle containing Slate and its editor dependencies     |

`extension.js` and `topos.js` import `#topos-core`, mapped by the packaged `package.json` to `out/topos-core.js`. The webview is self-contained because it executes in a separate browser context.

## Documents and views

Topos text is always the source of truth.

- `ToposEditorProvider` hosts Slate as a native custom text editor. Slate sends complete text changes to the host, which applies them through `WorkspaceEdit`; VS Code therefore owns dirty state, saving, undo, and redo.
- `ToposViewerProvider` renders a linked document in a script-free webview and updates when the text buffer changes.
- Preview, View, Markdown, and export render in the extension host through the shared core. They do not maintain a second diagram model.
- `src/markdown.ts` renders both inline `topos` fences and local `.topos` files linked through Markdown image syntax. Linked files are resolved relative to the Markdown document and read synchronously in the extension host; the webview never receives filesystem access.
- Clipboard operations cross the webview boundary through typed messages and use `vscode.env.clipboard` in the extension host.

The three rendered surfaces have different ownership and update contracts:

| Surface     | Source ownership                                                                      | Update behavior                                                   |
| ----------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Viewer**  | Linked `.topos` document                                                              | Re-renders when that document changes                             |
| **Preview** | One reusable panel tracking an active document, Markdown fence, or explicit selection | Re-resolves its source as editor, selection, and tab state change |
| **View**    | Captured `ActiveToposSource`                                                          | Static snapshot; retained as the source for later copy or export  |

An explicitly selected plain-text fragment may update only from later selections in the same document. This prevents an incidental selection in an unrelated file from stealing the Preview. Documents and Markdown fences remain eligible tracking sources, and explicitly running **Open Preview to the Side** retargets the existing panel.

`src/source.ts` resolves the active `.topos` document, Markdown fence, or text selection used by commands. Command routing must use the active tab when custom editors are involved; `activeTextEditor` alone does not identify them.

## CLI and coding-agent integration

On activation, `src/cli-launcher.ts` generates a `topos` launcher under the current IDE's extension storage. It renders the platform template from `bin/` with the extension-host runtime and packaged CLI paths, then adds that private `bin` directory to new integrated terminals. A global `topos` earlier on `PATH` remains authoritative.

The POSIX and Windows files in `bin/` are both templates and functional launchers. `TOPOS_RUNTIME` and `TOPOS_SCRIPT` supplied by the environment take precedence; extension installation substitutes their defaults. The generated file is extension-owned and is rewritten from scratch on activation.

The launcher runs the IDE's Electron executable with `ELECTRON_RUN_AS_NODE=1`, so integrated-terminal users do not need a separate Node installation. Each IDE owns its launcher and refreshes it when its Topos extension activates.

If private launcher creation fails, activation exposes the packaged `bin/` directory instead and supplies `TOPOS_RUNTIME` and `TOPOS_SCRIPT` to new integrated terminals. This fallback still uses the same launcher files.

**Topos: Copy Coding Agent Instructions** renders the packaged `docs/Coding Agent Instructions.md`, adds absolute paths to that launcher and the installed Topos Guide, then copies the result through the native clipboard API.

## Source layout

- `src/extension.ts` — activation and top-level registrations
- `src/commands.ts` and `src/actions.ts` — command registration and behavior
- `src/editor-provider.ts` and `src/viewer-provider.ts` — custom editors
- `src/preview.ts`, `src/export.ts`, and `src/render.ts` — rendered surfaces
- `src/html.ts` and the HTML templates — webview documents and security policy
- `src/webview/` — browser entry point and typed host messages
- `bin/` — POSIX and Windows launcher templates
- `docs/` and `media/` — symlinks to the canonical project documentation and media
- `resources/` — authored extension icons and language resources
- `out/` — generated distributable bundles

## Build and verification

Run extension tasks from the repository root:

```sh
deno task ext:lint
deno task ext:check
deno task ext:compile
deno task test
```

`ext:compile` rebuilds all four bundles in `vscode-topos/out/`. The `docs/` and `media/` symlinks keep extension-local paths aligned with the canonical project files; the VSIX `files` allowlist packages only the documents required at runtime and leaves README media in the repository. Reload the Extension Development Host after rebuilding extension-host code; webview code also requires a reload unless it is running under the watch task.

The VSIX is controlled by the `files` allowlist in `vscode-topos/package.json`. Inspect the packaged file list before release so source files, tests, and stale generated artifacts do not enter the extension.
