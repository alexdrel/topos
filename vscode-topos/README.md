# Topos - AI-Era ASCII Diagrams

<img src="media/logo-tr-sm.png" align="right" width="120" alt="Topos logo">

**Direct graphical editing and rich visualization for plain-text ASCII diagrams, with Markdown integration, SVG/PNG export, CLI rendering, and coding-agent support.**

Topos is a diagramming tool for software architecture and technical documentation. Its `.topos` source is itself a readable Unicode and ASCII diagram: characters form the boxes, connections, labels, and spatial arrangement. You can read it directly in a text editor, edit it there, or manipulate the same geometry visually in the Diagram Editor. Both ways edit the same artifact.

Rendering gives that artifact its presentation-grade graphical form. An optional Legend can add names, shapes, colors, and other presentation without taking the spatial structure out of the text.

Because the diagram remains ordinary text, it fits naturally into the workflows around code: version control, Markdown, clipboard, documentation, and coding agents.

When presentation matters, the same source renders as polished SVG or PNG.

See Topos in action: edit the diagram directly while its readable text source and rendered view stay in sync.

![Editing a Topos diagram visually while its text source and rendered view stay in sync](media/editor-demo.gif)

For syntax, examples, and a guided progression, read the [Guide to Topos Diagrams](docs/Topos%20Guide.md). With the extension installed, **Topos: Open Guide to Topos Diagrams** opens its installed copy; keep Markdown Preview beside it to see every example rendered in place.

Here is Topos at work:

![A Topos diagram showing its source, editor, and outputs](media/readme-hero.2x.png)

Here is the source behind it. The source is itself a readable diagram, with boxes, connections, and labels drawn directly in text:

```
                          # A Topos Diagram at Work

╭───────────── Plain Text Source ─╮          ╭─────────────── Viewer & Editor ─╮
│:map                             │          │                                 │
│                                 │          │  ┌─────────┐      ┌─────────┐   │
│  [Browser]────────────▸[ API ]  │          │  │ Browser ├─────▶│   API   │   │
│                           │     │          │  └─────────┘      └────┬────┘   │
│                           ▾     ◀───Edit───▶                        │        │
│                         [ DB ]  │          │                        │        │
│:legend                          │          │                        ▼        │
│Browser: blue                    │          │                  ┌────────────┐ │
│API: pill red                    │          │                  │  Database  │ │
│DB: "Database"                   │          │                  └────────────┘ │
╰────┬────────────┬───────────────╯          ╰─────────────────────────────────╯
     │            │
     │            │
     │            │
     Embed        ╰─Export─╮
     │                     │            ╭──────────────────────────────────────╮
     │                     │            │  LLM Comprehension & Version Control │
╭────┴─Markdown─╮      ╭───●───╮        │ ╭──────────╮  ╭───────────── diff ─╮ │
│               │      │       │        │ │          │  │                    │ │
│ ┌───────────┐ │      │       │        │ │# LLMs can│  │- [Browser] - > [DB]│ │
│ │ [B]-->[A] │ │      │       │        │ │grok it!¶ │  │                    │ │
│ └───────────┘ │   ╭──▼──╮ ╭──▼──╮     │ │          │  │+ [API]             │ │
│               │   │ SVG │ │ PNG │     │ ╰──────────╯  ╰────────────────────╯ │
╰───────────────╯   ╰─────╯ ╰─────╯     ╰──────────────────────────────────────╯

:legend
Browser: blue
API: pill red
Database: @database
....
```

## One Diagram to Help Them All

### Draw and edit

- **One diagram.** The visual diagram and the text in source control are the same artifact. There is no second, hidden drawing file.
- **Two ways to edit.** Move boxes and connections visually, or edit the text directly. Both change the same readable `.topos` document.
- **Version-control friendly.** Save, search, review, and compare diagrams in meaningful diffs alongside the code they describe.

### Fits your workflow

- **Plain-text clipboard.** Copy a diagram or fragment into code, documentation, chat, or any other text destination, and paste text diagrams back in.
- **Markdown-native.** Put a fenced `topos` block beside your prose or link a local `.topos` file as an image and render it directly in VS Code's standard Markdown Preview.
- **Existing diagrams welcome.** Open, improve, preview, or export selected ASCII and Unicode diagrams without converting the surrounding document.

### View, publish, and automate

- **Live View** Keep a Preview beside the source, or switch the current editor to a fully rendered Viewer.
- **SVG and PNG export.** Preview the result, then copy SVG or save a polished image with optional control over theme, background, and size.
- **Command-line rendering.** Render `.topos` files from scripts and terminals with the CLI bundled into the extension.
- **Readable to coding agents.** Agents can understand and edit the diagram as text; one command copies the guidance and local tools they need.

## More than boxes and arrows

**Topos scales from quick sketches to detailed diagrams while remaining the same kind of readable text.** This Mars communications map combines regions, nested structure, different line styles, status glyphs, links, and a compact color palette:

![A detailed Mars communications diagram rendered by Topos](media/mars-colored.2x.png)

The rendered image comes from this readable source:

```
:map

                              # Year: 2022
 ## Space
      ┌─────────────┐                                 ╭─────Mars Orbit────╮
      │  # JWST    S├┈◎ L2                            │ [    Odyssey   ] S│
      └────▵─┬──────┘                                 │                   │
           ┊ │            ╭─────────────X-band───────▶│ [      MRO     ] S│
           ┊ │            │                           ╰─────────────▲─────╯
           ┊ │            │                                         │
           ┊ │            │                                         │
           ┊ │            │                                         │
           ┊ │            │                                     UHF relay
 ## Earth  ┊ │            │                     ## Mars             │
           ┊ │            │                      <Ingenuity>«───┐   │
           ┊ │            │                                     │   ▼
           ┊ │            │                           ╭─Rovers──┼─────────╮
   ┏━━━━━━━┻━▼━━━━━━━━━━━━▼━━━━━━┓                    │         ⩔         │
   ┃     Deep Space Network      ┃                    │ [ Perseverance ] A│
   ┠─────────┬─────────┬─────────┨◃┈┈┈X-band direct┈┈▹│                   │
   ┃Goldstone│  Madrid │Canberra ┃                    │ [   Curiosity  ] A│
   ┗━━━━━━━━━┷━━━━┳━━━━┷━━━━━━━━━┛                    │                   │
                  ║                                   │ [  Opportunity ] X│
   ╔══════════════╩══════════════╗                    │                   │
   ║     JPL Mission Control     ║                    │ [    Spirit    ] X│
   ╚═════════════════════════════╝                    ╰───────────────────╯

:legend bg=#034
JPL%: "Jet Propulsion Laboratory ↵ Mission Control" trapez
Odyssey: "Mars Odyssey"
MRO: "Mars Reconnaissance Orbiter"
Spirit, Opportunity: dotted fill=soft
[Mars Orbit]: fill=none pill
Spirit: href="https://xkcd.com/695/"
Opportunity: href="https://xkcd.com/1504/"
A: "🔋"
X: "🪫"
S: "🛰️"
....
```

The map text arranges the content, while the Legend adds presentation without hiding that structure. The source and rendered result remain one diagram, ready for visual editing, review, and meaningful diffs.

## Why authored layout matters

Declarative diagram languages keep diffable source but surrender spatial meaning to auto-layout. Graphical tools preserve authored layout but hide it inside an opaque document. Traditional ASCII diagrams keep the layout readable, but become awkward to edit and limited as final presentation.

Topos keeps position, grouping, routes, and containment in readable source, then adds visual geometry editing and presentation-grade rendering. The source remains the artifact.

## Work in VS Code

Run **Topos: New Diagram** to start in the Diagram Editor.

Use **Reopen Editor With…** or Topos commands to switch between:

- **Diagram Editor** — visual editing.
- **Text Editor** — direct source access and Legend authoring.
- **Viewer** — a live rendered view of the document.
- **View** — a fixed rendering of the diagram.
- **Preview** — a live rendering that follows the active source.

Cmd/Ctrl-Shift-D switches a document between Text and Diagram editing; Cmd/Ctrl-Shift-V switches between Diagram editing and the Viewer.

For a normal diagram, boxes, arrows, text, titles, and regions are already enough. More advanced presentation is optional.

## Text interoperability

Topos uses plain text on the clipboard.

Copy elements from the Diagram Editor and paste them into source code, Markdown, a message, or any other text destination. Existing Unicode or ASCII diagram text can be pasted back into the Diagram Editor as well.

Snapshots stay uncomplicated too. When a diagram is opened from Markdown or a text selection, the editor works on an untitled Topos document. Copy the resulting text back when you want to replace the original.

## Markdown diagrams

The standard VS Code Markdown preview renders fenced `topos` blocks directly.

````markdown
```topos bg=transparent title="Request flow"
[ Browser ] ──request──▶ [ Service ]
```
````

Put the cursor inside a `topos` fence to use Topos commands. The complete fence is treated as the diagram; an incidental text selection inside it is ignored.

From a fence you can:

- Open an editable snapshot in the Diagram Editor.
- Open a tracking Preview beside the Markdown source.
- Open a stable rendered View.
- Copy or export the complete diagram.

Fence parameters participate in rendering and export, so presentation choices can stay with the Markdown document.

An ordinary Markdown image can render a local `.topos` file without producing and maintaining a separate image asset:

```markdown
![[System Architecture]](./architecture.topos#width=800 "System architecture")
```

Renderer parameters follow `#` in the image URL, and the optional quoted title names the rendered diagram.

Edits to an opened fence snapshot are intentionally not written back automatically. The snapshot remains ordinary Topos text: select all, copy, and paste it back into the fence when ready.

## Existing ASCII and Unicode diagrams

Topos is not limited to `.topos` files.

In another text document, select an ASCII or Unicode diagram and run a Topos command. The selection can be opened in the Diagram Editor, previewed, viewed, copied, or exported without changing the original file.

Source boundaries follow three simple rules:

- A `.topos` file uses the whole document.
- Markdown uses the complete `topos` fence under the cursor.
- Other text files use the explicit selection.

## Viewing and previewing

Topos provides two rendered modes for different jobs.

**Open Preview to the Side** keeps the source or Diagram Editor open and tracks the active diagram as it changes. Preview is not another document mode.

**View Diagram** creates a stable rendered snapshot from a Markdown fence or selection. It can be opened as an untitled document in the Diagram Editor.

For `.topos` documents, **Reopen as View** replaces the current editor with a linked Viewer for the same document. **Reopen as Text** and **Open in Diagram Editor** keep working with that document.

When a Preview, View, or Viewer is active, Copy and Export operate on the diagram being shown there rather than an unrelated background selection.

## Exporting

**Topos: Export Diagram** opens an Export Preview and then lets you:

- Copy SVG as text.
- Save SVG.
- Save PNG.

The common path intentionally asks very little. The preview starts with a canonical Light or Dark presentation matching the active VS Code theme. It keeps the background transparent, respects authored choices, and preserves the diagram's intrinsic size.

Choose **Customize…** when the output needs more control:

- **Theme** — Light or Dark.
- **Background** — Opaque or Transparent.
- **Priority** — Diagram or Export.
- **Width** — optional output width.
- **Additional Parameters** — advanced Topos render parameters.

**Diagram** priority preserves authored values where present. **Export** priority lets supplied export values win.

Additional parameters use the same syntax as Topos headers, Markdown fence tails, and linked `.topos` image fragments, for example `font="Helvetica"`. Each change updates the Export Preview before the file is written.

## Command-line tool

The extension makes `topos` available automatically in new VS Code integrated terminals.

There is no separate CLI package to install, and no Node.js or Deno installation is required. The CLI runs using the runtime already bundled with VS Code/Electron.

```sh
topos diagram.topos                    # write diagram.svg
topos diagram.topos -o output.svg      # choose the output path
topos diagram.topos -o output.svg -d   # render with a dark theme
topos diagram.topos --inspect          # inspect the resolved diagram
```

A global `topos` command earlier on `PATH` takes precedence.

After installing or updating the extension, reload VS Code and open a new integrated terminal if `topos` is not yet available.

`--inspect` prints a semantic representation of the resolved diagram, including its hierarchy, connections, formatting, visual intent, and compact geometry.

Rendering and inspection can be performed together:

```sh
topos diagram.topos -o diagram.svg --inspect
```

The inspection format is intended for diagnostics, comprehension, and tooling. It is not a stable interchange API and may evolve as the representation improves.

## Coding agents

Because a Topos diagram is readable text, coding agents can understand and edit it alongside the system it describes. They can add a component, update a route, review a diagram in a diff, or render the result without manipulating an opaque canvas or binary file.

**Topos: Copy Coding Agent Instructions** gives an agent the compact syntax and workflow guidance it needs, together with access to the installed Guide and command-line renderer.

## Visual editor settings

The Diagram Editor can be adjusted with these settings:

- `topos.editor.fontSizeIncrease` — percentage added to the diagram font size.
- `topos.editor.fontFamily` — optional font-family override.
- `topos.editor.selectionColor` — optional CSS color for selection indicators.
- `topos.editor.selectionSizeIncrease` — percentage added to selection indicators and their pointer targets.
- `topos.editor.rulerGrid` — show the ruler grid when opening the Diagram Editor.

Fira Code and JuliaMono are good choices when overriding the editor font.

## Commands

- **Topos: New Diagram** — create a new untitled diagram in the Diagram Editor.
- **Topos: Open Guide to Topos Diagrams** — open the syntax, tutorial, and reference guide.
- **Topos: Open in Diagram Editor** — visually edit a `.topos` document or an untitled snapshot of a fence or selection.
- **Topos: Open Preview to the Side** — open or retarget the tracking Preview.
- **Topos: View Diagram** — open a stable rendered snapshot.
- **Topos: Reopen as View** — reopen a `.topos` document in the linked Viewer.
- **Topos: Reopen as Text** — reopen a `.topos` document in the Text Editor.
- **Topos: Export Diagram** — preview and export SVG or PNG, or copy SVG text.
- **Topos: Copy Coding Agent Instructions** — copy Topos instructions and local tool paths for a coding agent.
