# Topos Slate Guide

Slate is Topos's shared visual editing surface. The VS Code Diagram Editor and the browser editor embed the same geometry, selection, formatting, and clipboard interactions. Host-specific text editing, viewing, and export commands sit outside Slate.

Press `?` while Slate is focused to open the in-editor controls sheet.

## Create

| Action                                         | Gesture or shortcut                           |
| ---------------------------------------------- | --------------------------------------------- |
| Create or edit text                            | Double-click empty space or existing geometry |
| Create geometry adaptively                     | Cmd/Ctrl-drag                                 |
| Draw a line                                    | Alt/Option-drag                               |
| Create a hub                                   | Alt/Option-click                              |
| WebOnly: Activate Box, Text, Line, or Hub tool | `B`, `T`, `L`, or `H`                         |
| Open the Create menu                           | Space with nothing selected, or `+`           |
| Open the glyph palette                         | Shift-Space                                   |
| Cancel the active tool                         | Escape                                        |

A creation tool stays active until the interaction completes or is canceled. Cmd/Ctrl-drag adapts its preview to the dragged geometry: a single row or column becomes a line, an area becomes a box, and collapsing an active draft back to one cell becomes a hub. The preview switches between these valid shapes as the pointer moves. Cmd/Ctrl-click remains the contents-selection gesture described below.

The Box, Line, and Hub tools always create the requested shape. The Create menu provides those explicit tools when gestures are easier to discover than remember.

## Select and Edit

| Action                                     | Gesture or shortcut                     |
| ------------------------------------------ | --------------------------------------- |
| Select geometry                            | Click                                   |
| Toggle geometry in selection               | Shift-click                             |
| Select a container and toggle its contents | Cmd/Ctrl-click the container            |
| Toggle a container's contents              | **Toggle Contents** in its context menu |
| Select the complete document               | Cmd/Ctrl-A                              |
| Select all map geometry                    | Cmd/Ctrl-Alt/Option-A                   |
| Replace selection with marquee             | Drag empty space                        |
| Add with marquee                           | Shift-drag empty space                  |
| Subtract with marquee                      | Shift-Alt/Option-drag empty space       |
| Edit the single selection inline           | Enter or double-click                   |
| Replace selected text immediately          | Start typing with one item selected     |
| Open or close formatting controls          | Space                                   |
| Clear selection or cancel interaction      | Escape                                  |

Complete-document selection includes authored map offsets and the Legend. All-map selection and marquee selection copy tightly cropped map geometry without the Legend.

Attached labels, line endpoints, and grid cells move with their owner. Grid cells cannot move independently, but one cell or a rectangular selection of cells can be resized.

## Move and Reshape

| Action                               | Gesture or shortcut     |
| ------------------------------------ | ----------------------- |
| Move selection                       | Drag selected geometry  |
| Nudge selection                      | Arrow keys              |
| Resize selected boxes                | Shift-arrow keys        |
| Resize one box                       | Drag its resize handles |
| Move a line point or endpoint        | Drag its handle         |
| Delete selection                     | Delete or Backspace     |
| Duplicate downward                   | Cmd/Ctrl-D              |
| Duplicate to the right               | Cmd/Ctrl-]              |
| Duplicate in a direction             | Shift-Cmd/Ctrl-arrow    |
| Rebuild geometry from projected text | Shift-Cmd/Ctrl-Enter    |

Keyboard nudging moves a selected line endpoint conservatively along its line. Pointer movement can bend it more freely.

Rebuild reparses the currently projected map. It is useful for deliberately normalizing geometry and is not a replacement for undo.

## Format and Reshape

These shortcuts apply to the current selection:

| Action                           | Shortcut           |
| -------------------------------- | ------------------ |
| Toggle Unicode/ASCII line family | Alt/Option-A       |
| Toggle rounded/sharp corners     | Alt/Option-R       |
| Reverse selected lines           | Alt/Option-F       |
| Cycle selected box stack layers  | Alt/Option-S       |
| Cycle selected box stack layout  | Alt/Option-Shift-S |
| Draw a box around the selection  | Alt/Option-B       |
| Toggle a note and inline node    | Alt/Option-I       |
| Cycle inline brackets            | Alt/Option-Shift-I |
| Toggle the ruler grid            | Alt/Option-G       |

Space opens the formatting controls for selected boxes, lines, hubs, and endpoints. The available choices depend on the selected geometry.

Enbox works with one or several selected elements. Note/inline conversion and stack controls apply to a single suitable selection.

## Clipboard

Slate uses plain Topos text as its clipboard format.

| Action                         | Shortcut   |
| ------------------------------ | ---------- |
| Copy selection                 | Cmd/Ctrl-C |
| Cut selection                  | Cmd/Ctrl-X |
| Paste at the last clicked cell | Cmd/Ctrl-V |

Copied geometry can be pasted into another Topos diagram or any text editor. Unicode and ASCII diagrams copied from elsewhere can be pasted into Slate. Pasting a complete `.topos` document inserts its map and merges new Legend rules into the current document.

The host performs the actual clipboard read or write. This keeps Slate usable inside the VS Code webview sandbox and ordinary browser applications.

## Legend

The Legend control at the edge of Slate creates, edits, selects, or excludes the document Legend depending on current state.

Legend editing belongs to the host:

- VS Code opens the document as text with the caret at `:legend`.
- The web editor activates its Legend editing pane.

Selecting the Legend allows document-wide cut, copy, and deletion to include it. Map-only selection deliberately leaves it out.

## Slate View

| Action                 | Gesture or shortcut  |
| ---------------------- | -------------------- |
| Temporarily zoom Slate | Cmd/Ctrl-mouse wheel |
| Reset Slate zoom       | Cmd/Ctrl-0           |
| Toggle ruler grid      | Alt/Option-G         |
| Open controls sheet    | `?`                  |

Slate zoom is local to the open surface unless its host chooses to persist an initial scale. The ruler grid follows character-cell centers so it aligns with diagram wires.

## Host Commands

Slate does not own text-editor, Viewer, Preview, or export UI. Common host actions include:

- VS Code: **Topos: Reopen as Text**, **Topos: Reopen as View**, **Topos: Open Preview to the Side**, and **Topos: Export Diagram**.
- Web editor: its own Source, rendered view, preview, and export panes.

These host features operate on the same Topos document but are not Slate modes.
