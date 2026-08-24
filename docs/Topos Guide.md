# Topos User Guide

<img src="../media/logo-tr-sm.png" align="right" width="120" alt="Topos logo">

Topos turns plain-text sketches into polished diagrams. This guide builds one diagram from a single line of text to something worth sharing, using the Topos extension for VS Code throughout.

The example follows the history of Mars rovers and the communication network that grew around them. The diagram will become more complete as we need more Topos features—not because Mars is getting farther away while you read.

Open the Markdown Preview beside this guide while reading it. The Topos extension renders every diagram in the guide, so you can compare its text with the finished visual result.

## 1. From One Line to a Diagram

Create a new text file in VS Code and save it as `mars.topos`. Type one line:

```topos
NASA --> Deep Space Network --> Mars Pathfinder --> Sojourner
```

Click **Open in Diagram Editor** in the editor title, or run **Topos: Open in Diagram Editor** from the Command Palette. The words and arrows are now geometry you can manipulate. Select everything with Cmd/Ctrl-A and press Alt/Option-A to convert the diagram from ASCII to Unicode. Drag the labels into a rough two-by-two layout, then Cmd/Ctrl-drag around each label to draw a box.

Drag the boxes, connections, and endpoints into place, then use the arrow keys for exact alignment. An arrowhead can sit in the box border or a few spaces away; Topos will still connect the arrow to the box. This first version should not take more than a minute:

```topos
                      # Year: 1997
┌───────────────────┐              ┌───────────────────┐
│ Deep Space Network├─────────────▶│  Mars Pathfinder  │
└─────────▲─────────┘              └─────────┬─────────┘
          │                                  │
          │                                  │
┌─────────┴─────────┐              ┌─────────▼─────────┐
│       NASA        │              │     Sojourner     │
└───────────────────┘              └───────────────────┘
```

You started with one line of ordinary text. A moment later, you have a diagram you can arrange visually while it remains readable text.

> **The text is the diagram.**
>
> The map text is the primary source of geometry and positioning. The Diagram Editor does not maintain a separate drawing behind it; visual edits rewrite that same text.

This map is already a complete Topos diagram. Everything that follows is optional structure, meaning, or presentation to add when a diagram needs it.

For your next diagram, run **Topos: New Diagram** to create a new Topos document and open it directly in the Diagram Editor.

## 2. Build Richer Structure

> By 2004, NASA was operating the twin rovers Spirit and Opportunity, and an orbiter could carry much more of their data back to Earth. The next snapshot expands the diagram to show that network.

Several Diagram Editor tools are useful at this scale. Cmd/Ctrl-D duplicates a selection downward; Cmd/Ctrl-] duplicates it to the right. With one item selected, typing replaces its text. These make repeated elements such as the twin rovers quick to create and rename.

Boxes provide structure as well as visible borders. **Ground Segment** is a grid whose cells contain the Deep Space Network and JPL Mission Control. **Rovers** is a regular container holding two inline boxes, written compactly as `[ Spirit ]` and `[ Opportunity ]` instead of drawn border by border. Its contents remain independently editable. Cmd/Ctrl-click selects the container and includes or excludes its contained items from the selection; **Toggle Contents** offers the same action in its context menu.

Typing with a line selected gives the connection a label. Press Space to open the **Style** controls for selected lines, boxes, or endpoints. A compatible style change can be applied to several selected items at once. When an endpoint is selected, the same controls provide an arrowhead picker; Topos orients the available arrowheads for the line direction and adjusts them when the direction changes.

Connection labels make the different routes explicit. Line weights and solid, dashed, or dotted styles give them a visual hierarchy without adding more boxes or explanatory text.

Emoji are text too, so sprinkle them at will. Mars Odyssey has earned its satellite.

```topos
                             # Year: 2004

           ┌────────X-band──────────────────▶[ 🛰️ Mars Odyssey ]
           │                                          ▲
           │                                          │
           │                                      UHF relay
           │                                          │
           ▼                                          │
 ┏━Ground Segment━━━━┓                   ┌──Rovers────▼───────────┐
 ┃                   ┃                   │                        │
 ┃ Deep Space Network┃◃┈┈X-band direct┈┈▹│                        │
 ┃                   ┃                   │     [    Spirit    ]   │
 ┣━━━━━━━━━━━━━━━━━━━┫                   │                        │
 ┃                   ┃                   │     [  Opportunity ]   │
 ┃JPL Mission Control┃                   │                        │
 ┃                   ┃                   │                        │
 ┗━━━━━━━━━━━━━━━━━━━┛                   └────────────────────────┘
```

> **A small geometric vocabulary**
>
> Boxes, lines, and text combine into grids, containers, labeled routes, and larger systems.

## 3. Structure Before Color

> By 2012, Curiosity and MRO had joined the network while Spirit had fallen silent. The diagram also opens the Deep Space Network to show its three facilities.

The added detail does not require color. Boxes use a faint version of the current foreground color; when nested, their semi-transparent fills layer over their parents. Each level becomes slightly denser, creating visible depth and hierarchy while the diagram remains monochrome.

The names follow geographic maps deliberately. A map places roads, cities, and boundaries; its legend explains how to read their symbols. Topos uses the same split. The `:map` section is the spatial source of geometry and positioning. The stylesheet-like `:legend` section selects those entities and enriches their presentation or behavior without changing the map.

A map needs no section marker, even when a Legend follows it. This guide starts using the optional `:map` marker alongside `:legend` because the symmetrical headings make the two sections easier to scan. The **Create Legend** action at the bottom of the Diagram Editor adds them and reopens the same document as text. Once a Legend exists, the action is named **Edit Legend**.

Each Legend line has a selector before `:` and one or more declarations after it, much like a compact CSS rule:

```topos
:map
                                       # Year: 2012         ┌─Mars Orbit────────┐
                                                            │ [    Odyssey   ] S│
                   ┌───────X-band──────────────────────────▶│                   │
                   │                                        │ [      MRO     ] S│
                   │                                        └─────────▲─────────┘
                   │                                                  │
                   │                                                  │
┏━Ground Segment━━━▼━━━━━━━━━━━━━━━━┓                             UHF relay
┃  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃                                 │
┃  ┃     Deep Space Network      ┃  ┃                                 │
┃  ┠─────────┬─────────┬─────────┨  ┃                                 │
┃  ┃Goldstone│  Madrid │Canberra ┃  ┃                       ┌─Rovers──▼─────────┐
┃  ┗━━━━━━━━━┷━━━━━━━━━┷━━━━━━━━━┛  ┃◃┈┈┈X-band direct┈┈┈┈┈▹│ [  Opportunity ] A│
┃                                   ┃                       │                   │
┃  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃                       │ [   Curiosity  ] A│
┃  ┃     JPL Mission Control     ┃  ┃                       │                   │
┃  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃                       │ [    Spirit    ] X│
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛                       └───────────────────┘

:legend
Odyssey: "Mars Odyssey"
MRO: "Mars Reconnaissance Orbiter"
Spirit: dotted fill=soft href="https://xkcd.com/695/"
A: "🔋"
X: "🪫"
[Mars Orbit]: fill=none
S: "🛰️"
```

`Odyssey` and `MRO` select the short map labels; quoted declarations replace their rendered text. Topos calls standalone text placed in the map a **note**. The `S`, `A`, and `X` rules select notes and replace their rendered text with emoji. As with any selector, each rule applies to every matching entity.

Declarations compose. The Spirit rule applies a dotted border, soft fill, and `href`. In the rendered Preview, Spirit becomes a link to [XKCD 695](https://xkcd.com/695/) for the emotionally prepared.

`[Mars Orbit]` demonstrates a multi-word selector; the brackets identify its target as a box. `fill=none` scopes the declaration to its fill, so the nested orbiter boxes remain tinted. The map still owns geometry; the Legend enriches its presentation without moving or rerouting anything.

The Legend has one cascade rule: when matching declarations conflict, the latest Legend rule wins.

> **Structure before color**
>
> Layered box tints reveal hierarchy in monochrome, while Legend rules enrich labels, styling, and behavior without changing map geometry.

## 4. Organize and Emphasize

> By 2022, Perseverance and Ingenuity were exploring Mars while Spirit and Opportunity had fallen silent. JWST had joined the Deep Space Network from Sun-Earth L2, giving the diagram a new destination closer to home.

At this scale, more enclosing boxes would confuse location with containment. Topos regions provide a quieter spatial frame. The headings `## Space`, `## Earth`, and `## Mars` divide the canvas into regions, while boxes inside them continue to describe actual systems and groups.

```topos
:map

                              # Year: 2022
 ## Space
      ┌─────────────┐                                 ╭─────Mars Orbit────╮
      │   # JWST   S├┈◎ L2                            │ [    Odyssey   ] S│
      └────▲────────┘                                 │                   │
           │                   ╭────────X-band───────▶│ [      MRO     ] S│
           │                   │                      ╰─────────────▲─────╯
           │    (Roadster)     │     ( Teapot )                     │
           │                   │                                    │
 ## Earth  │                   │                ## Mars             │
           │                   │                                UHF relay
           ├──▶{Webb Images}   │                 <Ingenuity>«───╮   │
           │                   │                                │   │
           │                   │                      ╭─Rovers──┼───▼─────╮
   ┏━━━━━━━▼━━━━━━━━━━━━━━━━━━━▼━┓                    │         ⩔         │
   ┃     Deep Space Network      ┃                    │ [ Perseverance ] A│
   ┠─────────┬─────────┬─────────┨◃┈┈┈X-band direct┈┈▹│                   │
   ┃Goldstone│  Madrid │Canberra ┃                    │ [   Curiosity  ] A│
   ┗━━━━━━━━━┷━━━━┳━━━━┷━━━━━━━━━┛                    │                   │
                  ║                                   │ [  Opportunity ] X│
   ╔══════════════╩══════════════╗                    │                   │
   ║     JPL Mission Control     ║                    │ [    Spirit    ] X│
   ╚═════════════════════════════╝                    ╰───────────────────╯

:legend
JPL%: "Jet Propulsion Laboratory ↵ Mission Control" trapez
Odyssey: "Mars Odyssey"
MRO: "Mars Reconnaissance Orbiter"
Spirit, Opportunity: dotted fill=soft
Spirit: href="https://xkcd.com/695/"
Opportunity: href="https://xkcd.com/1504/"
A: "🔋"
X: "🪫"
[Mars Orbit]: fill=none pill
S: "🛰️"
[Mars Orbit] > *, [Rovers] > * : rounded
{Mars}: href="https://xkcd.com/2433/"
JWST: "James Webb Space ⏎ Telescope" bevel
{Webb Images}: "Desktop wallpapers" href="https://science.nasa.gov/mission/webb/multimedia/images/"
{Space} > (*): soft
Roadster: "🚗 Tesla Roadster"
Teapot: "🫖 Russell's Teapot"  href="https://en.wikipedia.org/wiki/Russell%27s_teapot"
L2: "**Sun–Earth** Lagrange Point 2"
```

Region hierarchy can also scope Legend rules. The rule `{Space} > (*): soft` uses a direct parent-child selector to make the parenthesized notes inside Space quieter.

The map already carries a real pen style in its characters. Its ASCII or Unicode family, line weight, and sharp or rounded corners survive into the rendered diagram. The **Style** controls rewrite those characters directly; the rounded Mars containers, curved connection bends, and double JPL border therefore remain part of the map rather than hidden formatting.

The Legend can preserve that authored pen style while overriding the rendered outline with shapes that plain box-drawing characters cannot express. Here, `bevel`, `pill`, and `trapez` reshape JWST, Mars Orbit, and JPL respectively. The declarations compose with the map, so JPL keeps its double border while becoming a trapezoid. Inline map forms provide useful shapes too: parenthesized text becomes a pill, `<Ingenuity>` a rhombus, and `{Webb Images}` a parallelogram.

Not every connected entity needs a box. The `◎ L2` glyph is a hub: the adjacent text names it, and a line can terminate on that compact point.

Two selector conveniences keep the Legend concise. A comma gives Spirit and Opportunity the same inactive treatment, while `JPL%` matches a label that starts with `JPL`. The selector continues to use the map label even after the Legend replaces its displayed text.

Text adds another layer. `# JWST` explicitly identifies the title of a box that also contains another note. In Legend text, `↵` forces a line break in the expanded JPL label, while `**Sun–Earth**` uses familiar Markdown emphasis. A short map label can therefore remain easy to position even when the rendered label needs more detail.

> **More than boxes**
>
> Regions organize the canvas, while shapes, borders, and formatted labels make its contents distinct. This monochrome vocabulary also adapts naturally to almost any background or VS Code color theme.

## 5. Bring It to Life

> The year has not changed. This version shifts attention from where the network's parts sit to what moves between them.

The previous snapshot aimed for quiet clarity. This version deliberately turns the presentation layer further to show activity and flow. Its geometry changes only where the two JWST channels need separate paths; the animation itself comes from the Legend.

```topos
:map
                              # Year: 2022

 ## Space
      ┌─────────────┐                                 ╭─────Mars Orbit────╮
      │   # JWST   S├┈◎ L2                            │ [    Odyssey   ] S│
      └─────▵─┬─────┘      ╭───────────X-band────────▶│                   │
            ┊ │            │                          │ [      MRO     ] S│
            ┊ │            │                          ╰─────────────▲─────╯
            ┊ │            │                                        │
 ## Earth   ┊ │            │                    ## Mars             │
            ┊ │            │                                    UHF relay
            ┊ │            │                     <Ingenuity>«───╮   │
            ┊ │            │                                    │   │
            ┊ │            │                          ╭─Rovers──┼───▼─────╮
   ┏━━━━━━━━┻━▼━━━━━━━━━━━━▼━━━━━┓                    │         ⩔         │
   ┃     Deep Space Network      ┃                    │ [ Perseverance ] A│
   ┠─────────┬─────────┬─────────┨◃┈┈┈X-band direct┈┈▹│                   │
   ┃Goldstone│  Madrid │Canberra ┃                    │ [   Curiosity  ] A│
   ┗━━━━━━━━━┷━━━━┳━━━━┷━━━━━━━━━┛                    │                   │
                  ║                                   │ [  Opportunity ] X│
   ╔══════════════╩══════════════╗                    │                   │
   ║     JPL Mission Control     ║                    │ [    Spirit    ] X│
   ╚═════════════════════════════╝                    ╰───────────────────╯

:legend
JPL%: "Jet Propulsion Laboratory ↵ Mission Control" trapez
Odyssey: "Mars Odyssey"
MRO: "Mars Reconnaissance Orbiter"
Spirit, Opportunity: dotted fill=soft
A: "🔋"
X: "🪫"
[Mars Orbit]: fill=none pill
S: "🛰️"
[Mars Orbit] > *, [Rovers] > * : rounded
JWST: "James Webb Space ⏎ Telescope" bevel
{Space} > (*): soft
L2: "**Sun–Earth** Lagrange Point 2"
// Animations perimeter
Deep% : #DSN ping particle-scale=1 particle-phase=0
Ingenuity: dashed animate animation-speed=3
[Mars Orbit]: ping animate particle-count=2
// Animations edges
"X-band direct":  animate-reverse animation-speed=0.2
"UHF relay": animate spark
X-band: loose animate dashed spark particle-balance=75 particle-count=7
Ingenuity<->Perseverance: animate dotted animation-speed=slow
#DSN -> JWST: "S-band" left animate tail=dot animation-speed=slow
JWST -> #DSN: "Ka-band" block left=1 animate packet particle-count=4 particle-scale=1.6
// Effects
Rovers : stroke=chalk
Rovers > [*] : chalk
Perseverance, Curiosity: animate animation-speed=slow
```

Legend declarations control independent visual aspects, so they can be combined instead of choosing one monolithic style. `animate` activates forward motion; `animate-reverse` reverses it without changing the edge or its arrowheads. `packet`, `spark`, and `ping` choose what moves, while parameters such as count, scale, speed, phase, or balance tune the result. Only the parameters needed by a particular entity have to be stated. `animation-speed` accepts `slow`, `fast`, or a positive numeric multiplier: values below `1` slow the animation, while values above `1` accelerate it.

Edges can be selected as relationships, including their direction. `Deep%` matches the Deep Space Network and gives it the short identity `#DSN`; the two rules `JWST -> #DSN` and `#DSN -> JWST` can then treat the downlink and uplink independently. Their quoted declarations add the visible band labels, while `left` and `left=1` keep the neighboring labels apart.

The Ka-band downlink becomes a block edge carrying several large packets. The S-band uplink retains its light dotted map style and moves slowly in the other direction. Elsewhere, sparks travel through the relay routes, the direct X-band stroke flows without particles, and `particle-balance=75` biases traffic by sending more particles one way than the other on a bidirectional channel.

Motion is not limited to connections. Pings travel around the Mars Orbit perimeter, while Ingenuity's dashed outline moves in place. The rover rules combine two more aspects: `chalk` supplies a rugged texture to the group, and only Perseverance and Curiosity animate, leaving the inactive rovers still.

Markdown Preview and the Topos Viewer render these animations directly. When the operating system requests reduced motion, Topos stops animated strokes and effects and hides moving particles automatically.

> **Motion without moving the map**
>
> The map still owns every route and direction. The Legend animates traffic and activity along that existing geometry.

## 6. Work in Text and Diagram

A `.topos` document has three modes in VS Code:

- The **Diagram Editor** is where the map takes shape.
- The **text editor** exposes the exact Topos source. It is handy for quick map text edits and is the place to author Legend rules.
- The **Viewer** presents the finished, fully rendered diagram.

All three modes use the same document and stay synchronized; saving, undo, and redo behave as usual. The buttons in the tab's title bar are the quickest way to switch modes, with the same actions also available through keyboard shortcuts and the Command Palette.

### Diagram Editor

Drawing follows the gesture itself. The same Cmd/Ctrl-drag used in the first diagram becomes a box when it spans rows and columns, or a line when it stays on one row or column. Alt/Option-drag creates a line along an arbitrary route, including bends. The **Create** menu offers explicit Text, Box, Line, Hub, and Glyph tools when choosing first is clearer.

Click an element to select it, and Shift-click to add or remove more. Dragging empty space selects an area; modifiers turn the same gesture into addition or subtraction. A container can be selected alone or together with its contents. The resulting selection can be moved, nudged, duplicated, deleted, or copied as a unit.

Dragging is best for broad movement; arrow keys nudge the selection one cell at a time. With Shift, the arrow keys resize selected boxes instead. Boxes also have resize handles, while line points and endpoints can be dragged to reshape a route directly.

With geometry selected, Space opens the contextual **Style** inspector. It changes line family, weight, and corners, or offers suitable glyphs for selected hubs and line endpoints. Shift-Space opens the full **Glyph** palette: choose a text control, wire character, arrowhead, or hub and place it anywhere on the map.

Occasional reshape shortcuts cover useful constructions without adding tools: Alt/Option-B draws a box around the selection, while Alt/Option-I switches a note and inline node. Shift with I cycles the inline bracket shape.

When the surrounding layout needs to move, a space warp is quicker than selecting everything on one side. Cmd/Ctrl-Shift-drag empty space right or down to insert rows or columns; drag left or up to collapse them. The diagram beyond the gesture moves while its geometry stays together.

Duplication can place a selection below it, to its right, or in any chosen arrow-key direction. If you adjust the first duplicate and repeat the same direction, Topos reuses the new spacing. This quickly builds an evenly arranged row or column without measuring it first.

Zoom and the optional alignment grid help when the map grows dense. The `?` controls sheet keeps the exact gestures and shortcuts close at hand.

Topos geometry remains ordinary text wherever it goes. A selection copied from the Diagram Editor is not an image or a private drawing format: paste it into a text file, Markdown document, issue, or message and it remains readable. The reverse works too. Paste ASCII or Unicode diagram text from any source into the Diagram Editor and it becomes editable geometry where you place it, without redrawing. Pasting a complete Topos document brings its map and any new Legend rules with it.

Copy the whole document when you want to keep its layout and Legend intact. Copy a smaller selection when you want a reusable piece of the map.

### Text Editor

The text editor helps you write the Legend. Selector suggestions come from the map and narrow as you type; after the selector, completion offers semantic types, scopes, properties, and style values.

### Viewer

The Viewer follows document changes live. Its controls fit into three groups:

- **Size:** Cmd/Ctrl-wheel or `+` / `-` zoom; `0` or double-click toggles actual size / fit-all; `1` / `2` fit width / height.
- **Appearance:** `T` cycles host / light / dark; `F` toggles whether it overrides authored choices.
- **Output:** `E` opens Export.

> **One document, three modes**
>
> Shape the map visually, author its Legend in text, and inspect the rendered result without creating separate versions. The source remains ordinary text wherever it goes.

## 7. Add Color Deliberately

> Color works best here as another layer of structure. The 2022 network keeps the same geometry, while Earth, Mars, Space, and one focal point gain distinct visual roles.

The first version applies Topos's built-in named colors:

```topos
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

:legend

JPL%: "Jet Propulsion Laboratory ↵ Mission Control" trapez
Odyssey: "Mars Odyssey"
MRO: "Mars Reconnaissance Orbiter"
Spirit, Opportunity: dotted fill=soft
Spirit: href="https://xkcd.com/695/"
Opportunity: href="https://xkcd.com/1504/"
A: "🔋"
X: "🪫"
[Mars Orbit]: fill=none pill
S: "🛰️"
[Mars Orbit] > *, [Rovers] > * : rounded
{Mars}: href="https://xkcd.com/2433/"
JWST: "James Webb Space ⏎ Telescope" bevel
{Space} > (*): soft
Deep% -> JWST: "S-band" left tail=dot
JWST -> Deep%: "Ka-band" block left=1 chevron particle-count=5
L2: "Sun–Earth L2" yellow

[/]: blue
Mars: red
Earth: green
{*}: stroke=none
```

Topos deliberately starts with a small palette: `gray`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, plus black and white. Each name represents a family of tones rather than one literal RGB value. Topos uses the hue more strongly for labels and lines, more softly for fills, and lets translucent fills combine as boxes are nested. A few colors can therefore produce rich layering while the whole diagram still feels coordinated.

`[/]: blue` gives blue a broad job by coloring the whole diagram. Earth and Mars then override it for their regions and everything inside them; Space has no override, so it remains blue. Yellow marks the small L2 accent. `{*}: stroke=none` removes region borders, allowing their quiet backgrounds to separate the fields without drawing three more boxes.

Because the derived fills remain translucent, the diagram adapts to the surface behind it. The same rules work across VS Code themes without maintaining a separate palette for each one.

In a Markdown `topos` fence, `theme=light` or `theme=dark` can choose a different rendering context without changing the diagram itself.

The second version takes more control over the presentation:

```topos
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

:legend bg = #034


JPL%: "Jet Propulsion Laboratory ↵ Mission Control" trapez
Odyssey: "Mars Odyssey"
MRO: "Mars Reconnaissance Orbiter"
Spirit, Opportunity: dotted fill=soft
Spirit: href="https://xkcd.com/695/"
Opportunity: href="https://xkcd.com/1504/"
A: "🔋"
X: "🪫"
[Mars Orbit]: fill=none pill
S: "🛰️"
[Mars Orbit] > *, [Rovers] > * : rounded
{Mars}: href="https://xkcd.com/2433/"
JWST: "James Webb Space ⏎ Telescope" bevel
{Space} > (*): soft
Deep% -> JWST: "S-band" left tail=dot
JWST -> Deep%: "Ka-band" block left=1 chevron particle-count=5
L2: "Sun–Earth L2" yellow

[/]: blue
Mars: red fill-color = #203746
Earth: green
{*}: stroke=none

/blue: #4B9BC8
/green: #2AA198
/red: #D16A46
```

The map and its named color assignments stay the same. `bg=#034` sets an authored canvas, while `/blue`, `/green`, and `/red` redefine the base hue of each color family for this document. Its stronger lines and labels and its softer translucent fills all change together, without replacing meaningful names throughout the Legend with scattered hex values.

`fill-color=#203746` gives the broad Mars region a precisely authored surface without replacing its named color. Mars remains red for its label, contents, and connections. Exact colors work well for isolated exceptions, while the named palette continues to carry the visual system.

> **Name the role, then tune the palette**
>
> Named colors keep a diagram adaptable and its rules readable. When the final presentation needs tighter control, choose its background, tune the named palette, and reserve exact colors for exceptions.

## 8. To Topology and Beyond

> Architecture diagrams often carry more than topology. Semantic shapes and stacks enrich simple map geometry; abstract connections leave routing to the renderer, and fenced notes preserve code.

````topos
                # Document Processing Service

                                 ┌┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┐
                                 ┊               Processing Cloud @cloud                  ┊
                                 ┊                                                        ┊
                                 ┊                                                        ┊
                                 ┊                                                        ┊
                                 ┊                             ┌───────────────────────┐  ┊
   ┌───────────────────┐         ┊                           ┌─┴─────────────────────┐ │  ┊
   │                   │         ┊                         ┌─┴─────────────────────┐ │ │  ┊
   │                   │         ┊  ┌─────────────┐        │                       │ │ │  ┊
   │    Web Client     ├─────────┼─▶│  Upload Srv ├───────▶│   Conversion Workers  │ ├─┘  ┊
   │                   │         ┊  └─────────────┘        │                       ├─┘    ┊
   │                   │         ┊                         └──┬────────────────────┘      ┊
   └────────▲──────────┘         ┊                            │                           ┊
            │                    ┊                            │                           ┊
            │                    ┊                            │  ┌────────────────┐       ┊
            │                    ┊                            │  │ Processing logs│       ┊
            │                    ┊                            │  │ @file          │       ┊
            │                    ┊                            │  └────────────────┘       ┊
            │                    ┊                            │                           ┊
            │                    ┊                            │                           ┊
            │                    └┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┼┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┘
            │                                                 ╰────────────╮
            │                                                              │
    ┌───────┴──────┐           ```                        ┌────────────────▼────────────────┐
    │  Documents   │           CREATE TABLE documents (   │                                 │
    │  @folder     │             id UUID,                 │           Document Store        │
    └──────────────┘             status                   │           @database             │
                                   LowCardinality(String) │                                 │
                               ) ENGINE = MergeTree       └─────────────────────────────────┘
                               ORDER BY id;
                               ```

:legend
Documents: "Local Documents"
[Web Client]: @browser stack=4,-1,2
[Processing logs]: stack=2,-1
[Upload Srv]: "Upload Service" stack
[Conversion Workers] ~> [Processing logs]: head=dart
%CREATE% : right=map soft
````

Semantic shapes answer **what kind of thing is this?** The inline `@folder`, `@cloud`, `@file`, and `@database` annotations turn simple map geometry into recognizable architectural forms. Their rendered silhouettes are not confined to the exact rectangles drawn in the map: folder tabs, file corners, database rims, and cloud curves may extend beyond them. Leave some breathing room when placing a semantic shape close to its neighbors.

Inline annotations are not limited to semantic shapes; they can also carry IDs and styling values. Equivalent declarations can live in the Legend instead, as `[Web Client]: @browser` demonstrates. The choice is mostly one of convenience and source appearance. Inline annotations keep a small fact beside its entity; Legend rules keep a busy map quieter.

Stacks answer **one or many?** Conversion Workers are elaborately drawn as an overlapping stack in the map. The others are added more compactly by Legend annotations: bare `stack` supplies the standard treatment, while `stack=4,-1,2` and `stack=2,-1` set the number of layers and their offset. Both approaches use the familiar layered-outline convention; the choice depends on whether the expanded stack or a compact box is more useful to see in the map source. Stacking composes with semantic shapes, so browsers and files repeat as browsers and files rather than reverting to plain boxes. Either way, the result remains one labeled component with the same connections.

The Conversion Workers and Processing logs have no connecting line in the map. Their `~>` rule creates that relationship directly in the Legend. The renderer aims a straight line from the center of one entity to the center of the other, with its visible ends stopping at their outlines. `head=dart` chooses the marker at the destination. This is the quick way to add a direct connection without adding route geometry beyond the map's intended level of detail.

The database schema is a standalone fenced note. Code fences select `code` mode automatically: physical lines and spaces are preserved, Markdown-like punctuation remains literal, and the text uses a monospace font by default. The fence itself is source syntax and is not rendered. `%CREATE%` selects the complete note; `right=map` preserves its authored right edge, keeping the code close to the database while allowing the longer rendered lines to extend left. `soft` makes it supporting detail.

## 9. Render, Embed, and Export

> Documentation can keep a diagram as editable text. Image-only destinations and automated builds can render that same source when they need an artifact.

### Render in VS Code Markdown Preview

The Topos extension teaches VS Code's standard Markdown preview to render a fenced `topos` block in place:

````markdown
```topos
[ Client ] ─────────▶ [ Service ]
```
````

The source remains ordinary editable text in the Markdown document, while the preview shows the finished diagram next to the surrounding explanation. With the cursor inside a fence, Topos commands use the complete fence as the diagram boundary. **Open in Diagram Editor** creates an editable untitled snapshot; copying it back into the fence updates the document explicitly.

Markdown can also render a local `.topos` file through ordinary image syntax, without maintaining a separate exported asset:

```markdown
![Architecture](./architecture.topos#width=800 "System architecture")
```

Renderer parameters follow `#` in the image URL. The optional quoted Markdown image title replaces the title authored by the diagram.

### Export When an Image Is Needed

Markdown often needs no exported asset. When another destination expects an image, **Topos: Export Diagram** opens an Export Preview for the current diagram. From there, copy SVG as text or save an SVG or PNG file. SVG preserves the vector result; PNG is convenient for software that does not accept SVG.

The default path asks only for the output. **Customize…** is available when the destination needs a particular light or dark presentation, an opaque or transparent background, or a specific width.

### Render from the Command Line

The VS Code extension makes `topos` available in new integrated terminals, so the same renderer can be used in scripts and build tools without installing a separate runtime. With a file argument, the default output is an SVG in the current directory, named after the input:

```sh
topos diagram.topos
topos diagram.topos -o diagram.svg
topos diagram.topos -
topos --help
```

A file followed by `-` writes SVG to standard output, while `topos -` reads Topos source from standard input. Either side can therefore participate in a pipeline.

### Control a Particular Render

Most diagrams need no additional rendering instructions. When a destination has requirements, render parameters use the same `name=value` form in document headers, Markdown fence tails, linked `.topos` image fragments, CLI arguments, and Export's **Additional Parameters** field. For example, `theme=dark` selects a dark rendering basis, `width=800` requests an 800-pixel SVG, and `animation=false` produces a still result without changing the Legend.

The same presentation can therefore be expressed close to the source or at a particular destination:

- Document header: `:map theme=dark width=800`
- Markdown fence: `` ```topos theme=dark width=800 ! `` (`!` requests override)
- Markdown image: `![Diagram](./diagram.topos#theme=dark&width=800)`
- CLI: `topos diagram.topos theme=dark width=800`

External parameters normally extend the diagram: authored values win, and the destination supplies what is missing. Override mode lets explicitly supplied external values win without clearing unrelated authored choices. Add `!` to a Markdown fence tail or choose **Export** priority in the Export UI. The CLI exposes the same choice; `topos --help` documents its syntax. When override is not requested, the diagram retains priority.

The `.topos` file or Markdown fence remains the durable, editable source. SVG is the portable vector result; PNG is the convenient raster result for places that do not accept it.

> **Keep rendered outputs reproducible**
>
> Markdown Preview, Export, and the CLI use the same source and renderer. Keep lasting presentation choices with the diagram and apply destination-specific choices when rendering, so documentation, automated builds, and exported assets do not drift into separate versions.

## Reference

### Topos Document

| Form                 | Meaning                                                               |
| -------------------- | --------------------------------------------------------------------- |
| map text only        | A complete map-only document; `:map` is optional.                     |
| `:map parameters`    | Starts or labels the spatial map and sets authored render parameters. |
| `:legend parameters` | Starts Legend rules; matching parameters override those on `:map`.    |
| `// comment`         | Legend comment.                                                       |

### Map Elements

| Source form                            | Result                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| box-drawing rectangle                  | Box or container; nested boxes establish containment.                                                      |
| shared box borders                     | A box divided into attached grid cells; each enclosed compartment can hold its own text.                   |
| plain text                             | A label when attached to a box, line, or hub; otherwise an independent note.                               |
| `[Text]`, `(Text)`, `<Text>`, `{Text}` | Compact inline entities; see **Geometric Shapes** below.                                                   |
| `●`, `○`, `◎`, `◆`, …                  | Hub glyph: a compact entity that can be labeled, connected, used as a junction, or placed on a box border. |
| `## Region`                            | Region seed; Topos expands it around nearby content.                                                       |
| `# Title`                              | Title for the enclosing box or diagram.                                                                    |
| `@type`, `#id`, `.value`               | Inline semantic type, ID, class, or style value.                                                           |

Map-line characters determine weight, dots or dashes, corners, arrowheads, and hubs. Use the Diagram Editor's **Style** and **Glyph** controls to explore the supported characters without memorizing them.

#### Geometric Shapes

Map forms provide convenient geometry directly in the source. A Legend value can apply the same silhouette to another box without changing its map form.

| Shape             | Legend value              | Map form when available               |
| ----------------- | ------------------------- | ------------------------------------- |
| Rectangle         | `sharp`                   | `[Text]` or a box with square corners |
| Rounded rectangle | `rounded`                 | A box drawn with `╭ ╮ ╰ ╯` corners    |
| Pill              | `pill`                    | `(Text)`                              |
| Rhombus           | `rhombus`                 | `<Text>`                              |
| Beveled rectangle | `bevel`                   | —                                     |
| Parallelogram     | `parallelogram` or `skew` | `{Text}`                              |
| Trapezoid         | `trapez`                  | —                                     |

A wide rhombus keeps its pointed ends and extends through a straight middle section.

#### Text Formatting

Labels and prose notes support a small Markdown-like formatting language.

| Source                        | Result                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| `*text*`, `_text_`            | Italic                                                              |
| `**text**`, `__text__`        | Bold                                                                |
| `~~text~~`                    | Strikethrough                                                       |
| `` `text` ``                  | Inline code                                                         |
| `[text](https://example.com)` | Linked text                                                         |
| `[text](#docs)`               | Link whose destination comes from `#docs: href="..."` in the Legend |
| `⏎`, `↵`                      | Line break                                                          |
| `¶`                           | Paragraph break                                                     |
| `␠`, `⍽`                      | Visible em space or nonbreaking space                               |
| `\*`, `\_`, …                 | Literal formatting character                                        |
| `` ``` … ``` ``               | Fenced code note                                                    |

The `text` and `code` note modes preserve this punctuation literally; `code` also preserves physical lines and spaces and uses a monospace font by default. Fenced notes use `code` automatically. Labels always use prose formatting.

### Legend Rules

The latest applicable declaration wins; there is no specificity calculation. Selectors can be composed with containment or connection relationships, and comma-separated selectors apply one rule to several matches.

Bracket characters have two roles: in the map they create compact inline forms, while in a Legend selector they constrain the kind of node matched.

| Selector                                         | Matches                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `Label`                                          | Any entity with that label                                                    |
| `[Label]`, `[*]`                                 | A labeled box or any box                                                      |
| `(Label)`, `(*)`                                 | A labeled note or any note                                                    |
| `<Label>`, `<*>`                                 | A labeled hub or any hub                                                      |
| `{Label}`, `{*}`                                 | A labeled region or any region                                                |
| `*`                                              | Any entity or edge endpoint, including an unbound endpoint                    |
| `/`, `#id`, `.class`, `_`                        | Root, explicit ID, class, or unbound endpoint                                 |
| `%text%`, `text%`                                | Label containing or starting with text                                        |
| `A > B`, `A >> B`                                | Direct child or any descendant                                                |
| `^A`, `^^A`                                      | Parent or grandparent of a match                                              |
| `A -> B`, `A <- B`, `A -- B`, `A <-> B`, `A - B` | Existing directed, reverse, undirected, bidirectional, or any edge            |
| `A ~> B`, `A <~ B`, `A ~~ B`, `A <~> B`          | Create an edge not drawn in the map; see **Abstract Edges and Routing** below |

#### Declarations

Everything after `:` describes the entities matched by the selector. A rule may combine several declarations: it can replace displayed text, add meaning or identity, make an entity clickable, and style it at the same time. Declarations from every matching rule accumulate; where two style values control the same property, the later rule wins.

| Declaration                                 | Effect                                                                | Example                                      |
| ------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| `"Display text"`                            | Replaces the rendered label without changing what selectors match     | `MRO: "Mars Reconnaissance Orbiter"`         |
| `@type`                                     | Assigns a semantic type, including a built-in shape                   | `Store: @database`                           |
| `#id`                                       | Gives the entity an explicit identity                                 | `Service: #upload`                           |
| `.class`                                    | Adds a reusable class for later rules                                 | `Service: .worker`                           |
| `href="..."`                                | Makes the rendered entity a link                                      | `Guide: href="https://example.com"`          |
| `key=value`                                 | Sets a named property                                                 | `Workers: stack=3,1,1`                       |
| typed values                                | Applies recognized colors, weights, shapes, effects, and other styles | `Service: blue strong rounded`               |
| `scope=value,...`                           | Restricts typed values to a visual channel                            | `Service: fill=blue,soft label=strong`       |
| `fill-color`, `stroke-color`, `label-color` | Assigns an exact CSS color, bypassing the Topos palette               | `Service: fill-color=#203746`                |
| `font`, `font-weight`                       | Assigns an entity-level CSS font family or weight                     | `Note: font="IBM Plex Mono" font-weight=600` |
| `reset`                                     | Clears style values accumulated earlier for the selected entity       | `Service: reset`                             |

The base scopes are `fill=`, `stroke=`, and `label=`; edge markers use `head=` and `tail=`. Their accepted values are grouped in the tables below.

A palette declaration such as `/blue: #268bd2` maps a Topos color family to a CSS color for the document. Exact paint properties instead assign a CSS color to one local channel: `fill-color`, `stroke-color`, or `label-color`. CSS colors include familiar names such as `navy`, hexadecimal values such as `#203746`, and functional forms such as `rgb(...)`; they are distinct from the small Topos palette listed below.

### Style Values

| Axis                | Values                                                           |
| ------------------- | ---------------------------------------------------------------- |
| Intensity           | `tint`, `none`, `ghost`, `soft`, `strong`, `heavy`, `solid`      |
| Pattern             | `no-pattern`, `hatch`, `backhatch`, `crosshatch`, `stripes`      |
| Effect              | `no-effect`, `xkcd`, `sketch`, `chalk`, `shadow`, `glow`, `neon` |
| Weight              | `single`, `bold`, `double`, `dashed`, `dotted`                   |
| Edge body           | `standard-body`, `block`                                         |
| Edge routing        | `path`, `ray`, `taut`; see **Abstract Edges and Routing** above  |
| Endpoint attachment | `no-gap`, `gap` / `s-gap`, `m-gap`, `l-gap`                      |
| Layering            | `flat`, `stack`; numeric `stack=layers,dx,dy`                    |
| Geometric shape     | See the table under **Map Elements**                             |
| Line corners        | `sharp`, `tight`, `rounded`, `loose`, `bevel`, `rhombus`         |
| Animation           | `static`, `animate`, `animate-reverse`                           |
| Particle            | `no-particle`, `spark`, `ping`, `chevron`, `packet`              |
| Text placement      | See **Text Placement** below                                     |
| Note mode           | `prose`, `text`, `code`                                          |

#### Topos Palette

Topos color values name adaptable families rather than exact CSS colors. Their final paint is mixed with the diagram's paper and responds to intensity, layering, and palette declarations.

| Value                                                | Meaning                                    |
| ---------------------------------------------------- | ------------------------------------------ |
| `ink`                                                | Return to the diagram's default foreground |
| `black`, `gray`, `white`                             | Neutral color families                     |
| `red`, `orange`, `yellow`, `green`, `blue`, `purple` | Named color families                       |

#### Base Scopes

Unscoped values style the entity as a whole. A scope applies comma-separated values to one visual channel instead.

| Scope     | Applies to                    | Example                 |
| --------- | ----------------------------- | ----------------------- |
| `fill=`   | Interior or background        | `fill=blue,soft`        |
| `stroke=` | Outline or line               | `stroke=red,strong`     |
| `label=`  | Text, including its placement | `label=purple,left,top` |

#### Text Placement

Named values place a complete text block within its entity; line alignment controls the individual lines inside that block.

| Control             | Values                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Horizontal position | `left`, `right`, `start`, `end`, `center`, `third`, `two-thirds`, `twothirds`, `1/3`, `2/3`, `quarter`, `three-quarters`, `1/4`, `3/4` |
| Vertical position   | `ceiling`, `top`, `middle`, `bottom`                                                                                                   |
| Line alignment      | `align-left`, `align-center`, `align-right`                                                                                            |

Exact placement uses `left=`, `center=`, `right=`, `top=`, or `middle=` with a percentage, a numeric map-column or map-row offset, or `map` to preserve the corresponding coordinate authored in the map. The horizontal properties anchor the block by its left edge, center, or right edge respectively. `leading=` controls spacing between lines. Placement and alignment values may also be grouped in `label=`.

#### Abstract Edges and Routing

Most edges begin as lines drawn in the map; their characters establish both the relationship and its route. An abstract-edge operator creates the relationship in the Legend instead, without requiring a line in the map. For example, `[Web Client] ~> [Document Store]: dashed` creates a directed dashed edge.

The operators `~>`, `<~`, `~~`, and `<~>` create directed, reverse-directed, undirected, and bidirectional edges. Their selectors may be composed like other Legend selectors, so one rule can connect several matching entities. Abstract edges have no authored path and therefore render as straight rays by default.

Two routing values can simplify an edge that was drawn in the map:

| Route  | Result                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `taut` | Keeps the edge's start and end connections but pulls the route straight between them.                                    |
| `ray`  | Ignores the drawn route and connects the source and target through their centers; used automatically for abstract edges. |

Routing changes only the rendered path. The connected entities and direction remain the same.

#### Endpoint Markers

| Scope   | Applies to        | Example                |
| ------- | ----------------- | ---------------------- |
| `head=` | Edge end marker   | `head=triangle-hollow` |
| `tail=` | Edge start marker | `tail=circle`          |

Use `head=gap` or `tail=gap` to leave one empty cell. `m-gap` and `l-gap` increase the distance; `no-gap` forces contact with the node perimeter.

Marker values are `no-marker`, `end-cap`, `arrow`, `crowfoot`, `triangle`, `triangle-hollow`, `dart`, `dart-hollow`, `angle`, `double-arrow`, `dot`, `circle`, `diamond`, `square`, `square-hollow`, `circle-dot`, `diamond-hollow`, and `hexagon`. For hubs, use the same marker names without a scope.

#### Animation and Particles

`animate` and `animate-reverse` activate forward or reverse motion; `static` returns to the default. Particles may travel along edges or around entity outlines.

| Property           | Values or effect                                                                    |
| ------------------ | ----------------------------------------------------------------------------------- |
| `animation-speed`  | `slow`, `fast`, or a positive numeric multiplier                                    |
| `particle-count`   | Exact number of particles; takes precedence over density                            |
| `particle-density` | Particles per ten character-widths of rendered path                                 |
| `particle-scale`   | Positive size multiplier                                                            |
| `particle-phase`   | Percentage shift around the path                                                    |
| `particle-random`  | Random placement; the assigned value acts as a stable seed                          |
| `particle-balance` | Percentage (`0–100`) or ratio (`0–1`) sent in one direction on a bidirectional edge |

#### Semantic Shapes

| Type        | Shape                                                   |
| ----------- | ------------------------------------------------------- |
| `@database` | Cylindrical database                                    |
| `@file`     | Page with a folded corner                               |
| `@folder`   | Tabbed folder                                           |
| `@cloud`    | Cloud outline; also usable as a region boundary         |
| `@browser`  | Browser window with navigation controls and address bar |
| `@windows`  | Windows-style application window                        |
| `@mac`      | macOS-style application window                          |
| `@ui`       | Generic application window                              |
| `@ux`       | Application window with a pointer                       |

The authored map rectangle establishes placement, but it does not clip the silhouette. Tabs, folded corners, rims, window chrome, and cloud curves may extend beyond it, so leave room around closely placed shapes.

### Render Parameters

Each tool accepts a diagram title in its natural syntax. In a `.topos` document, put a standalone quoted title on `:map` or `:legend`, beside any parameters: `:map "Service Architecture" theme=dark`. A Markdown fence uses the same quoted title on its opening line. The CLI uses a render parameter instead: `topos diagram.topos title="System Context"`. A linked `.topos` image uses the ordinary quoted Markdown image title. Each form supplies the displayed diagram title, replacing a `# Title` drawn in the map when present.

Parameters use `name=value` on `:map`, `:legend`, Markdown fence tails, linked `.topos` image fragments, CLI arguments, and Export's **Additional Parameters** field.

The color-valued parameters below take CSS colors, not **Topos Palette** values. Thus `red` is interpreted as the CSS named color, while `#203746` and `rgb(...)` may specify an exact color directly.

| Parameter             | Values or purpose                                           |
| --------------------- | ----------------------------------------------------------- |
| `theme`               | `light`, `dark`                                             |
| `bg`                  | CSS color, `light`, `dark`, or `transparent`                |
| `paper`               | CSS color used as the canvas mixing base                    |
| `ink`                 | CSS color used as the default foreground                    |
| `font`, `font-weight` | Typography; quote font names containing spaces              |
| `title`               | Diagram title for parameter-based renderers such as the CLI |
| `w`, `h`              | Viewport size in map cells                                  |
| `padx`, `pady`        | Explicit padding in map cells                               |
| `scale`               | Output-size multiplier                                      |
| `width`               | Exact intrinsic width in pixels                             |
| `animation=false`     | Disable animation without changing the Legend               |

### Diagram Editor Essentials

| Action                                              | Control                                      |
| --------------------------------------------------- | -------------------------------------------- |
| Create box/line/hub adaptively                      | Cmd/Ctrl-drag                                |
| Draw an arbitrary routed line                       | Alt/Option-drag                              |
| Create a hub                                        | Alt/Option-click                             |
| Select; add/remove                                  | Click; Shift-click                           |
| Marquee replace/add/subtract                        | Drag; Shift-drag; Shift-Alt/Option-drag      |
| Move; nudge; resize                                 | Drag; arrows; Shift-arrows                   |
| Duplicate down/right/direction                      | Cmd/Ctrl-D; Cmd/Ctrl-]; Shift-Cmd/Ctrl-arrow |
| Open Style / Glyph controls                         | Space / Shift-Space                          |
| Toggle ASCII/Unicode; toggle corners; reverse lines | Alt/Option-A, R, F                           |
| Cycle box stack layers                              | Alt/Option-S                                 |
| Cycle box stack layout                              | Alt/Option-Shift-S                           |
| Draw a box around the selection                     | Alt/Option-B                                 |
| Toggle note/inline; cycle inline brackets           | Alt/Option-I; Alt/Option-Shift-I             |
| Toggle the alignment grid                           | Alt/Option-G                                 |
| Select document / map only                          | Cmd/Ctrl-A / Cmd/Ctrl-Alt/Option-A           |
| Zoom / reset                                        | Cmd/Ctrl-wheel / Cmd/Ctrl-0                  |
| Complete controls sheet                             | `?`                                          |

### VS Code

The title-bar buttons, keyboard shortcuts, and Command Palette switch a `.topos` document among text, Diagram Editor, and Viewer modes. Markdown commands use the complete `topos` fence under the cursor; commands in other text files use the current selection.

| Command                                   | Purpose                                                           |
| ----------------------------------------- | ----------------------------------------------------------------- |
| **Topos: New Diagram**                    | Create an untitled diagram.                                       |
| **Topos: Open in Diagram Editor**         | Edit a document, fence snapshot, or selected text.                |
| **Topos: Open Preview to the Side**       | Track the active Topos source.                                    |
| **Topos: View Diagram**                   | Open a stable rendered snapshot.                                  |
| **Topos: Export Diagram**                 | Copy SVG or save SVG/PNG.                                         |
| **Topos: Copy Coding Agent Instructions** | Copy task instructions with paths to the installed Guide and CLI. |

### CLI

```sh
topos diagram.topos                 # write diagram.svg
topos diagram.topos -o output.svg   # choose output
topos diagram.topos -               # write SVG to stdout
topos -                             # read source from stdin
topos --help                        # complete CLI reference
```

### Coding Agents

Run **Topos: Copy Coding Agent Instructions** before asking a coding agent to create, edit, render, or inspect a Topos diagram. The command copies a short, task-scoped instruction block containing absolute paths to this IDE's installed Topos Guide and CLI launcher. Paste it into the agent conversation so the agent can edit `.topos` as text, consult the same Guide, run `topos --help`, and use `--inspect` while producing SVG. The command supplies context and paths; it does not install an agent or alter the workspace.

For agent work, `--inspect` prints the resolved diagram as semantic JSON: its hierarchy, connections, formatting, visual intent, and compact geometry. It can accompany file output, so `topos diagram.topos -o output.svg --inspect` writes the SVG while sending the inspection to standard output. This lets an agent understand and validate the diagram without interpreting raw SVG. The inspection shape is intentionally unstable and should not be used as an interchange format.
