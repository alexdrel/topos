import { assertEquals, assertObjectMatch } from "@std/assert";
import { matchChild, matchEdge, testParseDiagram, testCompleted, flushPendingWrites } from "../../test/test-utils.ts";

Deno.test.afterEach(flushPendingWrites);

Deno.test("Inline Annotations - extracts from box ceiling rawLabels", (t) => {
    const input = `\
+========================+
| System .class#id@Sys   |
+========================+
`;
    const { root } = testParseDiagram(t, input);
    // Clean label for data/legend, raw source in rawLabels for rendering
    const box = matchChild(root, { label: "System", $rawLabels: 1 });
    assertEquals(box.rawLabels?.[0].text, "System .class#id@Sys");
    testCompleted(t);
});

Deno.test("Inline Annotations - extracts from inline nodes", (t) => {
    const input = `\
[ Auth Service @Service.pill ]
`;
    const { root } = testParseDiagram(t, input);
    const inline = matchChild(root, { label: "Auth Service", $rawLabels: 1 });
    assertObjectMatch(inline.rawLabels![0], { text: "[ Auth Service @Service.pill ]", x: 0 });
    testCompleted(t);
});

Deno.test("Inline Annotations - from ceiling rawLabels", (t) => {
    const input = `\
+-DB @database---+
|                |
+----------------+
`;
    const { root } = testParseDiagram(t, input);
    // Pure sigil note is moved to rawLabels.
    const box = matchChild(root, { label: "DB", $children: 0, $rawLabels: 1 });
    assertObjectMatch(box.rawLabels![0], { text: "DB @database" });
    testCompleted(t);
});

Deno.test("Inline Annotations - moves mixed notes to rawLabels", (t) => {
    const input = `\
+----------------+
| Group          |
| .hatch         |
| .blue          |
+----------------+
`;
    const { root } = testParseDiagram(t, input);
    // Pure sigil note is moved to rawLabels.
    const box = matchChild(root, { label: "Group", $children: 0, $rawLabels: 1 });
    assertEquals(box.rawLabels?.[0].text, "Group\n.hatch\n.blue");

    testCompleted(t);
});

Deno.test("Inline Annotations - keeps notes if they have extra text, but extracts sigils if possible", (t) => {
    const input = `\
+--Group---------+
|    #g1.xyz     |
+----------------+
`;
    const { root } = testParseDiagram(t, input);
    const box = matchChild(root, { label: "Group", $children: 0, $rawLabels: 2 });
    assertEquals(box.rawLabels?.[0].text, "Group");
    assertEquals(box.rawLabels?.[1].text, "#g1.xyz");
    testCompleted(t);
});

Deno.test("Inline Annotations - moves clustered sigil notes w/o spaces", (t) => {
    const input = `\
+-------------------+
| Group             |
|                   |
| #clustId@test.a.b |
+-------------------+
`;
    const { root } = testParseDiagram(t, input);
    const box = matchChild(root, { label: "Group", $children: 0, $rawLabels: 2 });
    assertEquals(box.rawLabels?.[1].text, "#clustId@test.a.b");
    testCompleted(t);
});

Deno.test("Inline Annotations - preserves edge annotations in label", (t) => {
    const input = `\
[ A ] -- Edge .link#e1 --> [ B ]
`;
    const { root } = testParseDiagram(t, input);
    // Clean label is "Edge", raw source in rawLabels
    const edge = matchEdge(root, { label: "Edge" });
    assertEquals(edge.rawLabels?.[0].text, " Edge .link#e1 ");
    testCompleted(t);
});

Deno.test("Inline Annotations - box with only annotation cluster", (t) => {
    const input = `\
┌─────────┐
│  .red   │
└─────────┘
`;
    const { root } = testParseDiagram(t, input);
    const box = matchChild(root, { label: undefined, $children: 0, $rawLabels: 1 });
    assertEquals(box.rawLabels?.[0].text, ".red");
    testCompleted(t);
});

Deno.test("Notes: Notes should not contain rawLabels", (t) => {
    const input = `\
┌───────────┐
│    A      │
│    B      │
└───────────┘`;
    const { root } = testParseDiagram(t, input);
    const box = matchChild(root, { nodeType: "box", $children: 1 }, 0);
    const note = box.children[0];
    assertEquals(note.nodeType, "note", "Child should be a note");
    assertEquals(note.rawLabels?.length, 1, "Standalone note should have 1 label segment");
    testCompleted(t);
});
