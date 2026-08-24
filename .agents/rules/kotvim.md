---
trigger: model_decision
description: ko md fence - Kotvim is a workflow for collaborative document authoring.
---

````ko commandment Kotvim working context
Kotvim blocks are working context for collaborative authoring. They are not
reader-facing document content, and the Markdown should remain understandable
without them.

An opening fence has the form:

    ```ko <kind> <short summary>

The short summary is for the human compact view. Keep it current when the
meaning of the block changes. The body is unrestricted natural-language
context.

Use:
- commandment / law / rule for descending editorial authority;
- plan for intended future direction;
- state for the document as it currently exists;
- todo for unresolved work.

A plan changes by decision, not merely because the current draft diverged from
it. State is a relatively stable assessment, not an activity log; update it
only when that assessment or a meaningful milestone changes. Only the author
may promote prose from WIP to draft, passed, final, or a similar milestone.

A todo may be resolved by the human or LLM; its text can say when one side must
provide something.

Placement implies scope: document-level context belongs near the document
start; section-specific context belongs after that section's heading.

Current explicit instructions from the human author override older Kotvim
context. If they conflict, follow the current instruction and update affected
working context where appropriate.

When an important editorial choice is missing or materially ambiguous —
especially audience, style, length, scope, or intended treatment — ask the
author rather than silently choosing one. For minor uncertainty, use judgment
and prefer the less committal choice.

Kotvim exists to support the document, not to become a parallel specification
or project-management system. Do not invent additional Kotvim structure when
ordinary prose inside an existing block is sufficient.
````

```ko law Section-by-section workflow
Work section by section.

Update state only when the document's meaningful status or assessment changes.
Do not alter plans merely to make them agree with whatever was drafted.
No prose is a draft or accepted merely because it has been generated.

Document-level state describes the document's overall status or assessment.
Section-specific milestones belong in state blocks near that section, not in
the document-level state.

Do only the requested stage of work. Do not advance to the next section,
resolve unrelated todos, promote state, or otherwise move the document's
workflow forward unless the author explicitly asks or approves it.

After completing the requested work, stop for review.
```

```ko law Plans change by decision
A plan expresses intended direction. Do not rewrite it merely because the draft
currently differs from it.

If draft and plan diverge, either bring the document back toward the plan or
explicitly reconsider the plan.

When headings, sections, or other document structure are moved, merged, split,
renamed, or removed, update the affected plans and other ko blocks so their scope
and content remain correct.

Do not silently change the intent of a plan while doing so. Structural edits
may require rewriting or merging plans, but only to reflect the author's
explicit structural decision.
```

```ko law Preserve decisions, not sentence fossils
When making a requested local change, preserve unrelated meaning and accepted
decisions, but revise nearby prose as needed for coherence and flow.

Do not broaden a local request into an unrelated rewrite. Conversely, do not
preserve surrounding wording so literally that a changed idea reads as a patch
inside prose written for the previous version.
```

```ko rule Break the feedback loop occasionally
Accumulated working context helps preserve intent, but can also preserve bad
assumptions and the LLM's own earlier interpretations.

Use occasional whole-document or clean-slate review without Kotvim context to
judge whether the actual prose still works on its own.
```
