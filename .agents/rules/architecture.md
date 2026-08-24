---
trigger: model_decision
description: Topos Architecture
---

# Topos Architecture Rules

## 1. Topos Architecture Pipeline

**Entity Evolution:** The core entities evolve in structure and semantics as they pass through the pipeline:

- `TraceBox` (`type="box"|"text"`) -> `MapNode` (structural tree) -> `Node` (semantic, annotated AST)
- `TraceBox` (`type="line"`) -> `MapEdge` (structural connection) -> `Edge` (semantic, annotated connection)

1. **Trace:** Ants and Mice crawl the text grid to find physical geometry.
2. **Refine:** The engine builds the spatial `MapNode` tree, resolves physical `MapEdge`s, and promotes and lays out regions.
3. **Ink:** The raw, monochrome, structural source is emitted (round-trip text output, Monosketch JSON).
4. **Annotate:** The `:legend` rules are applied, injecting semantic meaning (identity, type, class tags), resolving visual **Eidos** values (colors, intensities, patterns, effects, weights, etc.), and creating abstract legend edges.
5. **Enamel:** The annotated AST is rendered into the final, vibrant, styled SVG presentation.

### Trace

- **Input**: ASCII text grid.
- **Output**: Raw geometries `TraceBox[]` - boxes, lines, hubs, and standalone text runs. Includes parent-child relationships between traces for embedded texts.
- **Agents (`perimeterAnt`, `textTurtle`, `arrowMouse`)**: Specialized, independent agents navigate the 2D grid to extract boxes, text, and connections.
- **Grid Mask**: Agents `claim()` and `unclaim()` locations to prevent parsing the same structure twice (e.g., tracing a box through an arrow).
- **Lossless Fallback Ownership**: Structure gets first refusal; everything left becomes text. Structural agents run first and claim recognized geometry, then Turtle claims every remaining non-space glyph as content. Unrecognized, ambiguous, or malformed structure must remain projectable and editable rather than being discarded.
- **Observability**: All actions (`move`, `spawn`, `success`, `abort`) are recorded (`recorder.ts`) and serializable for Slate trace replay.

### Refine (Structural Assembly)

- **Input**: Raw geometries (`TraceBox[]` from the Trace phase).
- **Output**: Spatial `MapNode` tree and resolved `MapEdge`s.
- **Purpose**: The engine builds the spatial `MapNode` tree and resolves physical `MapEdge`s from the raw geometries discovered by the Trace phase.
- **Label Promotion**: Single-line text runs inside boxes may be promoted to box labels.

### Ink (structural, invertible)

- **Input**: Spatial `MapNode` tree or raw Traces.
- **Output**: Round-trip ASCII text or MonoSketch JSON.
- **Purpose**: Emit the raw, monochrome, structural geometry (ASCII text or MonoSketch JSON). It can ink from the map (AST) or directly from traces. The key purpose is to **round-trip back to the map** after editing.
- **Rule**: Ink output is **invertible** and must **never** consume `:legend` rules or semantic annotations.

### Annotate (Legend Application & Semantic Enrichment)

- **Legend vs Annotate**: The **Legend** domain handles parsing the user's semantic DSL (`src/legend/parse.ts`). **Annotate** is the pipeline phase that _applies_ those parsed rules (`src/legend/annotate.ts`) to the AST.
- **Input**: Raw `MapNode` tree + parsed `LegendRule[]`.
- **Output**: Annotated AST (with `#id`, `@type`, visual **Eidos** values).
- **Purpose**: Enrich the structural AST with semantic metadata and add abstract edges based on the legend.
- **Eidos**: The unified visual token system. Annotate maps semantics to **Eidos** tokens (e.g., mapping an `@actor` to a `blue` eidos), decoupling meaning from exact SVG styling.
- **Rule**: Annotation is a **one-way enrichment** step. Geometric purity is not required; structures can be reshaped for presentation.

### Enamel (visual, lossy)

- **Input**: Annotated AST.
- **Output**: Final styled SVG presentation.
- **Purpose**: Render the annotated AST into the final, styled SVG presentation.
- **Rule**: Enamel is **lossy** and purely visual. It consumes semantic metadata and **Eidos** values to dictate appearance.
- **Styling**: Output must remain **self-contained**. Styles, symbols, and markers are embedded from the Enamel compendium (`compendium.svg`).

# Runtime & Tooling

- **Deno (Core)**: Executes core parser logic, tests (`deno test`), and headless generation (via XML String Builder, no DOM).
- **CLI (`package-topos/cli.ts`)**: Shared headless entry point for rendering `.topos` source to SVG and inspecting the resolved semantic diagram.
- **Vite (Frontend)**: Bundles the browser editor and serves CSS/TS assets.

# Production Editor

- **Single Authoring Model**: The production editor edits the complete Topos document through one `EditorModel`. The legacy Canvas/AST editor model is not part of the production authoring flow.
- **Shared Visual Surface**: Slate is the reusable visual authoring surface. Text editing, rendered viewing, Preview, export, Inspector, and application layout belong to the embedding host and are not Slate modes.
- **Host-Owned Presentations**: VS Code presents the document through its native text editor, Diagram Editor, Viewer, and tracking Preview. The web editor may compose equivalent browser-owned panes around Slate without defining shared-editor contracts.
- **Component Ownership**: A host component owns its title, controls, commands, and body. Application coordination must not absorb component-specific interactions.
- **Inspector**: Inspector is read-only and reports diagram or selection state. Editing belongs in Slate or a host-owned text/Legend editor.
- **Text Editing**: Hosts edit the live Topos document and choose their checkpoint boundary. VS Code uses its native text buffer; the web editor commits a text-editing session through browser history.

### Editor State & Mutation (Pointer-Based)

The editor relies exclusively on direct object references for entity tracking, rather than string IDs.

- **Uniform Mutation Context**: Every public mutation receives the complete `TraceMap` as its first argument, even when its current implementation does not need it. Treat this parameter as the mutation API's pseudo-`this`: it keeps the complete model available as invariants and reconciliation evolve. Do not remove or bypass an apparently unused map parameter.
- **Transactional Snapshots**: A map gesture keeps one cloned starting state for explicit cancellation. Individual transient steps do not clone the model.
- **Pointer Integrity**: Crucially, `structuredClone()` preserves horizontal references (topology). Selection pointers stay valid and consistent with the model within each snapshot. This avoids the complexity of trying to reverse-edit or guess the current selection after a mutation.
- **Normalized Selection Ownership**: An editor selection never contains both an attachment and its selected owner. `normalizeTraceSelection()` removes labels, termini, and grid cells when their parent is also selected. Mutation code may rely on this invariant; selection expansion for copy, deletion, or movement is a separate operation and must not be mistaken for user selection state.
- **Imperative Mutation**: Mutations act directly on the trace model. Invalid arguments may throw as programming errors; ordinary user limits return without changing the affected trace.
- **Rule**: Never add ID bookkeeping or per-step rollback to mutations. Gesture cancellation and map-source-keyed editor snapshots preserve topology and pointer stability; undo navigation belongs to the source host.
- **Interaction Lifecycle**: Successful transient mutations update the projection immediately; commit reconciles the final map and records it in the source host.
- **Creation Drafts**: Before commit, replacing a draft removes only it and its owned termini; no reconciliation is needed.

### Legend

- **Legend + Enamel Loop**: Legend editing is live document state and drives host-owned rendered previews and views.

## 3. Shared Editor & VS Code Extension Rules

### Host Priority

- **Primary Product**: The VS Code extension is the primary production host for interactive editing.
- **Secondary Product**: `www/editor` is a secondary browser host. It may adapt the shared editor but must not drive host contracts that make the VS Code integration more complex.
- **Development Harness**: `www/slate.html` exists only to emulate VS Code's source, commit, undo, and clipboard boundary during browser development. It must not define a third editor architecture.

### Topos Slate Visual Editor (`src-editor/slate`)

- **Strict Decoupling**: The reusable visual editor under `src-editor/slate/` and its model under `src-editor/model/` must never import web-editor, Deno-specific, or VS Code-specific host packages. Keep browser interaction logic self-contained.
- **Keyboard Shortcut Identity**: Match letter shortcuts with `KeyboardEvent.code` (for example, `event.code === "KeyA"`), never character-valued `event.key` such as `"a"`. Modified letter keys are layout- and platform-dependent and otherwise fail on macOS.
- **Single Model Ownership**: The UI and gesture controller must never maintain duplicate coordinate states. Always delegate positions, selections, and text configurations back to the `EditorModel` to avoid synchronization lag.
- **Intermediate vs. Persistent Mutations**: The interaction controller calls `beginMapEdit()` for a gesture, handlers use `updateMap()` for transient steps, and the controller calls `finishMapEdit()` or `cancelMapEdit()` at the lifecycle boundary. Complete editor operations use `command()`.
- **Host Composition**: Reusable Slate owns canvas interaction, not host application chrome. Text, Legend, Inspector, Preview, Viewer, export, and other surrounding UI remain host concerns.

### VS Code Extension (`vscode-topos`)

- **Dual Runtime Separation**: The extension is split into two isolated runtime environments:
  - **Extension Host**: Code in `extension.ts`, `commands.ts`, `editor-provider.ts`, and the Viewer/Preview providers runs in the VS Code extension host. It has access to documents, native clipboard interfaces (`vscode.env.clipboard`), and commands.
  - **Webview Iframe Sandbox**: Code in `webview/main.ts` runs inside a browser sandbox iframe. It has no access to VS Code APIs and must delegate document changes and clipboard operations through `postMessage`.
- **Native Document Delegation**: Rely on VS Code's native `CustomTextEditorProvider` text buffer replacement flow for dirty state and save notifications. Never write custom file save alerts or custom panel dialogs.
- **Sandbox Clipboard Bridge**: Maintain the message-passing pipeline between `webview/main.ts` and `editor-provider.ts` for all copy/cut/paste commands. Never use raw `navigator.clipboard` calls within client-side code.
