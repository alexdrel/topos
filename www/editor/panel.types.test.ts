// Compile-time tests only; fixtures are local and these functions are never called.
import type { Blueprint } from "@alexdrel/pralinejs";
import type { Panel } from "./panel.ts";

type Roots = { panelToolbar: HTMLElement; panelBody: HTMLDivElement; label: HTMLSpanElement };
declare const panel: Panel;
declare const simple: Blueprint<object, Roots>;
declare const action: Blueprint<{ activate: (event: PointerEvent) => void }, Roots>;
declare const noToolbar: Blueprint<object, { panelBody: HTMLDivElement }>;
declare const wrongToolbar: Blueprint<object, { panelToolbar: SVGSVGElement; panelBody: HTMLDivElement }>;

export function panelMaterializeTypes() {
  const refs = panel.materialize(simple);
  refs.label.textContent = "Inferred refs";
  refs.panelBody.innerHTML = "";
  // @ts-expect-error Inferred refs retain native element types.
  refs.label.value = "";
  // @ts-expect-error Ref names come from the blueprint.
  refs.missing();

  // Panel combines a partial adapter with this, without proving completeness.
  panel.materialize(action);
  panel.materialize(action, {});
  panel.materialize(action, {
    activate(event) {
      event.pointerId.toFixed();
    },
  });
  // @ts-expect-error Supplied adapter values must match Params.
  panel.materialize(action, { activate: "wrong" });
  // @ts-expect-error Object literals check unknown adapter names.
  panel.materialize(action, { unrelated: true });
  // @ts-expect-error Panel accepts one adapter object, not a source array.
  panel.materialize(action, [{ activate() {} }]);
  // @ts-expect-error Panel blueprints must declare both roots.
  panel.materialize(noToolbar);
  // @ts-expect-error Panel roots must be native HTML elements.
  panel.materialize(wrongToolbar);
}
