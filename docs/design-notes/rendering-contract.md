# Topos Rendering Contract

Topos diagrams may author a complete appearance, only a few constraints, or no appearance at all. Rendering combines those authored parameters with one set of parameters supplied by the consumer:

```text
diagram + presentation -> concrete render parameters
```

The presentation comes from a viewer, Markdown fence or linked image, CLI, or export operation. There is no implicit multi-layer cascade.

## Priority

The consumer chooses one priority mode for all presentation parameters:

- **Extend:** diagram values win; presentation values provide defaults.
- **Override:** presentation values win where explicitly supplied. Other diagram values remain intact.

Override is not a reset: absent presentation parameters do not remove authored ones. An external title identifies its embedding and always replaces authored title.

## Surface

Rendering requires concrete `ink` and `paper` values:

- `ink` is the primary foreground.
- `paper` is the destination color used for mixing, holes, hollow shapes, and erasure-like effects. It cannot be transparent.
- `bg` is the optional canvas paint. It is independent from `paper`.

A neutral diagram authors none of them. The consumer must supply enough presentation information to make `ink` and `paper` concrete. `theme=light` and `theme=dark` expand to canonical ink and paper colors. Theme does not supply `bg`. A host theme exists only where a real host supplies its concrete colors; it is not a standalone renderer value.

`bg=light` and `bg=dark` are shorthands for the corresponding canonical paper color. They affect only `bg`.

Within either parameter set, an opaque `bg` also supplies `paper` when that same set does not specify paper. This lets `bg=navy` define the surface it paints. `bg=transparent` never supplies paper.

Topos does not infer contrast or repair incomplete explicit choices.

## Output background

Background policy is separate from parameter priority:

- `transparent: true` paints no background.
- `transparent: false` produces opaque output. It preserves a resolved opaque `bg`, otherwise it paints the resolved `paper`.
- omitted `transparent` uses the `bg` produced by parameter merging.

Views normally omit it, allowing an authored or fenced background to work. Standalone rendering defaults to a light, opaque presentation. Export UIs ask for an explicit opaque or transparent result. The CLI omits it: `--bg` supplies a canvas, while an absent `--bg` leaves an absent authored bg unset.

## Resolution

For both the diagram and presentation parameter sets independently:

1. Expand `theme` into ink and paper.
2. Expand `bg=light|dark` into its canonical color.
3. Let an opaque background supply missing paper.

Then:

4. Merge the sets according to Extend or Override priority.
5. Require concrete ink and paper.
6. Apply the output-background policy.

SVG and PNG must use the same resolved parameters.

## Examples

| Diagram       | Presentation                 | Priority | Background  | Result                          |
| ------------- | ---------------------------- | -------- | ----------- | ------------------------------- |
| none          | `theme=dark`                 | Extend   | transparent | Dark surface, no canvas paint   |
| `ink=yellow`  | `theme=dark`                 | Extend   | opaque      | Yellow ink on dark paper        |
| `theme=light` | `theme=dark`                 | Override | opaque      | Complete dark presentation      |
| `bg=navy`     | `theme=light`                | Extend   | merged      | Navy background and paper       |
| `bg=navy`     | `bg=transparent theme=light` | Override | merged      | Transparent canvas, light paper |

## API

```ts
interface RenderOptions {
  parameters: Record<string, string | undefined>;
  override: boolean;
  transparent?: boolean;
  xmlDeclaration?: boolean;
}
```

The renderer has a private standalone default, so callers needing canonical light opaque rendering may omit these options entirely.
