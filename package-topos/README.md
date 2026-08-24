# Topos - AI-Era ASCII Diagrams CLI

Topos brings direct graphical editing and rich visualization to plain-text ASCII diagrams. This package provides its `topos` command-line renderer for turning `.topos` files into presentation-quality SVG and inspecting their semantic structure as JSON—ideal for terminals, scripts, build pipelines, and coding agents.

For the complete Topos experience—including visual editing, live previews, Markdown integration, and image export—use the VS Code extension. Visit the [Topos project on GitHub](https://github.com/alexdrel/topos) for the extension, documentation, examples, and source code.

## Install

Install the command globally:

```sh
npm install --global @alexdrel/topos
```

Or run it without a global installation:

```sh
npx @alexdrel/topos diagram.topos
```

## Render

Render a file with the `topos` command:

```sh
topos diagram.topos
topos diagram.topos - > diagram.svg
topos diagram.topos -o diagram.svg -d
topos diagram.topos --inspect
topos --version
```

Use `-` as the input filename to read standard input; it writes SVG to standard output unless `-o` supplies a file. Rendering parameters use `name=value`; add `--override` when command-line values should take priority over parameters authored in the diagram.

## Inspect

Add `--inspect` to print the resolved diagram as semantic JSON. Inspection includes the annotated node hierarchy, connections, formatting, visual intent, and compact geometry. It is intended for understanding and validating what Topos parsed, and is especially useful to coding assistants. Inspection is written to standard output; SVG file output still proceeds normally, so this produces both artifacts in one pass:

```sh
topos diagram.topos -o diagram.svg --inspect > diagram.inspect.json
```

The inspection JSON is not a stable API and is not intended to become one. Its shape may change whenever a clearer or more useful representation is found.

The supported interface of this package is the `topos` command. Bundled implementation modules are internal and may change without notice.
