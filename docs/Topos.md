# Topos Manifesto

<img src="../media/logo-tr-sm.png" align="right" width="120" alt="Topos logo">

## I. The Three-Body Problem of Diagramming

When creating architectural diagrams, we are trapped in a trilemma:

1. **The Auto-Layout Trap:** Declarative text-to-diagram engines give us diffable source code, but surrender layout to automation. Position, proximity, grouping, and ordering are not presentation choices; they are architectural meaning expressed spatially. Those choices end up driven by heuristics optimizing edge length, crossings, and whitespace that have very little to do with preserving that meaning.

2. **The Graphical Trap:** Graphical drawing tools and infinite whiteboards preserve our spatial authorship, but they entomb that meaning. The "source" is usually an opaque binary blob—or, at best, proprietary and extremely verbose XML/JSON. It lives outside ordinary text workflows, is hostile to code review, and leaves coding agents dependent on vision-based interpretation or deciphering tool-specific serialization.

3. **The ASCII-Art Trap:** Traditional ASCII diagrams preserve readable spatial source directly in the text, but beyond simple sketches, authoring character-cell geometry becomes awkward—and the same artifact is the final presentation, locking the diagram into a charmingly nostalgic ASCII-art form. Some excellent tools make ASCII-art authoring far more comfortable through a separate graphical model. But once ASCII stops being the editable source and becomes the output format, the very property that made it valuable as a diagramming medium is lost.

## II. The Topos Bet

Topos makes a single core bet to break the trilemma:

**Position, grouping, routes, and containment are authored directly in the source. Their spatial arrangement is the meaning of the diagram. Topos gives that source comfortable geometry editing and presentation-grade vector graphic output.**

## III. Charting the Map

The Topos bet has an obvious price: if geometry lives in the source, geometry has to be authored there. Topos calls this spatial section the Map. Reading a map is easy; drawing and rearranging one in a text editor is not.

The original Topos design tried to solve this with the Napkin: a free-form description of intent from which an LLM would draw the Map. The division of labor seemed natural: the human supplied the meaning, the model handled the geometry.

In practice, current LLMs are simply not good enough at the second part. They can produce small diagrams, but reliability falls apart quickly as geometry becomes more demanding: alignment drifts, routes break, and changes that require several coordinated spatial edits become unpredictable. The Napkin depends on an ability the models do not have yet.

Curiously, the limitation is strongly asymmetric. LLMs can understand Topos diagrams considerably more complex than those they can reliably draw. They can follow connections and containment, reason about the architecture, review changes, and make local edits long after creating the same geometry from scratch has become unreliable. For silicon-based readers, spatial text remains a useful working representation even where reliable spatial authoring breaks down. That boundary may recede or disappear with future models, and Topos users will only benefit when it does.

For carbon-based authors, the practical answer became the Diagram Editor built into the Topos VS Code extension. It brings familiar direct-manipulation editing to shapes and connections, so spatial work feels like using a graphical tool: draw, move, resize, route, reshape. Yet every operation changes the Map text itself. The source remains the artifact.

## IV. Illuminating the Script

The Map has one job it cannot delegate: spatial structure. Shapes, connections, labels, containment, and layout belong there because their placement matters. Explanatory detail competes for the same space, and a diagram quickly becomes less useful when names, metadata, and decoration start pushing its structure apart.

The Legend takes that pressure off the Map. It can expand a terse label, attach semantics, choose a visual shape, or add presentation that plain text can only name rather than embody. Text can say blue; the rendered shape can simply be blue. Richer information remains attached to the diagram without demanding more room inside its geometry.

The idea comes from ordinary geographic maps. The map carries geography; the legend supplies presentational detail. Topos follows the same division: the Map carries the spatial statement, the Legend shapes its presentation.

The Legend itself is a compact, CSS-like rule language. Rules select things already present in the Map and enrich them with rendered labels, shapes, colors, fills, links, typography, and other properties. They can apply broadly or narrowly and compose; when rules conflict, the last one wins. Common choices can therefore be stated once and refined where needed.

Rendering brings the two together. The renderer preserves the authored layout — relative position, grouping, containment, and routing — without treating every character coordinate as sacred. It can center labels, refine shapes, adjust local spacing, and turn textual lines into SVG geometry, with the authored layout remaining the governing structure.

The payoff is a diagram meant to be presented to people, not merely tolerated as readable source. SVG gives Topos typography, color, shapes, effects, and resolution-independent output, while still allowing a diagram to remain visually neutral enough to belong in the document around it. A restrained palette can become light or dark, fills can remain subtle tints rather than fixed paint, and the diagram will look at home in documentation, a browser, or on a presentation slide.

## V. Living as Text

Once a diagram lives as ordinary text, it can move through the world disguised as code. Repositories, pull requests, tickets, and chats welcome it as one of their own. Through the harsh world of encodings, transport protocols, serializers, and indifferent software, it will survive and thrive.

The clipboard extends this portability to fragments. Select part of a diagram in the Diagram Editor and copy it; what lands on the clipboard is compact plain text, ready to drop into code, documentation, chat, or another diagram. The path works both ways: paste text diagrams back into the editor and they become editable geometry again.

Markdown is a natural habitat for Topos diagrams. With the extension installed, VS Code’s standard Markdown Preview renders fenced `topos` blocks in place beside the prose they explain. A standalone `.topos` file can also be linked as an ordinary Markdown image and rendered directly, so documentation can include the live diagram effortlessly.

From the command line, `.topos` files can be rendered directly to SVG for build pipelines and documentation tooling. The extension can export both SVG and PNG when a raster image is needed.

That is the Topos bet: readable source, authored layout, and presentable graphics can remain one artifact — when the spatial arrangement is worth authoring and preserving.

## Kudos

**[MonoSketch](https://monosketch.io/)** — an excellent graphical editor for ASCII diagrams and an influence on the thinking behind Topos.

**[JsonML](https://www.jsonml.org/)** — represents XML and HTML as JSON with striking simplicity, yet remains far less widely known than it should be. Topos uses it extensively throughout the implementation.
