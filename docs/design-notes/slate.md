# Topos Slate Visual Editor

Topos Slate is the reusable visual editor for direct manipulation of raw trace geometry. The VS Code custom editor is its primary production host. `www/editor` is a secondary browser host, while `www/slate.html` is a development harness that emulates the VS Code source, commit, undo, and clipboard boundary.

Slate uses browser APIs but has no dependency on VS Code, Deno, files, native clipboard services, or application chrome. An embedding host supplies complete Topos source and decides how committed source is persisted.

## Scope

Slate is a trace-geometry authoring environment built around one `EditorModel`. It does not maintain a second mutable Canvas or semantic AST. Refine, Legend annotation, and Enamel rendering remain downstream consumers of the authored text.

This boundary keeps the authoring model invertible: visual edits immediately produce Topos text, and host-provided text can rebuild the same editable geometry.

## Layers and Ownership

The editor is split into three layers:

- **Model (`src-editor/model/`)** owns the complete Topos document, trace state, selection, projection, transactions, and pointer-valid source snapshots. Low-level mutations live under `src-editor/model/mutate/`.
- **Slate (`src-editor/slate/`)** owns visual rendering, hit testing, keyboard and pointer input, inline editing, and gesture lifecycle.
- **Embedding host** owns persistence, undo/redo navigation, native clipboard integration, and surrounding application chrome.

Within Slate, `interact.ts` coordinates pointer gesture lifecycle and `trace-interaction.ts` translates gestures into model mutations. `slate.ts` owns the visual surface and composes those interactions.

Interactions have a deliberately small result contract. `onDown` may reject a gesture, `onMove` may request a render or return the current selection, and `onUp` may return the completed selection. The controller owns applying that selection and closing the interaction; interactions do not mutate selection directly.

The model is the single source of truth. Interactions and views must not keep competing diagram coordinates or selection state.

```topos
┌───────────────────────┐
│  Pointer + keyboard   │
└─────────┬─────────────┘
          ▼
┌───────────────────────┐
│    Slate surface      │◀──── projection + notifications ──┐
└─────────┬─────────────┘                                   │
          ▼                                                 │
┌───────────────────────┐                                   │
│ Interaction controller│                                   │
└───────────┬───────────┘                                   │
            ▼                                               │
┌───────────────────────┐                                   │
│      EditorModel      ├───────────────────────────────────┘
└───────────┬───────────┘
            │ owns
            ▼
┌───────────────────────┐
│     ToposDocument     │
└───────────┬───────────┘
      committed source
            │
┌───────────▼───────────┐
│     Embedding host    │
└───────────────────────┘
```

## Document Model

`EditorModel` owns a mutable `ToposDocument`. Document composition remains separate from trace geometry so document-wide selection, clipboard, and Legend changes can commit together without making Slate host-aware.

The read-only section parser in `src/topos.ts` recognizes two ordered sections:

1. An optional `:map` header at source offset zero, followed by map content.
2. The first `:legend` header at column zero, followed by Legend content.

Unknown headers and later section-looking lines are ordinary content. Headers may contain a title and string parameters; the document derives the effective title and parameters from the map and Legend headers.

`src-editor/model/document.ts` provides the mutable document operations:

- `mapSource` exposes normalized LF map content to the trace model.
- `legendSource` exposes the complete LF Legend section.
- `setMapProjection()` installs newly projected map text.
- `setLegendSource()` replaces or removes the Legend.
- `mergeLegendSource()` appends new, non-duplicate Legend rules during paste.
- `source` composes the complete document for the host.

`ToposDocument` has no events, transactions, history, or host knowledge. Untouched source text round-trips exactly. After an edit, the document is recomposed with its detected line ending, so mixed line endings become consistent.

## Pointer-Based State

Trace relationships and selection contain direct object references rather than editor-owned IDs. `structuredClone()` preserves topology among traces, labels, termini, parents, and selection within a snapshot.

Consequently:

- mutations receive and modify live trace objects;
- semantic Legend IDs remain semantic and are not editor bookkeeping;
- gesture cancellation restores one cloned gesture-start state;
- map-source-keyed snapshots restore pointer-valid state when known source returns;
- mutations must not introduce manual ID repair or per-step rollback.

Selection is normalized when it changes. Tight attachments—labels, termini, and grid cells—are omitted when their owner is selected. Nested boxes remain independent selections. Operations trust this invariant; clipboard projection expands the selected owners back to their physical attachments.

## Mutation and Interaction

`EditorModel.updateMap()` is the transient mutation boundary. It modifies the live trace state, refreshes projection, and notifies the view immediately. Ordinary user limits leave an affected trace unchanged; invalid mutation arguments throw as programming errors.

A pointer gesture follows one lifecycle:

1. The controller calls `beginMapEdit()` and stores one complete snapshot.
2. The interaction calls `updateMap()` for each transient step.
3. The controller calls `finishMapEdit()` or `cancelMapEdit()`.

Completion performs deferred reconciliation, such as final label association, and emits one committed complete source for the host. Cancellation restores the gesture-start snapshot. Individual transient steps never create rollback clones or history entries.

Creation interactions keep their transient geometry structurally valid. The universal Cmd/Ctrl-drag interaction chooses a line for one row or column, a box for an area, and a hub when an active draft collapses back to one cell. It replaces the draft when that geometry class changes, so pointer movement provides immediate feedback in both directions. A Cmd/Ctrl-click creates no draft and remains a contents-selection gesture. Explicit Box, Line, Hub, Text, and Glyph tools remain shape-specific.

Replacing an uncommitted creation draft uses a lightweight deletion path. The draft has not been reconciled with surrounding labels or geometry, so only the draft and its owned termini need removal; general deletion and reconciliation would be both wasteful and semantically premature.

Immediate commands use `command()` to mutate and commit in one operation. Continuous gestures may render many transient states but produce one source checkpoint.

## Projection and Clipboard

Projected plain text is observable model state and is refreshed after every successful mutation. During interaction, the visible grid therefore always matches the current traces.

Clipboard exchange uses Topos text rather than private JSON:

- copy expands selected owners to their attachments and projects a cropped text grid;
- paste parses text into traces at the last interaction anchor;
- pasting a complete Topos document inserts its map geometry and merges its Legend rules;
- explicit document selection copies authored offsets and the Legend, while a marquee covering every trace remains an ordinary cropped geometry selection.

Slate dispatches clipboard intent. Browser hosts may use browser clipboard APIs; the VS Code webview delegates reads and writes to the extension host.

## History and Source Synchronization

Undo and redo navigation belongs to the source host. VS Code uses native text buffer history. Browser hosts may use `src-editor/host/history.ts` to store complete source strings. Both return resulting source through `syncDocumentSource()`.

The model keeps a bounded cache keyed by map source. When known source returns, it can restore internally consistent trace and selection references without spending entries on Legend-only edits. Otherwise it reparses the map and preserves matching selections by trace coordinates. This cache supports host history; it is not an undo timeline.

The host receives complete committed source. It is responsible for persistence and for sending external document changes back to the model.

## Host Integration

The production integrations are deliberately asymmetric:

- **VS Code** owns the text document, save state, native history, commands, clipboard bridge, Viewer, and tracking Preview. Its webview embeds only the shared Slate surface.
- **Web editor** composes Slate with browser-owned panes and presentation views. Those application features may use the shared model but do not belong in Slate.
- **Development harness** mirrors the production source and clipboard boundary for browser testing; it does not define another editor architecture.

The host may decide how a Slate action is fulfilled. For example, the shared Legend control asks the host to edit the Legend: VS Code opens the text document at `:legend`, while the web editor may activate its Legend pane.

## Core Invariants

- `EditorModel` is the only owner of diagram and selection state.
- The authored Topos document is the persistent source of truth.
- Selection and trace relationships use direct references, not editor IDs.
- Complete state is cloned only for gesture cancellation and source-keyed restoration.
- Successful transient mutations update projection and rendering immediately.
- Creation gestures keep valid drafts and may replace their geometry class as the pointer moves.
- Ordinary user limits leave affected traces unchanged.
- Deferred reconciliation and persistent history changes occur at commit.
- One continuous gesture produces at most one committed undo step.
- Undo/redo navigation, persistence, and native clipboard access belong to the host.
- Slate remains independent of its embedding host and platform APIs.
