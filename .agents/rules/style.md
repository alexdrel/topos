---
trigger: always_on
---

# Topos Coding Style Rules

## 1. Type Safety & Syntax

- **No `any`**: Avoid `any`. Use `as unknown as T` for partial mock objects in tests rather than generating code with `any` and fixing it later.
- **Exhaustive Checks**: Use exhaustive type checks in `switch` statements for union types.
- **Circular Refs**: Modern module imports are used. Circular references are generally fine.
- **Function Declarations**: Use standard `function` declarations for top-level logic and exported functions (avoid `const fn = () => {}`).
- **File Names**: Use kebab-case for multiword `.ts`, `.html`, `.css`, and example `.topos` filenames. Do not add a redundant `topos-` prefix inside Topos-owned components. Preserve established package entry-point names such as `src/topos.ts` and `package-topos/topos-core.ts`.
- **Clean Design & Elegance Over Minimal Diff**: Always prioritize high-quality, elegant structural design and clean refactoring. Do not resort to quick-fixes, regex patches, or ugly hacking to minimize diff sizes. Code clarity, correctness, and robust architecture must take absolute precedence over producing a small diff.

## 2. Error Handling & Mutation Boundaries

- **Parser Pipeline**: NEVER throw exceptions in the parser or annotation layers. There is no caller to handle them, and a partial render is always better than crashing.
- **Editor Mutations**: Editor mutation functions throw on invalid arguments. Ordinary user-facing limits should reject the affected change without throwing.

## 3. Enamel & SVG Styling

- **Self-Contained Output**: Keep Enamel SVG output self-contained. Shared visual styling must live in embedded CSS and reusable SVG `<defs>` rather than ad hoc per-element presentation attributes.
- **Compendium Only**: Absolutely enforce the compendium-driven style/marker/symbol/filter system (`compendium.svg`). One-off renderer-local styling is forbidden, with the sole exception of dynamic geometry generation that cannot be easily templated.
- **No Dynamic Defs Translation**: Never perform dynamic/runtime ID translations, string replacements, or regex rewriting inside `buildDefs` or SVG generators, except for explicit style templating. If template IDs need namespace prefixes, edit `compendium.svg` directly and update code lookups to reference them statically.
- **Demo Colors Are Not a Palette**: Colors in standalone demos and test harnesses, including `www/slate.html`, are non-authoritative fallbacks. Never identify or extend them as a Catppuccin palette, or infer new product colors from them. Choose shared UI colors deliberately with the user.

## 4. Testing & Tooling

- **VISUAL TESTS FIRST (CRITICAL)**: Tests that operate on diagrams (parsing, refining, annotating, mutations, etc.) MUST use ASCII diagrams (`parseDiagram`/`matchDiagram`). **DO NOT construct AST objects manually in tests.** Manual construction frequently misses obvious visual gaps and regression cases. If you are testing anything beyond simple standalone helpers, write an ASCII diagram.
- **ASCII Template Literals**: Always start ASCII diagram test literals with a backslash `\` (e.g., ``const input = `\``). This prevents an unintended leading newline and ensures exact coordinate alignment.
- **Standard Assertions**: Always use the `@std/assert` bare specifier. Never use direct URLs or specific file imports for assertions.
- **Core Dependency Imports**: In the distributable core runtime under `src/`, declare external dependencies as versioned aliases in `deno.json` and import them through bare specifiers. Tooling, scripts, and editor code may use direct `npm:`, `jsr:`, or URL specifiers when appropriate.
- **Test Task**: Run `deno task test` (which combines linter/tsc/unittests) to validate all changes.
- **CLI Rendering and Inspection**: Use `deno run -A package-topos/cli.ts input.topos -o tmp/input.svg --inspect > tmp/input.inspect.json` to render a diagram and inspect the resolved node hierarchy, connections, formatting, visual intent, and compact geometry in one pass. Prefer the inspection JSON over raw SVG markup when understanding or repairing a diagram, but keep the `.topos` text as the source of truth. The inspection shape is intentionally unstable; do not treat incidental fields as a public contract.

## 5. Safe Development & VCS Rules

- **NEVER run destructive VCS commands** (`git checkout`, `git restore`, `git reset`, `git clean`) on any workspace files under any circumstances. If a file needs to be reverted or reset, you must ask the user first to use local revert.

## 6. Project Stage & Cruft Avoidance

- **No Early Backward Compatibility**: Downplay backward compatibility. This project is in an active pre-release state (not even beta). Do not introduce legacy fallbacks, workarounds, or compatibility layers simply to support outdated diagrams or formats. Avoid accumulating early cruft; instead, modify all current schemas, files, and usages to align with clean, current designs.
