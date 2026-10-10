import { parseDiagram } from "../refine.ts";
import { test } from "node:test";
import { deepStrictEqual as assertEquals, partialDeepStrictEqual as assertObjectMatch } from "node:assert/strict";
import { matchChild, matchEdge } from "../../test/test-utils.ts";

test("Inline Annotations - extracts from box ceiling rawLabels", () => {
    const input = `\
+========================+
| System .class#id@Sys   |
+========================+
`;
    const { root } = parseDiagram(input);
    // Clean label for data/legend, raw source in rawLabels for rendering
    const box = matchChild(root, { label: "System", $rawLabels: 1 });
    assertEquals(box.rawLabels?.[0].text, "System .class#id@Sys");
});

test("Inline Annotations - extracts from inline nodes", () => {
    const input = `\
[ Auth Service @Service.pill ]
`;
    const { root } = parseDiagram(input);
    const inline = matchChild(root, { label: "Auth Service", $rawLabels: 1 });
    assertObjectMatch(inline.rawLabels![0], { text: "[ Auth Service @Service.pill ]", x: 0 });
});

test("Inline Annotations - from ceiling rawLabels", () => {
    const input = `\
+-DB @database---+
|                |
+----------------+
`;
    const { root } = parseDiagram(input);
    // Pure sigil note is moved to rawLabels.
    const box = matchChild(root, { label: "DB", $children: 0, $rawLabels: 1 });
    assertObjectMatch(box.rawLabels![0], { text: "DB @database" });
});

test("Inline Annotations - moves mixed notes to rawLabels", () => {
    const input = `\
+----------------+
| Group          |
| .hatch         |
| .blue          |
+----------------+
`;
    const { root } = parseDiagram(input);
    // Pure sigil note is moved to rawLabels.
    const box = matchChild(root, { label: "Group", $children: 0, $rawLabels: 1 });
    assertEquals(box.rawLabels?.[0].text, "Group\n.hatch\n.blue");
});

test("Inline Annotations - keeps notes if they have extra text, but extracts sigils if possible", () => {
    const input = `\
+--Group---------+
|    #g1.xyz     |
+----------------+
`;
    const { root } = parseDiagram(input);
    const box = matchChild(root, { label: "Group", $children: 0, $rawLabels: 2 });
    assertEquals(box.rawLabels?.[0].text, "Group");
    assertEquals(box.rawLabels?.[1].text, "#g1.xyz");
});

test("Inline Annotations - moves clustered sigil notes w/o spaces", () => {
    const input = `\
+-------------------+
| Group             |
|                   |
| #clustId@test.a.b |
+-------------------+
`;
    const { root } = parseDiagram(input);
    const box = matchChild(root, { label: "Group", $children: 0, $rawLabels: 2 });
    assertEquals(box.rawLabels?.[1].text, "#clustId@test.a.b");
});

test("Inline Annotations - preserves edge annotations in label", () => {
    const input = `\
[ A ] -- Edge .link#e1 --> [ B ]
`;
    const { root } = parseDiagram(input);
    // Clean label is "Edge", raw source in rawLabels
    const edge = matchEdge(root, { label: "Edge" });
    assertEquals(edge.rawLabels?.[0].text, " Edge .link#e1 ");
});

test("Inline Annotations - box with only annotation cluster", () => {
    const input = `\
┌─────────┐
│  .red   │
└─────────┘
`;
    const { root } = parseDiagram(input);
    const box = matchChild(root, { label: undefined, $children: 0, $rawLabels: 1 });
    assertEquals(box.rawLabels?.[0].text, ".red");
});

test("Notes: Notes should not contain rawLabels", () => {
    const input = `\
┌───────────┐
│    A      │
│    B      │
└───────────┘`;
    const { root } = parseDiagram(input);
    const box = matchChild(root, { nodeType: "box", $children: 1 }, 0);
    const note = box.children[0];
    assertEquals(note.nodeType, "note", "Child should be a note");
    assertEquals(note.rawLabels?.length, 1, "Standalone note should have 1 label segment");
});
